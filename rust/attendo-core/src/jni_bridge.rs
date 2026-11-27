#[cfg(target_os = "android")]
use jni::objects::{JClass, JString};
#[cfg(target_os = "android")]
use jni::sys::jstring;
#[cfg(target_os = "android")]
use jni::JNIEnv;

#[cfg(target_os = "android")]
#[no_mangle]
pub extern "system" fn Java_com_tracker75_core_AttendoCore_nativeInit(
    mut env: JNIEnv,
    _class: JClass,
    db_path: JString,
) -> jstring {
    let path: String = match env.get_string(&db_path) {
        Ok(s) => s.into(),
        Err(e) => {
            let err_json = serde_json::json!({ "ok": false, "error": e.to_string() }).to_string();
            return env.new_string(err_json).expect("jni string").into_raw();
        }
    };

    let res = crate::init_engine(&path);
    let out = match res {
        Ok(_) => serde_json::json!({ "ok": true, "data": "initialized" }).to_string(),
        Err(e) => serde_json::json!({ "ok": false, "error": e.to_string() }).to_string(),
    };
    env.new_string(out).expect("jni string").into_raw()
}

#[cfg(target_os = "android")]
#[no_mangle]
pub extern "system" fn Java_com_tracker75_core_AttendoCore_nativeInvoke(
    mut env: JNIEnv,
    _class: JClass,
    method: JString,
    payload: JString,
) -> jstring {
    let method_str: String = match env.get_string(&method) {
        Ok(s) => s.into(),
        Err(e) => {
            let err = serde_json::json!({ "ok": false, "error": e.to_string() }).to_string();
            return env.new_string(err).expect("jni string").into_raw();
        }
    };

    let payload_str: String = match env.get_string(&payload) {
        Ok(s) => s.into(),
        Err(e) => {
            let err = serde_json::json!({ "ok": false, "error": e.to_string() }).to_string();
            return env.new_string(err).expect("jni string").into_raw();
        }
    };

    let response = crate::dispatch_rpc(&method_str, &payload_str);
    env.new_string(response).expect("jni string").into_raw()
}
