use crate::git::{self, Action, Repository};
use portable_pty::{CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    io::{Read, Write},
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        Arc, Mutex,
    },
};
use tauri::{Emitter, Manager, State};

type Result<T> = std::result::Result<T, String>;
struct TerminalSession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    child: Box<dyn portable_pty::Child + Send + Sync>,
}
#[derive(Default)]
pub(crate) struct AppState {
    repositories: Mutex<HashMap<String, Repository>>,
    locks: Mutex<HashMap<PathBuf, Arc<Mutex<()>>>>,
    jobs: Mutex<HashMap<String, Arc<AtomicBool>>>,
    terminals: Mutex<HashMap<String, TerminalSession>>,
    pub(crate) next_id: AtomicU64,
    pub(crate) prompts: Mutex<HashMap<String, std::sync::mpsc::SyncSender<Option<String>>>>,
}
#[derive(Serialize)]
struct Opened {
    id: String,
    path: String,
    trusted: bool,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Query {
    repository: String,
    kind: String,
    #[serde(default)]
    path: String,
    #[serde(default)]
    revision: String,
    #[serde(default)]
    compare: String,
    #[serde(default)]
    staged: bool,
    #[serde(default)]
    skip: usize,
    #[serde(default)]
    search: String,
    #[serde(default)]
    branch: String,
}
#[derive(Clone, Serialize)]
struct TerminalOutput {
    id: String,
    data: Vec<u8>,
}

fn repo(state: &AppState, id: &str) -> Result<Repository> {
    state
        .repositories
        .lock()
        .map_err(|_| "Repository state unavailable")?
        .get(id)
        .cloned()
        .ok_or("Repository is not open".into())
}
fn trust_file(app: &tauri::AppHandle) -> Result<PathBuf> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("trusted-repositories.json"))
}
fn trusted_paths(app: &tauri::AppHandle) -> Result<Vec<String>> {
    let file = trust_file(app)?;
    if !file.exists() {
        return Ok(vec![]);
    }
    serde_json::from_slice(&std::fs::read(file).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn git_version() -> Result<String> {
    git::version()
}

#[tauri::command]
async fn open_repository(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    path: String,
) -> Result<Opened> {
    let trusted = trusted_paths(&app)?;
    let repository =
        tauri::async_runtime::spawn_blocking(move || Repository::open(&PathBuf::from(path), false))
            .await
            .map_err(|e| e.to_string())??;
    let path = repository.root.to_string_lossy().to_string();
    let mut repository = repository;
    repository.trusted = trusted.contains(&path);
    let path = git::display_path(&repository.root)
        .to_string_lossy()
        .to_string();
    let is_trusted = repository.trusted;
    let id = state.next_id.fetch_add(1, Ordering::Relaxed).to_string();
    state
        .repositories
        .lock()
        .map_err(|_| "Repository state unavailable")?
        .insert(id.clone(), repository);
    Ok(Opened {
        id,
        path,
        trusted: is_trusted,
    })
}
#[tauri::command]
fn trust_repository(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    repository: String,
) -> Result<()> {
    let mut repositories = state
        .repositories
        .lock()
        .map_err(|_| "Repository state unavailable")?;
    let repo = repositories
        .get_mut(&repository)
        .ok_or("Repository is not open")?;
    let mut paths = trusted_paths(&app)?;
    let path = repo.root.to_string_lossy().to_string();
    if !paths.contains(&path) {
        paths.push(path);
    }
    let file = trust_file(&app)?;
    let temp = file.with_extension("tmp");
    std::fs::write(
        &temp,
        serde_json::to_vec(&paths).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    std::fs::rename(temp, file).map_err(|e| e.to_string())?;
    repo.trusted = true;
    Ok(())
}
#[tauri::command]
async fn query(state: State<'_, AppState>, request: Query) -> Result<serde_json::Value> {
    let repository = repo(&state, &request.repository)?;
    tauri::async_runtime::spawn_blocking(move || match request.kind.as_str() {
        "snapshot" => serde_json::to_value(repository.snapshot()?).map_err(|e| e.to_string()),
        "history" => serde_json::to_value(repository.history(
            request.skip,
            &request.search,
            &request.branch,
        )?)
        .map_err(|e| e.to_string()),
        "diff" => Ok(serde_json::json!(repository.diff(
            &request.path,
            request.staged,
            &request.revision,
            &request.compare
        )?)),
        "blame" => Ok(serde_json::json!(repository.blame(&request.path)?)),
        "file_history" => Ok(serde_json::json!(repository.file_history(&request.path)?)),
        "conflict" => {
            serde_json::to_value(repository.conflict(&request.path)?).map_err(|e| e.to_string())
        }
        kind => serde_json::to_value(repository.entries(kind)?).map_err(|e| e.to_string()),
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn preview(
    state: State<'_, AppState>,
    repository: String,
    action: Action,
) -> Result<(String, String)> {
    let repository = repo(&state, &repository)?;
    tauri::async_runtime::spawn_blocking(move || repository.preview(&action))
        .await
        .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn execute(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    repository: String,
    action: Action,
    expected: Option<String>,
    job: String,
) -> Result<String> {
    let mut repository = repo(&state, &repository)?;
    let cancel = Arc::new(AtomicBool::new(false));
    repository.cancel = cancel.clone();
    let lock = state
        .locks
        .lock()
        .map_err(|_| "Repository lock unavailable")?
        .entry(repository.common.clone())
        .or_insert_with(|| Arc::new(Mutex::new(())))
        .clone();
    let _bridge = crate::askpass::attach(&app, &mut repository)?;
    {
        let mut jobs = state.jobs.lock().map_err(|_| "Job state unavailable")?;
        if jobs.contains_key(&job) {
            return Err("Job already exists".into());
        }
        jobs.insert(job.clone(), cancel);
    }
    let result = tauri::async_runtime::spawn_blocking(move || {
        let _guard = lock.lock().map_err(|_| "Repository lock unavailable")?;
        repository.execute(&action, expected.as_deref())
    })
    .await
    .map_err(|e| e.to_string());
    state
        .jobs
        .lock()
        .map_err(|_| "Job state unavailable")?
        .remove(&job);
    let _ = app.emit("repository-changed", ());
    result?
}
#[tauri::command]
fn cancel_operation(state: State<'_, AppState>, job: String) -> Result<()> {
    if let Some(cancel) = state
        .jobs
        .lock()
        .map_err(|_| "Job state unavailable")?
        .get(&job)
    {
        cancel.store(true, Ordering::Relaxed);
    }
    Ok(())
}
#[tauri::command]
fn answer_prompt(state: State<'_, AppState>, id: String, value: Option<String>) -> Result<()> {
    let sender = state
        .prompts
        .lock()
        .map_err(|_| "Prompt state unavailable")?
        .remove(&id)
        .ok_or("Prompt has expired")?;
    sender.send(value).map_err(|_| "Prompt has expired".into())
}

#[tauri::command]
async fn create_repository(
    app: tauri::AppHandle,
    path: String,
    url: Option<String>,
) -> Result<String> {
    tauri::async_runtime::spawn_blocking(move || {
        let destination = PathBuf::from(&path);
        if !destination.is_absolute() {
            return Err("Choose an absolute local folder path".into());
        }
        git::reject_network(&destination)?;
        if let Some(url) = url {
            git::validate_url(&url)?;
            let parent = destination.parent().ok_or("Choose a destination folder")?;
            let mut repo = Repository {
                root: parent.to_path_buf(),
                common: PathBuf::new(),
                trusted: true,
                cancel: Arc::new(AtomicBool::new(false)),
                askpass: None,
            };
            let _bridge = crate::askpass::attach(&app, &mut repo)?;
            repo.text(&["clone", "--", &url, &path])?;
        } else {
            std::fs::create_dir_all(&destination).map_err(|e| e.to_string())?;
            let repo = Repository {
                root: destination,
                common: PathBuf::new(),
                trusted: true,
                cancel: Arc::new(AtomicBool::new(false)),
                askpass: None,
            };
            repo.text(&["init"])?;
        }
        Ok(path)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn terminal_open(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    repository: String,
) -> Result<String> {
    let repo = repo(&state, &repository)?;
    if !repo.trusted {
        return Err("Trust this repository before starting a terminal".into());
    }
    let pair = portable_pty::native_pty_system()
        .openpty(PtySize {
            rows: 16,
            cols: 100,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;
    #[cfg(windows)]
    let shell = "powershell.exe";
    #[cfg(not(windows))]
    let shell = "/bin/sh";
    let mut command = CommandBuilder::new(shell);
    #[cfg(windows)]
    command.arg("-NoLogo");
    command.cwd(git::display_path(&repo.root));
    command.env("TERM", "xterm-256color");
    let child = pair
        .slave
        .spawn_command(command)
        .map_err(|e| e.to_string())?;
    drop(pair.slave);
    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    let id = format!("terminal-{}", state.next_id.fetch_add(1, Ordering::Relaxed));
    state
        .terminals
        .lock()
        .map_err(|_| "Terminal state unavailable")?
        .insert(
            id.clone(),
            TerminalSession {
                master: pair.master,
                writer,
                child,
            },
        );
    let event_id = id.clone();
    std::thread::spawn(move || {
        let mut buffer = [0; 8192];
        while let Ok(n) = reader.read(&mut buffer) {
            if n == 0 {
                break;
            }
            let _ = app.emit(
                "terminal-output",
                TerminalOutput {
                    id: event_id.clone(),
                    data: buffer[..n].to_vec(),
                },
            );
        }
        let _ = app.emit("terminal-exit", event_id);
    });
    Ok(id)
}
#[tauri::command]
fn terminal_write(state: State<'_, AppState>, id: String, data: String) -> Result<()> {
    state
        .terminals
        .lock()
        .map_err(|_| "Terminal state unavailable")?
        .get_mut(&id)
        .ok_or("Terminal is closed")?
        .writer
        .write_all(data.as_bytes())
        .map_err(|e| e.to_string())
}
#[tauri::command]
fn terminal_resize(state: State<'_, AppState>, id: String, rows: u16, cols: u16) -> Result<()> {
    state
        .terminals
        .lock()
        .map_err(|_| "Terminal state unavailable")?
        .get(&id)
        .ok_or("Terminal is closed")?
        .master
        .resize(PtySize {
            rows: rows.clamp(1, 500),
            cols: cols.clamp(1, 1000),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())
}
#[tauri::command]
fn terminal_close(state: State<'_, AppState>, id: String) -> Result<()> {
    if let Some(mut session) = state
        .terminals
        .lock()
        .map_err(|_| "Terminal state unavailable")?
        .remove(&id)
    {
        if let Some(pid) = session.child.process_id() {
            git::kill_process_tree(pid);
        }
        let _ = session.child.kill();
    }
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            git_version,
            open_repository,
            trust_repository,
            query,
            preview,
            execute,
            cancel_operation,
            answer_prompt,
            create_repository,
            terminal_open,
            terminal_write,
            terminal_resize,
            terminal_close
        ])
        .build(tauri::generate_context!())
        .expect("Cannot start Gik")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                let state = app.state::<AppState>();
                if let Ok(mut terminals) = state.terminals.lock() {
                    for (_, mut session) in terminals.drain() {
                        if let Some(pid) = session.child.process_id() {
                            git::kill_process_tree(pid);
                        }
                        let _ = session.child.kill();
                    }
                }
                if let Ok(jobs) = state.jobs.lock() {
                    for cancel in jobs.values() {
                        cancel.store(true, Ordering::Relaxed);
                    }
                };
            }
        });
}
