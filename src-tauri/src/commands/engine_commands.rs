use tauri::State;
use crate::app_state::AppState;
use crate::engine::compiler::{calculate_proposed_changes, ProposedOperation};
use std::fs;
use std::path::Path;
use chrono::Local;

#[tauri::command]
pub async fn get_proposed_changes(
    state: State<'_, AppState>
) -> Result<Vec<ProposedOperation>, String> {
    let config_lock = state.config.lock().map_err(|e| e.to_string())?;
    let ops = calculate_proposed_changes(&config_lock);
    Ok(ops)
}

#[tauri::command]
pub async fn apply_changes(
    state: State<'_, AppState>
) -> Result<String, String> {
    let config_lock = state.config.lock().map_err(|e| e.to_string())?;
    let ops = calculate_proposed_changes(&config_lock);
    
    if ops.is_empty() {
        return Ok("No changes to apply.".to_string());
    }

    for op in &ops {
        let path = Path::new(&op.path);
        
        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent).map_err(|e| format!("Failed to create parent directory for {}: {}", op.path, e))?;
            }
        }

        // Create backup if file exists and we have a modification
        if path.exists() {
            let backup_path = format!("{}.{}.bak", op.path, Local::now().format("%Y%m%d%H%M%S"));
            fs::copy(path, backup_path).map_err(|e| format!("Failed to create backup for {}: {}", op.path, e))?;
        }

        // Apply change
        if let Some(after) = &op.after {
            fs::write(path, after).map_err(|e| format!("Failed to write to {}: {}", op.path, e))?;
        }
    }

    Ok(format!("Successfully applied {} operations.", ops.len()))
}
