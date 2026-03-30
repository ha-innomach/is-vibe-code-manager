use tauri::State;
use crate::app_state::AppState;
use std::process::Command;
use std::path::Path;

#[tauri::command]
pub async fn clone_repository(
    state: State<'_, AppState>,
    company_id: String,
    repo_url: String,
    target_parent: String
) -> Result<String, String> {
    // 1. Get company host alias
    let config = state.config.lock().map_err(|e| e.to_string())?;
    let company = config.companies.iter()
        .find(|c| c.id == company_id)
        .ok_or_else(|| "Company not found".to_string())?;
    
    let host_alias = &company.github.host_alias;
    
    // 2. Rewrite URL if it's GitHub to use the alias
    // Example: git@github.com:org/repo.git -> git@github-alias:org/repo.git
    let final_url = if repo_url.contains("github.com") {
        repo_url.replace("github.com", host_alias)
    } else {
        repo_url
    };

    // 3. Extract folder name from URL (e.g. repo.git -> repo)
    let folder_name = final_url.split('/').last()
        .map(|s| s.trim_end_matches(".git"))
        .ok_or_else(|| "Invalid repo URL".to_string())?;
    
    let target_path = Path::new(&target_parent).join(folder_name);
    
    if target_path.exists() {
        return Err(format!("Target directory already exists: {}", target_path.display()));
    }

    // 4. Run git clone
    let output = Command::new("git")
        .arg("clone")
        .arg(&final_url)
        .arg(&target_path)
        .output()
        .map_err(|e| format!("Failed to execute git: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Git clone failed: {}", stderr));
    }

    Ok(target_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn pull_repository(repo_path: String) -> Result<String, String> {
    let path = Path::new(&repo_path);
    if !path.exists() {
        return Err("Repository path does not exist".to_string());
    }

    let output = Command::new("git")
        .arg("-C")
        .arg(&repo_path)
        .arg("pull")
        .output()
        .map_err(|e| format!("Failed to execute git: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Git pull failed: {}", stderr));
    }

    Ok("Successfully pulled".to_string())
}

#[tauri::command]
pub async fn fix_repository_identity(
    repo_path: String,
    user_name: String,
    user_email: String,
    host_alias: String
) -> Result<String, String> {
    let path = Path::new(&repo_path);
    if !path.exists() {
        return Err("Repository path does not exist".to_string());
    }

    // 1. Set user.name
    let _ = Command::new("git")
        .arg("-C").arg(&repo_path)
        .arg("config").arg("user.name").arg(&user_name)
        .output()
        .map_err(|e| format!("Failed to set git name: {}", e))?;

    // 2. Set user.email
    let _ = Command::new("git")
        .arg("-C").arg(&repo_path)
        .arg("config").arg("user.email").arg(&user_email)
        .output()
        .map_err(|e| format!("Failed to set git email: {}", e))?;

    // 3. Update Remote URL to use host_alias
    let remote_output = Command::new("git")
        .arg("-C").arg(&repo_path)
        .arg("remote").arg("get-url").arg("origin")
        .output()
        .map_err(|e| format!("Failed to get remote URL: {}", e))?;

    if remote_output.status.success() {
        let current_url = String::from_utf8_lossy(&remote_output.stdout).trim().to_string();
        
        // Rewrite URL if it looks like GitHub SSH
        // Example logic: git@ANYTHING:owner/repo.git -> git@host_alias:owner/repo.git
        if current_url.starts_with("git@") && current_url.contains(':') {
            let parts: Vec<&str> = current_url.split(':').collect();
            if parts.len() == 2 {
                let new_url = format!("git@{}:{}", host_alias, parts[1]);
                if new_url != current_url {
                    let _ = Command::new("git")
                        .arg("-C").arg(&repo_path)
                        .arg("remote").arg("set-url").arg("origin").arg(&new_url)
                        .output()
                        .map_err(|e| format!("Failed to set remote URL: {}", e))?;
                }
            }
        } else if current_url.starts_with("https://github.com/") {
            // Also handle HTTPS to SSH conversion if host_alias is provided
            let new_url = current_url.replace("https://github.com/", &format!("git@{}:", host_alias)) + ".git";
            let _ = Command::new("git")
                .arg("-C").arg(&repo_path)
                .arg("remote").arg("set-url").arg("origin").arg(&new_url)
                .output()
                .map_err(|e| format!("Failed to set remote URL: {}", e))?;
        }
    }

    Ok("Identiteit en remote URL succesvol bijgewerkt.".to_string())
}
