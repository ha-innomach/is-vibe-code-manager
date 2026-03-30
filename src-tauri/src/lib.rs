pub mod app_state;
pub mod commands;
pub mod domain;
pub mod store;

use commands::config_commands::{get_config, save_config, export_selected_config, get_config_from_file, import_selected_companies};
use commands::git_commands::{clone_repository, pull_repository, fix_repository_identity};
use commands::repo_commands::{inspect_repository, fetch_gh_repos, scan_local_workspace};
use commands::engine_commands::{get_proposed_changes, apply_changes};
use commands::system_commands::{check_system_dependency, get_home_dir, check_file_exists, read_text_file};
use commands::terminal_commands::run_terminal_command;
use store::config_store::load_config;

pub mod engine;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load config from disk (or default if missing)
    let initial_config = match load_config() {
        Ok(c) => c,
        Err(e) => {
            eprintln!("Warning: Failed to load config, using default: {}", e);
            crate::domain::config::AppConfig::default()
        }
    };

    let app_state = app_state::AppState::new(initial_config);

    tauri::Builder::default()
        .manage(app_state)
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            fetch_gh_repos,
            scan_local_workspace,
            check_file_exists,
            read_text_file,
            get_config, 
            save_config, 
            export_selected_config,
            get_config_from_file,
            import_selected_companies,
            clone_repository,
            pull_repository,
            fix_repository_identity,
            inspect_repository,
            get_proposed_changes,
            apply_changes,
            check_system_dependency,
            get_home_dir,
            run_terminal_command
        ])
        .run(tauri::generate_context!())

        .expect("error while running tauri application");
}
