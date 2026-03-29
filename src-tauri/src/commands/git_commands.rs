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
