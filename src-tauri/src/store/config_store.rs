use std::fs;
use std::path::PathBuf;
use crate::domain::config::AppConfig;
use dirs::home_dir;

const CONFIG_DIR: &str = ".dev-context-manager";
const CONFIG_FILE: &str = "config.yaml";

pub fn get_config_path() -> Result<PathBuf, String> {
    let home = home_dir().ok_or("Could not find home directory")?;
    Ok(home.join(CONFIG_DIR).join(CONFIG_FILE))
}

pub fn load_config() -> Result<AppConfig, String> {
    let path = get_config_path()?;
    
    if !path.exists() {
        return Ok(AppConfig::default());
    }

    let contents = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read config file: {}", e))?;
    
    let config: AppConfig = serde_yaml::from_str(&contents)
        .map_err(|e| format!("Failed to parse config file: {}", e))?;
    
    Ok(config)
}

pub fn save_config_to_disk(config: &AppConfig) -> Result<(), String> {
    let path = get_config_path()?;
    
    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    let yaml = serde_yaml::to_string(config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    
    fs::write(&path, yaml)
        .map_err(|e| format!("Failed to write config file: {}", e))?;
    
    Ok(())
}
