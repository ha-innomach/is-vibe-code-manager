use std::process::Command;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct DependencyStatus {
    pub name: String,
    pub found: bool,
    pub version: Option<String>,
    pub install_command: String,
}

#[tauri::command]
pub async fn check_system_dependency(name: String) -> Result<DependencyStatus, String> {
    let (cmd, args) = match name.as_str() {
        "git" => ("git", vec!["--version"]),
        "ssh-keygen" => ("ssh-keygen", vec!["-?"]), // Or just check if it exists
        _ => return Err(format!("Unknown dependency: {}", name)),
    };

    let status = Command::new(cmd)
        .args(&args)
        .output();

    let found = status.is_ok();
    let version = if let Ok(output) = status {
        String::from_utf8_lossy(&output.stdout).trim().to_string().into()
    } else {
        None
    };

    let install_command = match name.as_str() {
        "git" => {
            if cfg!(target_os = "macos") {
                "brew install git".to_string()
            } else if cfg!(target_os = "windows") {
                "winget install --id Git.Git -e --source winget".to_string()
            } else {
                "sudo apt install git".to_string()
            }
        },
        "ssh-keygen" => "ssh-keygen is usually pre-installed on modern systems.".to_string(),
        _ => "".to_string(),
    };

    Ok(DependencyStatus {
        name,
        found,
        version,
        install_command,
    })
}

#[tauri::command]
pub fn get_home_dir() -> Result<String, String> {
    match dirs::home_dir() {
        Some(path) => Ok(path.to_string_lossy().to_string()),
        None => Err("Could not find home directory".to_string()),
    }
}

