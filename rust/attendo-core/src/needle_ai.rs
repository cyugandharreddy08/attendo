use crate::error::{AttendoError, AttendoResult};
use libloading::{Library, Symbol};
use serde_json::{json, Value};
use std::ffi::{CStr, CString};
use std::os::raw::{c_char, c_int, c_void};
use std::sync::{Mutex, OnceLock};

type CactusModelT = *mut c_void;
type FnCactusInit = unsafe extern "C" fn(*const c_char, *const c_char, bool) -> CactusModelT;
type FnCactusDestroy = unsafe extern "C" fn(CactusModelT);
type FnCactusReset = unsafe extern "C" fn(CactusModelT);
type FnCactusComplete = unsafe extern "C" fn(
    CactusModelT,
    *const c_char,
    *mut c_char,
    usize,
    *const c_char,
    *const c_char,
    *const c_void,
    *mut c_void,
    *const u8,
    usize,
) -> c_int;
type FnCactusEmbed = unsafe extern "C" fn(
    CactusModelT,
    *const c_char,
    *mut f32,
    usize,
    *mut usize,
    bool,
) -> c_int;

struct NeedleRuntime {
    _lib: Library,
    model: CactusModelT,
    fn_complete: FnCactusComplete,
    fn_embed: FnCactusEmbed,
    fn_reset: FnCactusReset,
    fn_destroy: FnCactusDestroy,
    model_path: String,
}

// Safety: NeedleRuntime is guarded by a Mutex and only accessed from one thread at a time.
unsafe impl Send for NeedleRuntime {}
unsafe impl Sync for NeedleRuntime {}

impl Drop for NeedleRuntime {
    fn drop(&mut self) {
        if !self.model.is_null() {
            unsafe { (self.fn_destroy)(self.model) };
        }
    }
}

static NEEDLE: OnceLock<Mutex<Option<NeedleRuntime>>> = OnceLock::new();

fn runtime_cell() -> &'static Mutex<Option<NeedleRuntime>> {
    NEEDLE.get_or_init(|| Mutex::new(None))
}

pub fn is_needle_ready() -> bool {
    runtime_cell()
        .lock()
        .map(|g| g.is_some())
        .unwrap_or(false)
}

pub fn init_needle(model_path: &str) -> AttendoResult<Value> {
    if !std::path::Path::new(model_path).exists() {
        return Err(AttendoError::InvalidInput(format!(
            "Needle 3 model file not found at {}",
            model_path
        )));
    }

    let mut guard = runtime_cell()
        .lock()
        .map_err(|_| AttendoError::InvalidInput("Needle mutex poisoned".into()))?;

    if let Some(ref rt) = *guard {
        if rt.model_path == model_path {
            return Ok(json!({ "ready": true, "model": "needle3", "cached": true }));
        }
    }

    unsafe {
        let lib = Library::new("libcactus_engine.so")
            .map_err(|e| AttendoError::InvalidInput(format!("Cactus engine unavailable: {}", e)))?;

        let fn_init: Symbol<FnCactusInit> = lib
            .get(b"cactus_init\0")
            .map_err(|e| AttendoError::InvalidInput(e.to_string()))?;
        let fn_complete: FnCactusComplete = *lib
            .get::<FnCactusComplete>(b"cactus_complete\0")
            .map_err(|e| AttendoError::InvalidInput(e.to_string()))?;
        let fn_embed: FnCactusEmbed = *lib
            .get::<FnCactusEmbed>(b"cactus_embed\0")
            .map_err(|e| AttendoError::InvalidInput(e.to_string()))?;
        let fn_reset: FnCactusReset = *lib
            .get::<FnCactusReset>(b"cactus_reset\0")
            .map_err(|e| AttendoError::InvalidInput(e.to_string()))?;
        let fn_destroy: FnCactusDestroy = *lib
            .get::<FnCactusDestroy>(b"cactus_destroy\0")
            .map_err(|e| AttendoError::InvalidInput(e.to_string()))?;

        let c_path = CString::new(model_path)
            .map_err(|e| AttendoError::InvalidInput(e.to_string()))?;
        let model = fn_init(c_path.as_ptr(), std::ptr::null(), false);
        if model.is_null() {
            return Err(AttendoError::InvalidInput(
                "cactus_init returned null handle for needle3.cact".into(),
            ));
        }

        *guard = Some(NeedleRuntime {
            _lib: lib,
            model,
            fn_complete,
            fn_embed,
            fn_reset,
            fn_destroy,
            model_path: model_path.to_string(),
        });
    }

    Ok(json!({ "ready": true, "model": "needle3", "cached": false }))
}

pub fn needle_complete(
    messages: &Value,
    tools: Option<&Value>,
    max_tokens: i32,
) -> AttendoResult<Value> {
    let guard = runtime_cell()
        .lock()
        .map_err(|_| AttendoError::InvalidInput("Needle mutex poisoned".into()))?;
    let rt = guard
        .as_ref()
        .ok_or_else(|| AttendoError::InvalidInput("Needle 3 not initialized".into()))?;

    let c_msgs = CString::new(messages.to_string())
        .map_err(|e| AttendoError::InvalidInput(e.to_string()))?;
    let options = json!({
        "max_tokens": max_tokens,
        "temperature": 0.1,
        "top_k": 20,
        "confidence_threshold": 0.55
    });
    let c_opts = CString::new(options.to_string())
        .map_err(|e| AttendoError::InvalidInput(e.to_string()))?;
    let c_tools = match tools {
        Some(t) => Some(
            CString::new(t.to_string())
                .map_err(|e| AttendoError::InvalidInput(e.to_string()))?,
        ),
        None => None,
    };

    let mut buf = vec![0u8; 32 * 1024];
    let rc = unsafe {
        (rt.fn_reset)(rt.model);
        (rt.fn_complete)(
            rt.model,
            c_msgs.as_ptr(),
            buf.as_mut_ptr() as *mut c_char,
            buf.len(),
            c_opts.as_ptr(),
            c_tools.as_ref().map(|s| s.as_ptr()).unwrap_or(std::ptr::null()),
            std::ptr::null(),
            std::ptr::null_mut(),
            std::ptr::null(),
            0,
        )
    };

    let raw_str = unsafe { CStr::from_ptr(buf.as_ptr() as *const c_char) }
        .to_string_lossy()
        .to_string();

    if rc < 0 && raw_str.trim().is_empty() {
        return Err(AttendoError::InvalidInput(format!(
            "cactus_complete failed with code {}",
            rc
        )));
    }

    let parsed: Value = serde_json::from_str(&raw_str).unwrap_or_else(|_| {
        json!({ "success": rc >= 0, "response": raw_str })
    });
    Ok(parsed)
}

pub fn needle_embed(text: &str) -> AttendoResult<Vec<f32>> {
    let guard = runtime_cell()
        .lock()
        .map_err(|_| AttendoError::InvalidInput("Needle mutex poisoned".into()))?;
    let rt = guard
        .as_ref()
        .ok_or_else(|| AttendoError::InvalidInput("Needle 3 not initialized".into()))?;

    let c_text = CString::new(text).map_err(|e| AttendoError::InvalidInput(e.to_string()))?;
    let mut vec_buf = vec![0.0f32; 2048];
    let mut dim: usize = 0;

    let rc = unsafe {
        (rt.fn_embed)(
            rt.model,
            c_text.as_ptr(),
            vec_buf.as_mut_ptr(),
            vec_buf.len() * std::mem::size_of::<f32>(),
            &mut dim,
            true,
        )
    };

    if rc < 0 || dim == 0 {
        return Err(AttendoError::InvalidInput("cactus_embed failed".into()));
    }
    vec_buf.truncate(dim);
    Ok(vec_buf)
}

#[inline]
pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }
    let mut dot = 0.0f32;
    for i in 0..a.len() {
        dot += a[i] * b[i];
    }
    dot
}
