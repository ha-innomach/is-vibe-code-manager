use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub version: u32,
    pub settings: AppSettings,
    pub companies: Vec<CompanyProfile>,
}

impl Default for AppConfig {
    fn default() -> Self {
        AppConfig {
            version: 1,
            settings: AppSettings::default(),
            companies: Vec::new(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub backups_dir: String,
    pub default_env_provider: EnvProviderType,
    pub manage_ssh_config: bool,
    pub manage_git_config: bool,
    pub auto_verify_after_apply: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        AppSettings {
            backups_dir: "~/.dev-context-manager/backups".to_string(),
            default_env_provider: EnvProviderType::Direnv,
            manage_ssh_config: true,
            manage_git_config: true,
            auto_verify_after_apply: true,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum EnvProviderType {
    None,
    Direnv,
    Dotenv,
    ShellSnippet,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CompanyProfile {
    pub id: String,
    pub display_name: String,
    pub workspace_roots: Vec<String>,
    pub git: GitProfile,
    pub github: GithubProfile,
    pub env: EnvProfile,
    #[serde(default)]
    pub deployments: Vec<DeploymentProfile>,
    #[serde(default)]
    pub repositories: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub repo_defaults: Option<RepoDefaults>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GitProfile {
    pub user_name: String,
    pub user_email: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub signing_key: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GithubProfile {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
    pub host_alias: String,
    pub ssh_key_path: String,
    pub clone_protocol: CloneProtocol,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum CloneProtocol {
    Ssh,
    Https,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EnvProfile {
    pub provider: EnvProviderType,
    pub defaults: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RepoDefaults {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_branch: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub enforce_host_alias: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub allowed_remote_patterns: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum DeploymentKind {
    Vps,
    Vercel,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DeploymentProfile {
    pub kind: DeploymentKind,
    pub host: String,
    pub username: String,
    pub port: u16,
    pub ssh_key_path: String,
    pub is_provisioned: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub project_id: Option<String>, // For Vercel
}
