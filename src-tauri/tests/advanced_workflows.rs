use gik_core::git::{Action, RebaseStep, Repository};
use std::{
    fs,
    path::Path,
    sync::{atomic::AtomicBool, Arc},
    time::Instant,
};
use tempfile::TempDir;
fn git(path: &Path, args: &[&str]) -> String {
    let output = std::process::Command::new("git")
        .current_dir(path)
        .args(args)
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    String::from_utf8_lossy(&output.stdout).trim().into()
}
fn fixture() -> (TempDir, Repository) {
    let dir = tempfile::tempdir().unwrap();
    git(dir.path(), &["init", "-b", "dev"]);
    git(dir.path(), &["config", "user.name", "Fixture"]);
    git(
        dir.path(),
        &["config", "user.email", "fixture@example.test"],
    );
    git(dir.path(), &["config", "commit.gpgsign", "false"]);
    git(dir.path(), &["config", "core.autocrlf", "false"]);
    let repo = Repository::open(dir.path(), true).unwrap();
    (dir, repo)
}
fn commit(dir: &Path, repo: &Repository, value: &str) {
    fs::write(dir.join("file.txt"), value).unwrap();
    repo.execute(
        &Action::Stage {
            paths: vec!["file.txt".into()],
        },
        None,
    )
    .unwrap();
    repo.execute(
        &Action::Commit {
            message: value.into(),
            amend: false,
            sign: false,
        },
        None,
    )
    .unwrap();
}
fn confirmed(repo: &Repository, action: &Action) -> Result<String, String> {
    let (token, _) = repo.preview(action)?;
    repo.execute(action, Some(&token))
}

#[test]
fn worktrees_share_common_directory_and_can_be_removed_safely() {
    let (dir, repo) = fixture();
    commit(dir.path(), &repo, "initial");
    repo.execute(
        &Action::CreateBranch {
            name: "topic".into(),
            start: "HEAD".into(),
        },
        None,
    )
    .unwrap();
    let destination = tempfile::tempdir().unwrap();
    let path = destination.path().join("checkout");
    repo.execute(
        &Action::AddWorktree {
            path: path.to_string_lossy().into(),
            branch: "topic".into(),
        },
        None,
    )
    .unwrap();
    let other = Repository::open(&path, true).unwrap();
    assert_eq!(other.common, repo.common);
    assert_eq!(repo.entries("worktrees").unwrap().len(), 2);
    confirmed(
        &repo,
        &Action::RemoveWorktree {
            path: path.to_string_lossy().into(),
        },
    )
    .unwrap();
    assert!(!path.exists());
}
#[test]
fn interactive_rebase_drops_a_commit_and_preserves_the_rest() {
    let (dir, repo) = fixture();
    commit(dir.path(), &repo, "base");
    let base = repo.snapshot().unwrap().head;
    fs::write(dir.path().join("one.txt"), "one").unwrap();
    git(dir.path(), &["add", "one.txt"]);
    git(dir.path(), &["commit", "-m", "One"]);
    let first = repo.snapshot().unwrap().head;
    fs::write(dir.path().join("two.txt"), "two").unwrap();
    git(dir.path(), &["add", "two.txt"]);
    git(dir.path(), &["commit", "-m", "Two"]);
    let second = repo.snapshot().unwrap().head;
    confirmed(
        &repo,
        &Action::InteractiveRebase {
            base,
            steps: vec![
                RebaseStep {
                    oid: first,
                    action: "drop".into(),
                },
                RebaseStep {
                    oid: second,
                    action: "pick".into(),
                },
            ],
        },
    )
    .unwrap();
    assert!(!dir.path().join("one.txt").exists());
    assert!(dir.path().join("two.txt").exists());
    assert_eq!(repo.history(0, "", "").unwrap().len(), 2);
}
#[test]
fn remotes_push_fetch_pull_and_rejected_push_use_real_git() {
    let (dir, repo) = fixture();
    commit(dir.path(), &repo, "base");
    let remote = tempfile::tempdir().unwrap();
    git(remote.path(), &["init", "--bare", "-b", "dev"]);
    repo.execute(
        &Action::AddRemote {
            name: "origin".into(),
            url: remote.path().to_string_lossy().into(),
        },
        None,
    )
    .unwrap();
    git(dir.path(), &["push", "-u", "origin", "dev"]);
    commit(dir.path(), &repo, "next");
    repo.execute(&Action::Push { force: false }, None).unwrap();
    repo.execute(
        &Action::Fetch {
            remote: "origin".into(),
        },
        None,
    )
    .unwrap();
    repo.execute(&Action::Pull { rebase: false }, None).unwrap();
    assert_eq!(repo.snapshot().unwrap().upstream, "origin/dev");
    let clone = tempfile::tempdir().unwrap();
    let target = clone.path().join("copy");
    git(
        clone.path(),
        &[
            "clone",
            remote.path().to_str().unwrap(),
            target.to_str().unwrap(),
        ],
    );
    git(&target, &["config", "user.name", "Other"]);
    git(&target, &["config", "user.email", "other@example.test"]);
    fs::write(target.join("other.txt"), "remote").unwrap();
    git(&target, &["add", "other.txt"]);
    git(
        &target,
        &[
            "-c",
            "commit.gpgsign=false",
            "commit",
            "-m",
            "Remote advance",
        ],
    );
    git(&target, &["push"]);
    commit(dir.path(), &repo, "local divergence");
    assert!(repo.execute(&Action::Push { force: false }, None).is_err());
}
#[test]
fn hook_failure_is_returned_without_committing_index() {
    let (dir, repo) = fixture();
    commit(dir.path(), &repo, "base");
    let hook = repo.common.join("hooks/pre-commit");
    fs::write(&hook, "#!/bin/sh\necho GIK_HOOK_REJECTED >&2\nexit 1\n").unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&hook, fs::Permissions::from_mode(0o755)).unwrap();
    }
    fs::write(dir.path().join("file.txt"), "changed").unwrap();
    repo.execute(
        &Action::Stage {
            paths: vec!["file.txt".into()],
        },
        None,
    )
    .unwrap();
    let before = repo.snapshot().unwrap().head;
    let error = repo
        .execute(
            &Action::Commit {
                message: "Blocked".into(),
                amend: false,
                sign: false,
            },
            None,
        )
        .unwrap_err();
    assert!(error.contains("GIK_HOOK_REJECTED"));
    assert_eq!(before, repo.snapshot().unwrap().head);
    assert_eq!(repo.snapshot().unwrap().changes[0].index, "M");
}
#[test]
fn clean_preview_and_confirmation_remove_only_untracked_files() {
    let (dir, repo) = fixture();
    commit(dir.path(), &repo, "base");
    fs::write(dir.path().join("scratch.txt"), "scratch").unwrap();
    let (token, detail) = repo.preview(&Action::Clean).unwrap();
    assert!(detail.contains("scratch.txt"));
    repo.execute(&Action::Clean, Some(&token)).unwrap();
    assert!(!dir.path().join("scratch.txt").exists());
    assert!(dir.path().join("file.txt").exists());
}
#[test]
fn detached_head_compare_and_rename_status() {
    let (dir, repo) = fixture();
    commit(dir.path(), &repo, "base");
    let base = repo.snapshot().unwrap().head;
    commit(dir.path(), &repo, "second");
    assert!(repo
        .diff("", false, "HEAD", &base)
        .unwrap()
        .contains("+second"));
    git(dir.path(), &["mv", "file.txt", "renamed 日本語.txt"]);
    let change = repo.snapshot().unwrap().changes.remove(0);
    assert_eq!(change.original_path.as_deref(), Some("file.txt"));
    git(dir.path(), &["reset", "--hard"]);
    git(dir.path(), &["checkout", "--detach", "HEAD"]);
    assert_eq!(repo.snapshot().unwrap().branch, "Detached HEAD");
}
#[test]
fn cancellation_rejects_operations_without_mutation() {
    let (dir, mut repo) = fixture();
    commit(dir.path(), &repo, "base");
    repo.cancel = Arc::new(AtomicBool::new(true));
    assert!(repo
        .execute(
            &Action::CreateBranch {
                name: "cancelled".into(),
                start: "HEAD".into()
            },
            None
        )
        .is_err());
    assert!(!git(dir.path(), &["branch", "--list", "cancelled"]).contains("cancelled"));
}
#[test]
#[cfg(windows)]
fn cancellation_terminates_a_running_git_hook_tree() {
    use std::{sync::atomic::Ordering, time::Duration};
    let (dir, repo) = fixture();
    commit(dir.path(), &repo, "base");
    let before = repo.snapshot().unwrap().head;
    fs::write(dir.path().join("file.txt"), "changed").unwrap();
    repo.execute(
        &Action::Stage {
            paths: vec!["file.txt".into()],
        },
        None,
    )
    .unwrap();
    fs::write(
        repo.common.join("hooks/pre-commit"),
        "#!/bin/sh\nprintf started > .git/gik-hook-started\nsleep 15\n",
    )
    .unwrap();
    let runner = repo.clone();
    let worker = std::thread::spawn(move || {
        runner.execute(
            &Action::Commit {
                message: "Cancelled".into(),
                amend: false,
                sign: false,
            },
            None,
        )
    });
    let deadline = Instant::now() + Duration::from_secs(5);
    while !repo.common.join("gik-hook-started").exists() {
        assert!(Instant::now() < deadline, "Hook did not start");
        std::thread::sleep(Duration::from_millis(20));
    }
    let cancelled = Instant::now();
    repo.cancel.store(true, Ordering::Relaxed);
    assert!(worker.join().unwrap().unwrap_err().contains("cancelled"));
    assert!(cancelled.elapsed() < Duration::from_secs(5));
    assert_eq!(git(dir.path(), &["rev-parse", "HEAD"]), before);
}
#[test]
fn stash_drop_rejects_reindexed_entries_even_when_the_top_stash_is_unchanged() {
    let (dir, repo) = fixture();
    commit(dir.path(), &repo, "base");
    for message in ["one", "two", "three"] {
        fs::write(dir.path().join("file.txt"), message).unwrap();
        repo.execute(
            &Action::StashSave {
                message: message.into(),
                untracked: false,
            },
            None,
        )
        .unwrap();
    }
    let action = Action::StashDrop {
        name: "stash@{1}".into(),
    };
    let (token, _) = repo.preview(&action).unwrap();
    git(dir.path(), &["stash", "drop", "stash@{1}"]);
    assert!(repo.execute(&action, Some(&token)).is_err());
    assert_eq!(repo.entries("stashes").unwrap().len(), 2);
}
#[test]
fn submodule_status_remains_distinct_from_regular_files() {
    let (dir, repo) = fixture();
    commit(dir.path(), &repo, "base");
    let (sub, sub_repo) = fixture();
    commit(sub.path(), &sub_repo, "submodule");
    git(
        dir.path(),
        &[
            "-c",
            "protocol.file.allow=always",
            "submodule",
            "add",
            sub.path().to_str().unwrap(),
            "vendor",
        ],
    );
    git(dir.path(), &["commit", "-am", "Add submodule"]);
    fs::write(dir.path().join("vendor/file.txt"), "changed").unwrap();
    assert!(repo
        .snapshot()
        .unwrap()
        .changes
        .iter()
        .any(|c| c.path == "vendor" && c.submodule));
}

#[test]
#[ignore = "Explicit large-repository acceptance benchmark"]
fn benchmark_large_repository() {
    let (dir, repo) = fixture();
    let mut import = String::new();
    for i in 0..100_000 {
        import.push_str(&format!("commit refs/heads/dev\ncommitter Fixture <fixture@example.test> {} +0000\ndata 9\nCommit {:02}\n\n",1_700_000_000+i,i%100));
    }
    let start = Instant::now();
    repo.bytes(&["fast-import", "--quiet"], Some(import.as_bytes()))
        .unwrap();
    git(dir.path(), &["reset", "--hard"]);
    for i in 0..10_000 {
        fs::write(dir.path().join(format!("change-{i:05}.txt")), "change\n").unwrap();
    }
    let inspect = Instant::now();
    let snapshot = repo.snapshot().unwrap();
    let elapsed = inspect.elapsed();
    assert_eq!(snapshot.changes.len(), 10_000);
    assert_eq!(repo.history(0, "", "").unwrap().len(), 200);
    let paths = snapshot.changes.iter().map(|c| c.path.clone()).collect();
    repo.execute(&Action::Stage { paths }, None).unwrap();
    assert_eq!(
        repo.snapshot()
            .unwrap()
            .changes
            .iter()
            .filter(|c| c.index == "A")
            .count(),
        10_000
    );
    eprintln!(
        "100k commits / 10k paths: snapshot {:?}, complete fixture and staging {:?}",
        elapsed,
        start.elapsed()
    );
}
