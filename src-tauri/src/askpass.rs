use crate::{
    desktop::AppState,
    git::{Repository, Result},
};
use serde::{Deserialize, Serialize};
use std::{
    io::{BufRead, BufReader, Write},
    net::{TcpListener, TcpStream},
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc, Arc,
    },
    time::{Duration, Instant},
};
use tauri::{Emitter, Manager};

#[derive(Serialize, Deserialize)]
struct Request {
    secret: String,
    prompt: String,
}
#[derive(Clone, Serialize)]
struct Prompt {
    id: String,
    prompt: String,
}
pub struct Bridge {
    stopped: Arc<AtomicBool>,
}
impl Drop for Bridge {
    fn drop(&mut self) {
        self.stopped.store(true, Ordering::Relaxed);
    }
}

pub fn attach(app: &tauri::AppHandle, repo: &mut Repository) -> Result<Bridge> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;
    let address = listener
        .local_addr()
        .map_err(|e| e.to_string())?
        .to_string();
    let mut bytes = [0u8; 32];
    getrandom::fill(&mut bytes).map_err(|e| e.to_string())?;
    let secret = bytes.iter().map(|b| format!("{b:02x}")).collect::<String>();
    repo.askpass = Some((
        std::env::current_exe()
            .map_err(|e| e.to_string())?
            .to_string_lossy()
            .into(),
        address,
        secret.clone(),
    ));
    let app = app.clone();
    let stopped = Arc::new(AtomicBool::new(false));
    let stop = stopped.clone();
    let cancel = repo.cancel.clone();
    std::thread::spawn(move || {
        while !stop.load(Ordering::Relaxed) && !cancel.load(Ordering::Relaxed) {
            let (mut stream, _) = match listener.accept() {
                Ok(pair) => pair,
                Err(_) => {
                    std::thread::sleep(Duration::from_millis(25));
                    continue;
                }
            };
            let _ = stream.set_read_timeout(Some(Duration::from_secs(2)));
            let mut request = String::new();
            if BufReader::new((&stream).take(8192))
                .read_line(&mut request)
                .is_err()
            {
                continue;
            }
            let Ok(request) = serde_json::from_str::<Request>(&request) else {
                continue;
            };
            if request.secret.len() != secret.len()
                || request
                    .secret
                    .bytes()
                    .zip(secret.bytes())
                    .fold(0u8, |acc, (a, b)| acc | (a ^ b))
                    != 0
            {
                continue;
            }
            let state = app.state::<AppState>();
            let id = format!("prompt-{}", state.next_id.fetch_add(1, Ordering::Relaxed));
            let (tx, rx) = mpsc::sync_channel(1);
            if let Ok(mut prompts) = state.prompts.lock() {
                prompts.insert(id.clone(), tx);
            } else {
                continue;
            }
            let _ = app.emit(
                "git-prompt",
                Prompt {
                    id: id.clone(),
                    prompt: request.prompt,
                },
            );
            let deadline = Instant::now() + Duration::from_secs(600);
            let response = loop {
                if stop.load(Ordering::Relaxed)
                    || cancel.load(Ordering::Relaxed)
                    || Instant::now() > deadline
                {
                    break None;
                }
                match rx.recv_timeout(Duration::from_millis(100)) {
                    Ok(value) => break value,
                    Err(mpsc::RecvTimeoutError::Disconnected) => break None,
                    Err(_) => {}
                }
            };
            if let Ok(mut prompts) = state.prompts.lock() {
                prompts.remove(&id);
            }
            let _ = app.emit("git-prompt-closed", id);
            if let Ok(bytes) = serde_json::to_vec(&response) {
                let _ = stream.write_all(&bytes);
                let _ = stream.write_all(b"\n");
            }
        }
    });
    Ok(Bridge { stopped })
}

pub fn helper() -> Result<()> {
    let address = std::env::var("GIK_ASKPASS_ADDR").map_err(|_| "Missing prompt address")?;
    let secret = std::env::var("GIK_ASKPASS_SECRET").map_err(|_| "Missing prompt secret")?;
    if !address.starts_with("127.0.0.1:") {
        return Err("Invalid prompt address".into());
    }
    let mut stream = TcpStream::connect(address).map_err(|e| e.to_string())?;
    stream
        .set_read_timeout(Some(Duration::from_secs(610)))
        .map_err(|e| e.to_string())?;
    let request = Request {
        secret,
        prompt: std::env::args()
            .nth(1)
            .unwrap_or_else(|| "Git authentication".into()),
    };
    serde_json::to_writer(&mut stream, &request).map_err(|e| e.to_string())?;
    stream.write_all(b"\n").map_err(|e| e.to_string())?;
    let mut response = String::new();
    BufReader::new(stream)
        .read_line(&mut response)
        .map_err(|e| e.to_string())?;
    let answer: Option<String> = serde_json::from_str(&response).map_err(|e| e.to_string())?;
    let answer = answer.ok_or("Authentication cancelled")?;
    std::io::stdout()
        .write_all(answer.as_bytes())
        .map_err(|e| e.to_string())?;
    std::io::stdout()
        .write_all(b"\n")
        .map_err(|e| e.to_string())?;
    Ok(())
}
use std::io::Read;
