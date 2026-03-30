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

#[tauri::command]
pub fn check_file_exists(path: String) -> Result<bool, String> {
    let expanded_path = if path.starts_with('~') {
        match dirs::home_dir() {
            Some(home) => path.replacen('~', &home.to_string_lossy(), 1),
            None => return Err("Could not expand home directory".to_string()),
        }
    } else {
        path
    };
    Ok(std::path::Path::new(&expanded_path).exists())
}#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    let expanded_path = if path.starts_with('~') {
        match dirs::home_dir() {
            Some(home) => path.replacen('~', &home.to_string_lossy(), 1),
            None => return Err("Could not expand home directory".to_string()),
        }
    } else {
        path
    };
    std::fs::read_to_string(&expanded_path)
        .map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
pub async fn generate_ssh_key(path: String, email: String) -> Result<String, String> {
    let expanded_path = if path.starts_with('~') {
        match dirs::home_dir() {
            Some(home) => path.replacen('~', &home.to_string_lossy(), 1),
            None => return Err("Could not expand home directory".to_string()),
        }
    } else {
        path
    };

    let p = std::path::Path::new(&expanded_path);
    
    // Ensure parent directory exists (usually .ssh)
    if let Some(parent) = p.parent() {
        if !parent.exists() {
            let _ = std::fs::create_dir_all(parent);
        }
    }

    // Run ssh-keygen
    // -N "" ensures no passphrase is asked (completely automated)
    let output = Command::new("ssh-keygen")
        .arg("-t").arg("ed25519")
        .arg("-C").arg(&email)
        .arg("-f").arg(&expanded_path)
        .arg("-N").arg("")
        .output()
        .map_err(|e| format!("Failed to execute ssh-keygen: {}. Ensure OpenSSH is installed.", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ssh-keygen failed: {}", stderr));
    }

    Ok(format!("SSH-sleutel succesvol gegenereerd op {}", expanded_path))
}
