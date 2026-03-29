use tauri::State;
use crate::app_state::AppState;
use crate::domain::config::AppConfig;
use crate::store::config_store::save_config_to_disk;

#[tauri::command]
pub fn get_config(state: State<'_, AppState>) -> Result<AppConfig, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    Ok(config.clone())
}

#[tauri::command]
pub fn save_config(state: State<'_, AppState>, new_config: AppConfig) -> Result<(), String> {
    // 1. Update in-memory state
    {
        let mut config = state.config.lock().map_err(|e| e.to_string())?;
        *config = new_config.clone();
    }
    
    // 2. Persist to file
    save_config_to_disk(&new_config)?;
    
    Ok(())
}

#[tauri::command]
pub fn get_config_from_file(path: String) -> Result<AppConfig, String> {
    let json = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    let config: AppConfig = serde_json::from_str(&json).map_err(|e| e.to_string())?;
    Ok(config)
}

#[tauri::command]
pub fn export_selected_config(state: State<'_, AppState>, path: String, company_ids: Vec<String>) -> Result<(), String> {
    let config_lock = state.config.lock().map_err(|e| e.to_string())?;
    
    // Create a new config with only selected companies
    let mut export_config = config_lock.clone();
    export_config.companies = config_lock.companies.iter()
        .filter(|c| company_ids.contains(&c.id))
        .cloned()
        .collect();
    
    let json = serde_json::to_string_pretty(&export_config).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub fn import_selected_companies(state: State<'_, AppState>, path: String, company_ids: Vec<String>) -> Result<(), String> {
    // 1. Read the imported file
    let json = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    let import_config: AppConfig = serde_json::from_str(&json).map_err(|e| e.to_string())?;
    
    // 2. Filter selected companies
    let selected_companies: Vec<_> = import_config.companies.into_iter()
        .filter(|c| company_ids.contains(&c.id))
        .collect();
    
    // 3. Merge into current state
    {
        let mut current_config = state.config.lock().map_err(|e| e.to_string())?;
        
        for imported in selected_companies {
            // If exists, update; else, push
            if let Some(index) = current_config.companies.iter().position(|c| c.id == imported.id) {
                current_config.companies[index] = imported;
            } else {
                current_config.companies.push(imported);
            }
        }
        
        // 4. Persist the merged state
        save_config_to_disk(&current_config)?;
    }
    
    Ok(())
}
