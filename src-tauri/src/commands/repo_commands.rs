use git2::Repository;
use serde::{Deserialize, Serialize};
use crate::app_state::AppState;
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoInspectionResult {
    pub path: String,
    pub exists: bool,
    pub is_git: bool,
    pub user_email: Option<String>,
    pub origin_url: Option<String>,
    pub matched_company_id: Option<String>,
}

#[tauri::command]
pub async fn inspect_repository(
    state: State<'_, AppState>,
    path: String
) -> Result<RepoInspectionResult, String> {
    let mut result = RepoInspectionResult {
        path: path.clone(),
        exists: std::path::Path::new(&path).exists(),
        is_git: false,
        user_email: None,
        origin_url: None,
        matched_company_id: None,
    };

    if !result.exists {
        return Ok(result);
    }

    let repo = match Repository::open(&path) {
        Ok(r) => r,
        Err(_) => return Ok(result),
    };

    result.is_git = true;

    // Get config
    if let Ok(config) = repo.config() {
        result.user_email = config.get_string("user.email").ok();
    }

    // Get origin remote
    if let Ok(remote) = repo.find_remote("origin") {
        result.origin_url = remote.url().map(|u| u.to_string());
    }

    // Attempt to match company context
    let config_lock = state.config.lock().map_err(|e| e.to_string())?;
    
    // Logic 1: Match by workspace root (prefix check)
    for company in &config_lock.companies {
        for root in &company.workspace_roots {
            // Simple path normalization (expand ~ if needed, though usually frontend sends absolute)
            if path.starts_with(root) {
                result.matched_company_id = Some(company.id.clone());
                break;
            }
        }
        if result.matched_company_id.is_some() { break; }
        
        // Logic 2: Match by email if we have one
        if let Some(ref email) = result.user_email {
            if email == &company.git.user_email {
                result.matched_company_id = Some(company.id.clone());
                break;
            }
        }
    }

    Ok(result)
}
