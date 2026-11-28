use crate::error::{AttendoError, AttendoResult};
use qbsdiff::Bspatch;
use std::fs::File;
use std::io::{BufWriter, Read, Write};

/// Applies a `qbsdiff` binary delta patch to `old_apk_path`,
/// writing the reconstructed signed APK to `out_apk_path`.
pub fn apply_apk_patch(
    old_apk_path: &str,
    patch_path: &str,
    out_apk_path: &str,
) -> AttendoResult<u64> {
    let mut old_bytes = Vec::new();
    File::open(old_apk_path)
        .map_err(|e| AttendoError::InvalidInput(format!("Failed to open base.apk: {}", e)))?
        .read_to_end(&mut old_bytes)
        .map_err(|e| AttendoError::InvalidInput(format!("Failed to read base.apk: {}", e)))?;

    let mut patch_bytes = Vec::new();
    File::open(patch_path)
        .map_err(|e| AttendoError::InvalidInput(format!("Failed to open patch: {}", e)))?
        .read_to_end(&mut patch_bytes)
        .map_err(|e| AttendoError::InvalidInput(format!("Failed to read patch: {}", e)))?;

    let patcher = Bspatch::new(&patch_bytes)
        .map_err(|e| AttendoError::InvalidInput(format!("Invalid delta patch header: {}", e)))?;

    let mut out_file = BufWriter::new(
        File::create(out_apk_path)
            .map_err(|e| AttendoError::InvalidInput(format!("Failed to create output APK: {}", e)))?,
    );

    let written = patcher
        .apply(&old_bytes, &mut out_file)
        .map_err(|e| AttendoError::InvalidInput(format!("Delta patch failed: {}", e)))?;

    out_file
        .flush()
        .map_err(|e| AttendoError::InvalidInput(format!("Failed to flush patched APK: {}", e)))?;

    Ok(written)
}
