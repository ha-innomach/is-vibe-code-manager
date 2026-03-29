use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use serde::{Deserialize, Serialize};
use std::process::Stdio;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TerminalPayload {
    pub text: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TerminalExitPayload {
    pub code: Option<i32>,
}

#[tauri::command]
pub async fn run_terminal_command(
    app: AppHandle,
    command: String,
    args: Vec<String>
) -> Result<String, String> {
    let mut child = Command::new(&command)
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn command {}: {}", command, e))?;

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    let mut stdout_reader = BufReader::new(stdout).lines();
    let mut stderr_reader = BufReader::new(stderr).lines();

    let app_clone = app.clone();
    
    // Spawn task to read stdout
    tokio::spawn(async move {
        while let Ok(Some(line)) = stdout_reader.next_line().await {
            let _ = app_clone.emit("terminal-output", TerminalPayload { text: format!("{}\n", line) });
        }
    });

    let app_clone_err = app.clone();
    // Spawn task to read stderr
    tokio::spawn(async move {
        while let Ok(Some(line)) = stderr_reader.next_line().await {
            let _ = app_clone_err.emit("terminal-output", TerminalPayload { text: format!("{}\n", line) });
        }
    });

    // Wait for the exit in a background task so we don't block the UI command response
    tokio::spawn(async move {
        let status = child.wait().await;
        let code = status.ok().and_then(|s| s.code());
        let _ = app.emit("terminal-exit", TerminalExitPayload { code });
    });

    Ok(format!("Command {} started successfully", command))
}
