use serde::{Deserialize, Serialize};
use std::{
    collections::hash_map::DefaultHasher,
    fs,
    hash::{Hash, Hasher},
    io::{Read, Write},
    path::{Component, Path, PathBuf},
    process::{Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    thread,
    time::Duration,
};

pub type Result<T> = std::result::Result<T, String>;
const OUTPUT_LIMIT: usize = 32 * 1024 * 1024;

#[derive(Clone)]
pub struct Repository {
    pub root: PathBuf,
    pub common: PathBuf,
    pub trusted: bool,
    pub cancel: Arc<AtomicBool>,
    pub askpass: Option<(String, String, String)>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Change {
    pub path: String,
    pub original_path: Option<String>,
    pub index: String,
    pub worktree: String,
    pub conflict: bool,
    pub submodule: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub root: String,
    pub branch: String,
    pub head: String,
    pub upstream: String,
    pub ahead: u32,
    pub behind: u32,
    pub changes: Vec<Change>,
    pub operation: Option<String>,
    pub bare: bool,
    pub token: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Commit {
    pub oid: String,
    pub parents: Vec<String>,
    pub subject: String,
    pub author: String,
    pub date: String,
    pub refs: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entry {
    pub name: String,
    pub detail: String,
    pub oid: String,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conflict {
    pub base: String,
    pub ours: String,
    pub theirs: String,
    pub binary: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RebaseStep {
    pub oid: String,
    pub action: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Action {
    Mergetool {
        path: String,
    },
    Stage {
        paths: Vec<String>,
    },
    Unstage {
        paths: Vec<String>,
    },
    ApplyPatch {
        patch: String,
        reverse: bool,
        cached: bool,
    },
    Commit {
        message: String,
        amend: bool,
        sign: bool,
    },
    Discard {
        paths: Vec<String>,
    },
    Clean,
    Switch {
        branch: String,
    },
    CreateBranch {
        name: String,
        start: String,
    },
    RenameBranch {
        old: String,
        name: String,
    },
    DeleteBranch {
        name: String,
        force: bool,
    },
    Upstream {
        branch: String,
        upstream: String,
    },
    Fetch {
        remote: String,
    },
    Pull {
        rebase: bool,
    },
    Push {
        force: bool,
    },
    Merge {
        target: String,
    },
    Rebase {
        target: String,
    },
    InteractiveRebase {
        base: String,
        steps: Vec<RebaseStep>,
    },
    CherryPick {
        target: String,
    },
    Revert {
        target: String,
    },
    Reset {
        target: String,
        mode: String,
    },
    Continue,
    Skip,
    Abort,
    StashSave {
        message: String,
        untracked: bool,
    },
    StashApply {
        name: String,
        pop: bool,
    },
    StashDrop {
        name: String,
    },
    CreateTag {
        name: String,
        target: String,
        message: String,
    },
    DeleteTag {
        name: String,
    },
    AddRemote {
        name: String,
        url: String,
    },
    RemoveRemote {
        name: String,
    },
    AddWorktree {
        path: String,
        branch: String,
    },
    RemoveWorktree {
        path: String,
    },
    Resolve {
        path: String,
        content: Option<String>,
        side: Option<String>,
    },
    Recover {
        oid: String,
        branch: String,
    },
}

impl Action {
    pub fn destructive(&self) -> bool {
        matches!(
            self,
            Self::Abort
                | Self::Discard { .. }
                | Self::Clean
                | Self::DeleteBranch { force: true, .. }
                | Self::Push { force: true }
                | Self::Reset { .. }
                | Self::Rebase { .. }
                | Self::InteractiveRebase { .. }
                | Self::StashDrop { .. }
                | Self::DeleteTag { .. }
                | Self::RemoveRemote { .. }
                | Self::RemoveWorktree { .. }
                | Self::Commit { amend: true, .. }
        )
    }
}

fn safe_command() -> Command {
    let mut command = Command::new("git");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    command
}

pub fn kill_process_tree(id: u32) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let _ = Command::new("taskkill.exe")
            .args(["/PID", &id.to_string(), "/T", "/F"])
            .creation_flags(0x08000000)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
    }
    #[cfg(not(windows))]
    {
        let _ = id;
    }
}

pub fn version() -> Result<String> {
    let output = safe_command()
        .arg("--version")
        .output()
        .map_err(|_| "Git was not found. Install Git for Windows and restart Gik.".to_string())?;
    if !output.status.success() {
        return Err("Git could not be started.".into());
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().into())
}

fn capture(mut reader: impl Read) -> std::io::Result<(Vec<u8>, bool)> {
    let mut bytes = Vec::new();
    let mut buffer = [0; 8192];
    let mut exceeded = false;
    loop {
        let n = reader.read(&mut buffer)?;
        if n == 0 {
            break;
        }
        if bytes.len() + n <= OUTPUT_LIMIT {
            bytes.extend_from_slice(&buffer[..n]);
        } else {
            exceeded = true;
        }
    }
    Ok((bytes, exceeded))
}

impl Repository {
    pub fn open(path: &Path, trusted: bool) -> Result<Self> {
        let installed = version()?;
        let numbers = installed
            .split_whitespace()
            .nth(2)
            .unwrap_or("")
            .split('.')
            .take(2)
            .map(|n| n.parse::<u32>().unwrap_or(0))
            .collect::<Vec<_>>();
        if numbers.len() != 2 || (numbers[0], numbers[1]) < (2, 31) {
            return Err(format!(
                "{installed} is unsupported. Install Git 2.31 or newer."
            ));
        }
        let root = path
            .canonicalize()
            .map_err(|e| format!("Cannot open folder: {e}"))?;
        reject_network(&root)?;
        let mut repo = Self {
            root,
            common: PathBuf::new(),
            trusted,
            cancel: Arc::new(AtomicBool::new(false)),
            askpass: None,
        };
        let bare = repo.text(&["rev-parse", "--is-bare-repository"])? == "true";
        if !bare {
            repo.root = PathBuf::from(repo.text(&["rev-parse", "--show-toplevel"])?)
                .canonicalize()
                .map_err(|e| e.to_string())?;
        }
        repo.common = PathBuf::from(repo.text(&[
            "rev-parse",
            "--path-format=absolute",
            "--git-common-dir",
        ])?)
        .canonicalize()
        .map_err(|e| e.to_string())?;
        Ok(repo)
    }

    pub fn bytes(&self, args: &[&str], input: Option<&[u8]>) -> Result<Vec<u8>> {
        if self.cancel.load(Ordering::Relaxed) {
            return Err("Operation cancelled. Refresh repository state before continuing.".into());
        }
        let mut command = safe_command();
        command.current_dir(&self.root).args([
            "--no-pager",
            "--literal-pathspecs",
            "-c",
            "core.fsmonitor=false",
            "-c",
            "protocol.ext.allow=never",
        ]);
        if !self.trusted {
            command.args([
                "-c",
                "core.hooksPath=",
                "-c",
                "core.sshCommand=ssh",
                "-c",
                "credential.helper=",
                "-c",
                "core.attributesFile=",
            ]);
        }
        command
            .args(args)
            .env("GIT_OPTIONAL_LOCKS", "0")
            .env("GIT_TERMINAL_PROMPT", "0")
            .env("GIT_EDITOR", "true")
            .env("GIT_MERGE_AUTOEDIT", "no")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        if let Some((exe, address, secret)) = &self.askpass {
            command
                .env("GIT_ASKPASS", exe)
                .env("SSH_ASKPASS", exe)
                .env("SSH_ASKPASS_REQUIRE", "force")
                .env("DISPLAY", "gik:0")
                .env("GIK_ASKPASS_ADDR", address)
                .env("GIK_ASKPASS_SECRET", secret);
        }
        let mut child = command
            .spawn()
            .map_err(|e| format!("Cannot start Git: {e}"))?;
        let stdout = child.stdout.take().ok_or("Missing Git output")?;
        let stderr = child.stderr.take().ok_or("Missing Git error output")?;
        let out = thread::spawn(move || capture(stdout));
        let err = thread::spawn(move || capture(stderr));
        let mut stdin = child.stdin.take().ok_or("Missing Git input")?;
        let data = input.map(|v| v.to_vec());
        let writer = thread::spawn(move || {
            if let Some(data) = data {
                stdin.write_all(&data)?;
            }
            std::io::Result::Ok(())
        });
        let status = loop {
            if self.cancel.load(Ordering::Relaxed) {
                kill_process_tree(child.id());
                let _ = child.kill();
            }
            match child.try_wait().map_err(|e| e.to_string())? {
                Some(status) => break status,
                None => thread::sleep(Duration::from_millis(20)),
            }
        };
        let (stdout, too_big) = out
            .join()
            .map_err(|_| "Git output reader failed")?
            .map_err(|e| e.to_string())?;
        let (stderr, _) = err
            .join()
            .map_err(|_| "Git error reader failed")?
            .map_err(|e| e.to_string())?;
        let write_result = writer.join().map_err(|_| "Git input writer failed")?;
        if self.cancel.load(Ordering::Relaxed) {
            return Err("Operation cancelled. Git may have changed files; refresh and inspect the operation state.".into());
        }
        if !status.success()
            && !(args.first() == Some(&"diff")
                && args.contains(&"--no-index")
                && status.code() == Some(1))
        {
            return Err(String::from_utf8_lossy(&stderr).trim().to_string());
        }
        write_result.map_err(|e| e.to_string())?;
        if too_big {
            return Err(
                "Git output exceeds 32 MiB. Narrow the selection or use the terminal.".into(),
            );
        }
        Ok(stdout)
    }
    pub fn text(&self, args: &[&str]) -> Result<String> {
        Ok(String::from_utf8_lossy(&self.bytes(args, None)?)
            .trim_end_matches(['\r', '\n'])
            .into())
    }
    fn git_path(&self, name: &str) -> Result<PathBuf> {
        Ok(PathBuf::from(self.text(&[
            "rev-parse",
            "--path-format=absolute",
            "--git-path",
            name,
        ])?))
    }
    pub fn operation(&self) -> Result<Option<String>> {
        for (file, name) in [
            ("rebase-merge", "rebase"),
            ("rebase-apply", "rebase"),
            ("MERGE_HEAD", "merge"),
            ("CHERRY_PICK_HEAD", "cherry-pick"),
            ("REVERT_HEAD", "revert"),
        ] {
            if self.git_path(file)?.exists() {
                return Ok(Some(name.into()));
            }
        }
        Ok(None)
    }
    pub fn snapshot(&self) -> Result<Snapshot> {
        let bare = self.text(&["rev-parse", "--is-bare-repository"])? == "true";
        let head = self
            .text(&["rev-parse", "--verify", "HEAD"])
            .unwrap_or_default();
        let branch = self
            .text(&["symbolic-ref", "--quiet", "--short", "HEAD"])
            .unwrap_or_else(|_| "Detached HEAD".into());
        let raw = if bare {
            vec![]
        } else {
            self.bytes(
                &[
                    "status",
                    "--porcelain=v2",
                    "-z",
                    "--branch",
                    "--untracked-files=all",
                    "--ignore-submodules=none",
                ],
                None,
            )?
        };
        let (changes, upstream, ahead, behind) = parse_status(&raw)?;
        let mut hash = DefaultHasher::new();
        raw.hash(&mut hash);
        head.hash(&mut hash);
        let refs = self
            .bytes(&["show-ref", "--head"], None)
            .unwrap_or_default();
        refs.hash(&mut hash);
        self.bytes(&["stash", "list", "--format=%H"], None)
            .unwrap_or_default()
            .hash(&mut hash);
        if !bare {
            self.bytes(
                &["diff", "--no-ext-diff", "--no-textconv", "--binary"],
                None,
            )?
            .hash(&mut hash);
            self.bytes(
                &[
                    "diff",
                    "--cached",
                    "--no-ext-diff",
                    "--no-textconv",
                    "--binary",
                ],
                None,
            )?
            .hash(&mut hash);
            for change in changes.iter().filter(|c| c.index == "?") {
                let path = self.file(&change.path)?;
                if fs::symlink_metadata(&path).is_ok_and(|m| m.file_type().is_symlink()) {
                    fs::read_link(&path)
                        .map_err(|e| e.to_string())?
                        .hash(&mut hash);
                } else if path.is_file() {
                    let mut file = fs::File::open(path).map_err(|e| e.to_string())?;
                    let mut buf = [0; 8192];
                    loop {
                        let n = file.read(&mut buf).map_err(|e| e.to_string())?;
                        if n == 0 {
                            break;
                        }
                        buf[..n].hash(&mut hash);
                    }
                }
            }
        }
        let operation = self.operation()?;
        operation.hash(&mut hash);
        Ok(Snapshot {
            root: self.root.to_string_lossy().into(),
            branch,
            head,
            upstream,
            ahead,
            behind,
            changes,
            operation,
            bare,
            token: format!("{:x}", hash.finish()),
        })
    }
    pub fn file(&self, path: &str) -> Result<PathBuf> {
        let relative = Path::new(path);
        if path.is_empty()
            || path.contains('\0')
            || relative
                .components()
                .any(|c| !matches!(c, Component::Normal(_)))
            || path.contains(':')
            || path
                .split(['/', '\\'])
                .any(|p| p.eq_ignore_ascii_case(".git"))
        {
            return Err("Invalid repository-relative file path".into());
        }
        let joined = self.root.join(relative);
        let mut ancestor = joined.parent().ok_or("Invalid file path")?;
        while !ancestor.exists() {
            ancestor = ancestor.parent().ok_or("Invalid file path")?;
        }
        let real = ancestor.canonicalize().map_err(|e| e.to_string())?;
        if !real.starts_with(&self.root) {
            return Err("File points outside the repository".into());
        }
        Ok(joined)
    }
    fn object(&self, value: &str) -> Result<String> {
        if value.starts_with('-') || value.contains('\0') {
            return Err("Invalid revision".into());
        }
        self.text(&[
            "rev-parse",
            "--verify",
            "--end-of-options",
            &format!("{value}^{{commit}}"),
        ])
    }
    fn branch(&self, value: &str) -> Result<()> {
        if value.starts_with('-') || value.contains('\0') || value == "HEAD" {
            return Err("Invalid branch name".into());
        }
        self.text(&["check-ref-format", "--branch", value])
            .map(|_| ())
    }
    pub fn history(&self, skip: usize, search: &str, branch: &str) -> Result<Vec<Commit>> {
        let skip = skip.to_string();
        let mut args = vec![
            "log",
            "--topo-order",
            "--date=iso-strict",
            "--format=%H%x00%P%x00%s%x00%an%x00%aI%x00%D%x00",
            "--max-count=200",
            "--skip",
            &skip,
        ];
        if search.len() > 512 {
            return Err("Search is too long".into());
        }
        if !search.is_empty() {
            args.extend(["--fixed-strings", "--regexp-ignore-case", "--grep", search]);
        }
        let revision;
        if branch.is_empty() {
            args.push("--all");
        } else {
            revision = self.object(branch)?;
            args.push(&revision);
        }
        args.push("--");
        let raw = self.bytes(&args, None)?;
        Ok(raw
            .split(|b| *b == 0)
            .collect::<Vec<_>>()
            .chunks(6)
            .filter(|p| p.len() == 6)
            .map(|p| Commit {
                oid: String::from_utf8_lossy(p[0]).trim().into(),
                parents: String::from_utf8_lossy(p[1])
                    .split_whitespace()
                    .map(String::from)
                    .collect(),
                subject: String::from_utf8_lossy(p[2]).into(),
                author: String::from_utf8_lossy(p[3]).into(),
                date: String::from_utf8_lossy(p[4]).into(),
                refs: String::from_utf8_lossy(p[5]).into(),
            })
            .collect())
    }
    pub fn entries(&self, kind: &str) -> Result<Vec<Entry>> {
        let text = match kind {
            "branches" => self.text(&[
                "for-each-ref",
                "--format=%(refname:short)%00%(upstream:short)%00%(objectname)",
                "refs/heads",
                "refs/remotes",
            ])?,
            "tags" => self.text(&[
                "for-each-ref",
                "--format=%(refname:short)%00%(subject)%00%(objectname)",
                "refs/tags",
            ])?,
            "stashes" => self.text(&["stash", "list", "--format=%gd%x00%s%x00%H"])?,
            "remotes" => {
                let names = self.text(&["remote"])?;
                let mut entries = vec![];
                for name in names.lines() {
                    entries.push(Entry {
                        name: name.into(),
                        detail: self.text(&["remote", "get-url", name])?,
                        oid: String::new(),
                    });
                }
                return Ok(entries);
            }
            "worktrees" => {
                let raw = self.bytes(&["worktree", "list", "--porcelain", "-z"], None)?;
                let mut entries = vec![];
                let mut current: Option<Entry> = None;
                for field in raw.split(|b| *b == 0) {
                    let s = String::from_utf8_lossy(field);
                    if let Some(p) = s.strip_prefix("worktree ") {
                        if let Some(e) = current.take() {
                            entries.push(e);
                        }
                        current = Some(Entry {
                            name: p.into(),
                            detail: String::new(),
                            oid: String::new(),
                        });
                    } else if let Some(e) = current.as_mut() {
                        if let Some(b) = s.strip_prefix("branch ") {
                            e.detail = b.into();
                        }
                        if let Some(h) = s.strip_prefix("HEAD ") {
                            e.oid = h.into();
                        }
                    }
                }
                if let Some(e) = current {
                    entries.push(e);
                }
                return Ok(entries);
            }
            "recovery" => self.text(&["reflog", "--max-count=200", "--format=%gd%x00%gs%x00%H"])?,
            _ => return Err("Unknown repository view".into()),
        };
        Ok(text
            .lines()
            .filter_map(|line| {
                let p: Vec<_> = line.split('\0').collect();
                if p.len() != 3 {
                    return None;
                }
                Some(Entry {
                    name: p[0].into(),
                    detail: p[1].into(),
                    oid: p[2].into(),
                })
            })
            .collect())
    }
    fn diff_text(&self, args: &[&str]) -> Result<String> {
        let bytes = self.bytes(args, None)?;
        Ok(String::from_utf8(bytes).unwrap_or_else(|_| {
            "Binary file or non-UTF-8 text. Stage the whole file or use your editor.".into()
        }))
    }
    pub fn diff(&self, path: &str, staged: bool, revision: &str, compare: &str) -> Result<String> {
        if !path.is_empty() {
            self.file(path)?;
        }
        if !revision.is_empty() {
            let oid = self.object(revision)?;
            if !compare.is_empty() {
                let base = self.object(compare)?;
                let mut args = vec!["diff", "--no-ext-diff", "--no-textconv", &base, &oid, "--"];
                if !path.is_empty() {
                    args.push(path);
                }
                return self.diff_text(&args);
            }
            let mut args = vec![
                "show",
                "--format=fuller",
                "--no-ext-diff",
                "--no-textconv",
                &oid,
                "--",
            ];
            if !path.is_empty() {
                args.push(path);
            }
            return self.diff_text(&args);
        }
        if !path.is_empty()
            && !staged
            && self
                .snapshot()?
                .changes
                .iter()
                .any(|c| c.path == path && c.index == "?")
        {
            let file = self.file(path)?;
            if fs::symlink_metadata(&file).is_ok_and(|m| m.file_type().is_symlink()) {
                return Ok(format!(
                    "Symbolic link → {}",
                    fs::read_link(file).map_err(|e| e.to_string())?.display()
                ));
            }
            let bytes = fs::read(file).map_err(|e| e.to_string())?;
            if bytes.len() > 2 * 1024 * 1024 {
                return Err("File exceeds 2 MiB. Open it in your editor.".into());
            }
            if bytes.contains(&0) {
                return Ok("Binary file (untracked)".into());
            }
            return self.diff_text(&[
                "diff",
                "--no-index",
                "--no-ext-diff",
                "--no-textconv",
                "--",
                "/dev/null",
                path,
            ]);
        }
        let mut args = vec!["diff", "--no-ext-diff", "--no-textconv"];
        if staged {
            args.push("--cached");
        }
        args.push("--");
        if !path.is_empty() {
            args.push(path);
        }
        self.diff_text(&args)
    }
    pub fn file_history(&self, path: &str) -> Result<String> {
        self.file(path)?;
        self.text(&[
            "log",
            "--follow",
            "--max-count=100",
            "--format=%h %ad %s",
            "--date=short",
            "--",
            path,
        ])
    }
    pub fn blame(&self, path: &str) -> Result<String> {
        self.file(path)?;
        self.text(&["blame", "--date=short", "--", path])
    }
    fn stage_bytes(&self, path: &str, stage: u8) -> Result<Option<Vec<u8>>> {
        let records = self.bytes(&["ls-files", "--unmerged", "-z", "--", path], None)?;
        let present = records.split(|b| *b == 0).any(|record| {
            record
                .split(|b| *b == b'\t')
                .next()
                .is_some_and(|header| header.ends_with(&[b' ', b'0' + stage]))
        });
        if present {
            Ok(Some(
                self.bytes(&["show", &format!(":{stage}:{path}")], None)?,
            ))
        } else {
            Ok(None)
        }
    }
    pub fn conflict(&self, path: &str) -> Result<Conflict> {
        self.file(path)?;
        let base = self.stage_bytes(path, 1)?.unwrap_or_default();
        let ours = self.stage_bytes(path, 2)?.unwrap_or_default();
        let theirs = self.stage_bytes(path, 3)?.unwrap_or_default();
        let binary = [&base, &ours, &theirs]
            .iter()
            .any(|b| b.contains(&0) || std::str::from_utf8(b).is_err());
        Ok(Conflict {
            base: String::from_utf8_lossy(&base).into(),
            ours: String::from_utf8_lossy(&ours).into(),
            theirs: String::from_utf8_lossy(&theirs).into(),
            binary,
        })
    }
    pub fn preview(&self, action: &Action) -> Result<(String, String)> {
        let snapshot = self.snapshot()?;
        let detail=match action {
            Action::Discard{paths}=>{for p in paths{self.file(p)?;}format!("Discard unstaged changes in {}. Untracked files will be deleted. Uncommitted content may not be recoverable.",paths.join(", "))},
            Action::Clean=>format!("Permanently remove these untracked files and folders:\n{}",self.text(&["clean","-nd"])?),
            Action::Reset{target,mode}=>format!("Reset {} to {} ({mode}). Hard reset discards tracked working-tree and index changes.",snapshot.branch,self.object(target)?),
            _=>format!("Apply this operation to {} on {}:\n{action:?}\nHistory or repository references may change.",snapshot.root,snapshot.branch)
        };
        Ok((snapshot.token, detail))
    }
    pub fn execute(&self, action: &Action, expected: Option<&str>) -> Result<String> {
        if !self.trusted {
            return Err(
                "Trust this repository before running Git operations, hooks, or tools.".into(),
            );
        }
        if action.destructive() && expected != Some(self.snapshot()?.token.as_str()) {
            return Err(
                "Repository changed or confirmation is missing. Review a fresh preview.".into(),
            );
        }
        let run = |args: &[&str]| self.text(args);
        match action {
            Action::Mergetool { path } => {
                self.file(path)?;
                self.text(&["config", "--get", "merge.tool"]).map_err(|_| {
                    "Configure merge.tool in Git before opening an external merge tool"
                })?;
                run(&["mergetool", "--no-prompt", "--", path])
            }
            Action::Stage { paths } | Action::Unstage { paths } => {
                if paths.is_empty() {
                    return Err("Select at least one file".into());
                }
                for p in paths {
                    self.file(p)?;
                }
                let mut args = if matches!(action, Action::Stage { .. }) {
                    vec!["add"]
                } else if self.object("HEAD").is_ok() {
                    vec!["restore", "--staged"]
                } else {
                    vec!["rm", "--cached"]
                };
                args.extend(["--pathspec-from-file=-", "--pathspec-file-nul"]);
                let input = paths
                    .iter()
                    .flat_map(|p| p.bytes().chain(std::iter::once(0)))
                    .collect::<Vec<_>>();
                self.bytes(&args, Some(&input))
                    .map(|b| String::from_utf8_lossy(&b).into())
            }
            Action::ApplyPatch {
                patch,
                reverse,
                cached,
            } => {
                if patch.len() > 2 * 1024 * 1024 {
                    return Err("Patch exceeds 2 MiB".into());
                }
                let mut args = vec!["apply", "--recount", "--whitespace=nowarn"];
                if *reverse {
                    args.push("--reverse");
                }
                if *cached {
                    args.push("--cached");
                }
                let mut check = args.clone();
                check.push("--check");
                self.bytes(&check, Some(patch.as_bytes()))?;
                self.bytes(&args, Some(patch.as_bytes()))
                    .map(|b| String::from_utf8_lossy(&b).into())
            }
            Action::Commit {
                message,
                amend,
                sign,
            } => {
                if message.trim().is_empty() {
                    return Err("Write a commit message".into());
                }
                let mut args = vec!["commit", "-F", "-"];
                if *amend {
                    args.push("--amend");
                }
                if *sign {
                    args.push("-S");
                }
                self.bytes(&args, Some(message.as_bytes()))
                    .map(|b| String::from_utf8_lossy(&b).into())
            }
            Action::Discard { paths } => {
                let snapshot = self.snapshot()?;
                for p in paths {
                    let file = self.file(p)?;
                    let change = snapshot
                        .changes
                        .iter()
                        .find(|c| c.path == *p)
                        .ok_or("File is no longer changed")?;
                    if change.conflict {
                        return Err("Resolve conflicts explicitly".into());
                    }
                    if change.index == "?" {
                        fs::remove_file(file).map_err(|e| e.to_string())?;
                    } else {
                        run(&["restore", "--worktree", "--", p])?;
                    }
                }
                Ok("Unstaged changes discarded".into())
            }
            Action::Clean => run(&["clean", "-fd"]),
            Action::Switch { branch } => {
                self.branch(branch)?;
                if self
                    .text(&["show-ref", "--verify", &format!("refs/heads/{branch}")])
                    .is_err()
                    && self
                        .text(&["show-ref", "--verify", &format!("refs/remotes/{branch}")])
                        .is_ok()
                {
                    run(&["switch", "--track", branch])
                } else {
                    run(&["switch", branch])
                }
            }
            Action::CreateBranch { name, start } => {
                self.branch(name)?;
                let oid = self.object(start)?;
                run(&["branch", name, &oid])
            }
            Action::RenameBranch { old, name } => {
                self.branch(old)?;
                self.branch(name)?;
                run(&["branch", "-m", old, name])
            }
            Action::DeleteBranch { name, force } => {
                self.branch(name)?;
                run(&["branch", if *force { "-D" } else { "-d" }, name])
            }
            Action::Upstream { branch, upstream } => {
                self.branch(branch)?;
                self.branch(upstream)?;
                run(&["branch", "--set-upstream-to", upstream, branch])
            }
            Action::Fetch { remote } => {
                self.remote(remote)?;
                run(&["fetch", "--prune", remote])
            }
            Action::Pull { rebase } => {
                run(&["pull", if *rebase { "--rebase" } else { "--ff-only" }])
            }
            Action::Push { force } => {
                if *force {
                    run(&["push", "--force-with-lease"])
                } else {
                    run(&["push"])
                }
            }
            Action::Merge { target } => {
                let oid = self.object(target)?;
                run(&["merge", "--no-edit", &oid])
            }
            Action::Rebase { target } => {
                let oid = self.object(target)?;
                run(&["rebase", &oid])
            }
            Action::InteractiveRebase { base, steps } => self.interactive_rebase(base, steps),
            Action::CherryPick { target } => {
                let oid = self.object(target)?;
                run(&["cherry-pick", &oid])
            }
            Action::Revert { target } => {
                let oid = self.object(target)?;
                run(&["revert", "--no-edit", &oid])
            }
            Action::Reset { target, mode } => {
                if !["soft", "mixed", "hard"].contains(&mode.as_str()) {
                    return Err("Invalid reset mode".into());
                }
                let oid = self.object(target)?;
                run(&["reset", &format!("--{mode}"), &oid])
            }
            Action::Continue | Action::Skip | Action::Abort => {
                let op = self.operation()?.ok_or("No operation is in progress")?;
                let flag = match action {
                    Action::Continue => "--continue",
                    Action::Skip => "--skip",
                    _ => "--abort",
                };
                if op == "merge" && flag == "--skip" {
                    return Err("Merge cannot be skipped".into());
                }
                run(&[&op, flag])
            }
            Action::StashSave { message, untracked } => {
                let mut args = vec!["stash", "push", "-m", message];
                if *untracked {
                    args.push("--include-untracked");
                }
                run(&args)
            }
            Action::StashApply { name, pop } => {
                self.stash(name)?;
                run(&["stash", if *pop { "pop" } else { "apply" }, name])
            }
            Action::StashDrop { name } => {
                self.stash(name)?;
                run(&["stash", "drop", name])
            }
            Action::CreateTag {
                name,
                target,
                message,
            } => {
                self.tag(name)?;
                let oid = self.object(target)?;
                if message.is_empty() {
                    run(&["tag", name, &oid])
                } else {
                    run(&["tag", "-a", name, &oid, "-m", message])
                }
            }
            Action::DeleteTag { name } => {
                self.tag(name)?;
                run(&["tag", "-d", name])
            }
            Action::AddRemote { name, url } => {
                self.remote(name)?;
                validate_url(url)?;
                run(&["remote", "add", name, url])
            }
            Action::RemoveRemote { name } => {
                self.remote(name)?;
                run(&["remote", "remove", name])
            }
            Action::AddWorktree { path, branch } => {
                if !Path::new(path).is_absolute() {
                    return Err("Choose an absolute local worktree path".into());
                }
                reject_network(Path::new(path))?;
                self.branch(branch)?;
                run(&["worktree", "add", "--", path, branch])
            }
            Action::RemoveWorktree { path } => {
                let target = Path::new(path).canonicalize().map_err(|e| e.to_string())?;
                if target == self.root {
                    return Err("Cannot remove the active worktree".into());
                }
                let registered = self
                    .entries("worktrees")?
                    .iter()
                    .any(|e| Path::new(&e.name).canonicalize().ok().as_ref() == Some(&target));
                if !registered {
                    return Err("Not a registered worktree".into());
                }
                run(&["worktree", "remove", "--", path])
            }
            Action::Resolve {
                path,
                content,
                side,
            } => {
                let file = self.file(path)?;
                if fs::symlink_metadata(&file).is_ok_and(|m| m.file_type().is_symlink()) {
                    return Err("Resolve symbolic-link conflicts in the terminal".into());
                }
                if !self
                    .snapshot()?
                    .changes
                    .iter()
                    .any(|c| c.path == *path && c.conflict)
                {
                    return Err("File is not conflicted".into());
                }
                if let Some(side) = side {
                    if !["ours", "theirs"].contains(&side.as_str()) {
                        return Err("Invalid conflict side".into());
                    }
                    let stage = if side == "ours" { 2 } else { 3 };
                    match self.stage_bytes(path, stage)? {
                        Some(bytes) => fs::write(file, bytes).map_err(|e| e.to_string())?,
                        None => {
                            if file.exists() {
                                fs::remove_file(file).map_err(|e| e.to_string())?;
                            }
                        }
                    }
                } else {
                    let content = content.as_ref().ok_or("Provide a merge result")?;
                    if content.lines().any(|l| {
                        l.starts_with("<<<<<<< ") || l == "=======" || l.starts_with(">>>>>>> ")
                    }) {
                        return Err("Resolve the remaining conflict markers first".into());
                    }
                    fs::write(file, content).map_err(|e| e.to_string())?;
                }
                run(&["add", "--", path])
            }
            Action::Recover { oid, branch } => {
                self.branch(branch)?;
                let oid = self.object(oid)?;
                run(&["branch", branch, &oid])
            }
        }
    }
    fn remote(&self, name: &str) -> Result<()> {
        if name.is_empty()
            || name.starts_with('-')
            || name.chars().any(|c| c.is_whitespace() || c.is_control())
            || name.contains('/')
        {
            Err("Invalid remote name".into())
        } else {
            Ok(())
        }
    }
    fn stash(&self, name: &str) -> Result<()> {
        let entries = self.entries("stashes")?;
        if entries.iter().any(|e| e.name == name) {
            Ok(())
        } else {
            Err("Stash no longer exists".into())
        }
    }
    fn tag(&self, name: &str) -> Result<()> {
        if name.starts_with('-') {
            return Err("Invalid tag name".into());
        }
        self.text(&["check-ref-format", &format!("refs/tags/{name}")])
            .map(|_| ())
    }
    fn interactive_rebase(&self, base: &str, steps: &[RebaseStep]) -> Result<String> {
        let base = self.object(base)?;
        let commits = self.text(&[
            "rev-list",
            "--reverse",
            "--no-merges",
            &format!("{base}..HEAD"),
        ])?;
        let expected: Vec<_> = commits.lines().collect();
        if expected.len() != steps.len() || expected.len() > 200 {
            return Err("Rebase supports up to 200 commits; refresh the plan".into());
        }
        let mut seen = std::collections::HashSet::new();
        let mut todo = String::new();
        for (i, step) in steps.iter().enumerate() {
            if !["pick", "reword", "edit", "squash", "fixup", "drop"]
                .contains(&step.action.as_str())
                || !expected.contains(&step.oid.as_str())
                || !seen.insert(step.oid.clone())
            {
                return Err("Invalid rebase plan".into());
            }
            if i == 0 && ["squash", "fixup"].contains(&step.action.as_str()) {
                return Err("First commit cannot squash or fixup".into());
            }
            if step.action == "reword" {
                return Err("Use edit and amend to reword commits in the visual workflow".into());
            }
            todo.push_str(&format!("{} {}\n", step.action, step.oid));
        }
        let merges = self.text(&["rev-list", "--merges", &format!("{base}..HEAD")])?;
        if !merges.is_empty() {
            return Err("This range contains merges. Use terminal rebase --rebase-merges.".into());
        }
        let todo_path = self.git_path("gik-rebase-todo")?;
        fs::write(&todo_path, &todo).map_err(|e| e.to_string())?;
        let editor_path = self.git_path("gik-sequence-editor.sh")?;
        // The script contains no repository data or user text; Git supplies the destination argument.
        fs::write(
            &editor_path,
            "#!/bin/sh\ncat \"$GIK_REBASE_TODO\" > \"$1\"\n",
        )
        .map_err(|e| e.to_string())?;
        let editor = editor_path.to_string_lossy().replace('\\', "/");
        if editor.contains('\'') {
            return Err("Repository path contains a quote; use terminal rebase".into());
        }
        // Per-command config avoids changing repository settings or the process environment.
        let script = format!("sh '{}'", editor);
        // Git's sequence editor receives a simple script with the source path as its first argument.
        let source = todo_path.to_string_lossy().replace('\\', "/");
        if source.contains('\'') {
            return Err("Repository path contains a quote".into());
        }
        fs::write(
            &editor_path,
            format!("#!/bin/sh\ncat '{}' > \"$1\"\n", source),
        )
        .map_err(|e| e.to_string())?;
        let result = self.text(&[
            "-c",
            &format!("sequence.editor={script}"),
            "rebase",
            "-i",
            &base,
        ]);
        let _ = fs::remove_file(todo_path);
        let _ = fs::remove_file(editor_path);
        result
    }
}

pub fn reject_network(path: &Path) -> Result<()> {
    let p = path.to_string_lossy();
    if (p.starts_with("\\\\") && !p.starts_with("\\\\?\\"))
        || p.starts_with("\\\\?\\UNC\\")
        || p.starts_with("//")
    {
        Err("Network and WSL repositories are not supported in this release".into())
    } else {
        Ok(())
    }
}
pub fn validate_url(url: &str) -> Result<()> {
    if url.is_empty()
        || url.starts_with('-')
        || url.contains('\0')
        || url.contains("::")
        || url.chars().any(|c| c.is_control())
    {
        return Err("Invalid Git remote URL".into());
    }
    if let Some((scheme, _)) = url.split_once("://") {
        if !["https", "http", "ssh", "git", "file"].contains(&scheme) {
            return Err("Unsupported Git transport".into());
        }
    }
    Ok(())
}

pub fn parse_status(raw: &[u8]) -> Result<(Vec<Change>, String, u32, u32)> {
    let mut changes = vec![];
    let mut upstream = String::new();
    let (mut ahead, mut behind) = (0, 0);
    let mut fields = raw.split(|b| *b == 0);
    while let Some(field) = fields.next() {
        if field.is_empty() {
            continue;
        }
        let s = std::str::from_utf8(field)
            .map_err(|_| "A path is not valid UTF-8; use the terminal for this repository")?;
        if let Some(value) = s.strip_prefix("# branch.upstream ") {
            upstream = value.into();
            continue;
        }
        if let Some(value) = s.strip_prefix("# branch.ab ") {
            let mut p = value.split_whitespace();
            ahead = p
                .next()
                .unwrap_or("+0")
                .trim_start_matches('+')
                .parse()
                .unwrap_or(0);
            behind = p
                .next()
                .unwrap_or("-0")
                .trim_start_matches('-')
                .parse()
                .unwrap_or(0);
            continue;
        }
        let (count, conflict) = match s.as_bytes()[0] {
            b'1' => (9, false),
            b'2' => (10, false),
            b'u' => (11, true),
            b'?' => {
                changes.push(Change {
                    path: s[2..].into(),
                    original_path: None,
                    index: "?".into(),
                    worktree: "?".into(),
                    conflict: false,
                    submodule: false,
                });
                continue;
            }
            _ => continue,
        };
        let p: Vec<_> = s.splitn(count, ' ').collect();
        if p.len() != count || p[1].len() != 2 {
            return Err("Invalid Git status record".into());
        }
        let original_path = if s.starts_with('2') {
            Some(
                std::str::from_utf8(fields.next().ok_or("Missing original rename path")?)
                    .map_err(|_| "Invalid rename path")?
                    .into(),
            )
        } else {
            None
        };
        changes.push(Change {
            path: p[count - 1].into(),
            original_path,
            index: p[1][..1].into(),
            worktree: p[1][1..].into(),
            conflict,
            submodule: p[2].starts_with('S'),
        });
    }
    Ok((changes, upstream, ahead, behind))
}
