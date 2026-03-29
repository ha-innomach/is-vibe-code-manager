use std::fs;
use std::path::PathBuf;
use crate::domain::config::{AppConfig, CompanyProfile};
use serde::{Deserialize, Serialize};
use dirs::home_dir;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "kebab-case")]
pub enum OperationType {
    WriteFile,
    PatchBlock,
    NoOp,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProposedOperation {
    pub id: String,
    pub op_type: OperationType,
    pub path: String,
    pub description: String,
    pub before: Option<String>,
    pub after: Option<String>,
    pub risk: String, // "low", "medium", "high"
}

pub fn get_ssh_config_path() -> Option<PathBuf> {
    home_dir().map(|h| h.join(".ssh").join("config"))
}

pub fn get_git_config_path() -> Option<PathBuf> {
    home_dir().map(|h| h.join(".gitconfig"))
}

pub fn generate_ssh_block(company: &CompanyProfile) -> String {
    let mut block = format!(
        "# IMPROVERS.STUDIO VCM: START {}\n# --- GitHub Identity ---\nHost {}\n  HostName github.com\n  User git\n  IdentityFile {}\n  IdentitiesOnly yes\n",
        company.id,
        company.github.host_alias,
        company.github.ssh_key_path
    );

    for (i, deploy) in company.deployments.iter().enumerate() {
        if deploy.kind == crate::domain::config::DeploymentKind::Vps {
            block.push_str(&format!(
                "\n# --- VPS Deployment {} ---\nHost {}-vps{}\n  HostName {}\n  User {}\n  Port {}\n  IdentityFile {}\n  IdentitiesOnly yes\n",
                i + 1,
                company.id,
                if i == 0 { "".to_string() } else { format!("-{}", i + 1) },
                deploy.host,
                deploy.username,
                deploy.port,
                deploy.ssh_key_path
            ));
        }
    }

    block.push_str(&format!("# IMPROVERS.STUDIO VCM: END {}\n", company.id));
    block
}

pub fn generate_git_include(company: &CompanyProfile) -> String {
    // We expect workspace_roots to be an absolute path or start with ~/
    // We'll just take the first one for now or loop through all.
    let mut includes = String::new();
    for root in &company.workspace_roots {
        let normalized = if root.starts_with("~/") {
            root.clone()
        } else {
            root.clone() // Assumed absolute
        };
        
        includes.push_str(&format!(
            "[includeIf \"gitdir:{}\"]\n  path = ~/.gitconfig-{}\n",
            if normalized.ends_with('/') { normalized } else { format!("{}/", normalized) },
            company.id
        ));
    }
    includes
}

pub fn calculate_proposed_changes(config: &AppConfig) -> Vec<ProposedOperation> {
    let mut ops = Vec::new();

    // 1. SSH Config Patching
    if config.settings.manage_ssh_config {
        if let Some(path) = get_ssh_config_path() {
            let path_str = path.to_string_lossy().to_string();
            let current_content = fs::read_to_string(&path).unwrap_or_default();
            
            let mut new_content = current_content.clone();
            let mut modified = false;

            for company in &config.companies {
                let start_marker = format!("# IMPROVERS.STUDIO VCM: START {}", company.id);
                let end_marker = format!("# IMPROVERS.STUDIO VCM: END {}", company.id);
                let desired_block = generate_ssh_block(company);

                if let (Some(start_idx), Some(end_idx)) = (new_content.find(&start_marker), new_content.find(&end_marker)) {
                    // Existing block found, check if it matches
                    let actual_end = end_idx + end_marker.len() + 1; // +1 for possible newline
                    let current_block = &new_content[start_idx..actual_end.min(new_content.len())];
                    
                    if current_block.trim() != desired_block.trim() {
                        // Replace it
                        new_content.replace_range(start_idx..actual_end.min(new_content.len()), &desired_block);
                        modified = true;
                    }
                } else {
                    // Block not found, append it
                    if !new_content.is_empty() && !new_content.ends_with('\n') {
                        new_content.push('\n');
                    }
                    new_content.push_str(&desired_block);
                    modified = true;
                }
            }

            if modified {
                ops.push(ProposedOperation {
                    id: "ssh-config".to_string(),
                    op_type: OperationType::PatchBlock,
                    path: path_str,
                    description: "Update managed SSH host aliases with IMPROVERS.STUDIO markers.".to_string(),
                    before: Some(current_content),
                    after: Some(new_content),
                    risk: "medium".to_string(),
                });
            }
        }
    }

    // 2. Main .gitconfig Inclusion
    if config.settings.manage_git_config {
        if let Some(path) = get_git_config_path() {
            let path_str = path.to_string_lossy().to_string();
            let current_content = fs::read_to_string(&path).unwrap_or_default();
            
            let mut new_content = current_content.clone();
            let mut modified = false;

            for company in &config.companies {
                // For simplicity in this version, we'll check if the company identity file is included anywhere.
                let identity_file_inclusion = format!("path = ~/.gitconfig-{}", company.id);
                
                if !current_content.contains(&identity_file_inclusion) {
                    if !new_content.is_empty() && !new_content.ends_with('\n') {
                        new_content.push('\n');
                    }
                    new_content.push_str(&generate_git_include(company));
                    modified = true;
                }
            }

            if modified {
                ops.push(ProposedOperation {
                    id: "git-main-config".to_string(),
                    op_type: OperationType::PatchBlock,
                    path: path_str,
                    description: "Update main .gitconfig with conditional context includes.".to_string(),
                    before: Some(current_content),
                    after: Some(new_content),
                    risk: "medium".to_string(),
                });
            }
        }
    }

    // 3. Per-Company Git Identity Files
    for company in &config.companies {
        let git_id_path = home_dir().map(|h| h.join(format!(".gitconfig-{}", company.id)));
        if let Some(path) = git_id_path {
            let path_str = path.to_string_lossy().to_string();
            let desired_content = format!(
                "[user]\n  name = {}\n  email = {}\n",
                company.git.user_name,
                company.git.user_email
            );
            
            let current_content = fs::read_to_string(&path).ok();
            
            if current_content.as_deref() != Some(&desired_content) {
                ops.push(ProposedOperation {
                    id: format!("gitconfig-{}", company.id),
                    op_type: OperationType::WriteFile,
                    path: path_str,
                    description: format!("Create or update git identity file for {}.", company.display_name),
                    before: current_content,
                    after: Some(desired_content),
                    risk: "low".to_string(),
                });
            }
        }
    }

    ops
}
