use gik_core::git::{parse_status, Action, Repository};
use std::{fs, path::Path};
use tempfile::TempDir;
#[test]
fn friendly_paths_leave_canonical_storage_untouched() {
    let path = std::path::PathBuf::from(r"\\?\C:\Dev\my repo");
    assert_eq!(
        gik_core::git::display_path(&path),
        std::path::PathBuf::from(r"C:\Dev\my repo")
    );
    assert!(path.to_string_lossy().starts_with(r"\\?\"));
}

fn run(path: &Path, args: &[&str]) -> String {
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
    run(dir.path(), &["init", "-b", "dev"]);
    run(dir.path(), &["config", "user.name", "Fixture"]);
    run(
        dir.path(),
        &["config", "user.email", "fixture@example.test"],
    );
    run(dir.path(), &["config", "commit.gpgsign", "false"]);
    run(dir.path(), &["config", "core.autocrlf", "false"]);
    let repo = Repository::open(dir.path(), true).unwrap();
    (dir, repo)
}
fn commit(repo: &Repository, message: &str) {
    repo.execute(
        &Action::Stage {
            paths: vec!["hello.txt".into()],
        },
        None,
    )
    .unwrap();
    repo.execute(
        &Action::Commit {
            message: message.into(),
            amend: false,
            sign: false,
        },
        None,
    )
    .unwrap();
}

#[test]
fn status_preserves_spaces_unicode_and_rename_source() {
    let raw=b"# branch.upstream origin/dev\0# branch.ab +2 -1\02 R. N... 100644 100644 100644 abc def R100 new file.txt\0old file.txt\0? notes with spaces.txt\0";
    let (changes, upstream, ahead, behind) = parse_status(raw).unwrap();
    assert_eq!(changes[0].path, "new file.txt");
    assert_eq!(changes[0].original_path.as_deref(), Some("old file.txt"));
    assert_eq!(changes[1].path, "notes with spaces.txt");
    assert_eq!((upstream, ahead, behind), ("origin/dev".into(), 2, 1));
}
#[test]
fn empty_repo_stage_commit_unstage_and_history() {
    let (dir, repo) = fixture();
    assert!(repo.snapshot().unwrap().head.is_empty());
    fs::write(dir.path().join("hello.txt"), "hello\n").unwrap();
    commit(&repo, "First commit");
    assert!(repo.snapshot().unwrap().changes.is_empty());
    assert_eq!(
        repo.history(0, "First", "").unwrap()[0].subject,
        "First commit"
    );
    fs::write(dir.path().join("hello.txt"), "next\n").unwrap();
    repo.execute(
        &Action::Stage {
            paths: vec!["hello.txt".into()],
        },
        None,
    )
    .unwrap();
    repo.execute(
        &Action::Unstage {
            paths: vec!["hello.txt".into()],
        },
        None,
    )
    .unwrap();
    assert_eq!(repo.snapshot().unwrap().changes[0].worktree, "M");
}
#[test]
fn untracked_unstage_on_unborn_branch_keeps_file() {
    let (dir, repo) = fixture();
    fs::write(dir.path().join("hello.txt"), "hello").unwrap();
    repo.execute(
        &Action::Stage {
            paths: vec!["hello.txt".into()],
        },
        None,
    )
    .unwrap();
    repo.execute(
        &Action::Unstage {
            paths: vec!["hello.txt".into()],
        },
        None,
    )
    .unwrap();
    assert!(dir.path().join("hello.txt").exists());
    assert_eq!(repo.snapshot().unwrap().changes[0].index, "?");
}
#[test]
fn destructive_preview_rejects_stale_content() {
    let (dir, repo) = fixture();
    fs::write(dir.path().join("hello.txt"), "one\n").unwrap();
    commit(&repo, "Initial");
    fs::write(dir.path().join("hello.txt"), "two\n").unwrap();
    let action = Action::Discard {
        paths: vec!["hello.txt".into()],
    };
    let (token, _) = repo.preview(&action).unwrap();
    fs::write(dir.path().join("hello.txt"), "three\n").unwrap();
    assert!(repo.execute(&action, Some(&token)).is_err());
    assert_eq!(
        fs::read_to_string(dir.path().join("hello.txt")).unwrap(),
        "three\n"
    );
    let (token, _) = repo.preview(&action).unwrap();
    repo.execute(&action, Some(&token)).unwrap();
    assert_eq!(
        fs::read_to_string(dir.path().join("hello.txt")).unwrap(),
        "one\n"
    );
}
#[test]
fn branches_stashes_tags_and_recovery() {
    let (dir, repo) = fixture();
    fs::write(dir.path().join("hello.txt"), "one\n").unwrap();
    commit(&repo, "Initial");
    repo.execute(
        &Action::CreateBranch {
            name: "feature/example".into(),
            start: "HEAD".into(),
        },
        None,
    )
    .unwrap();
    repo.execute(
        &Action::Switch {
            branch: "feature/example".into(),
        },
        None,
    )
    .unwrap();
    fs::write(dir.path().join("hello.txt"), "two\n").unwrap();
    repo.execute(
        &Action::StashSave {
            message: "Draft".into(),
            untracked: true,
        },
        None,
    )
    .unwrap();
    assert_eq!(repo.entries("stashes").unwrap().len(), 1);
    repo.execute(
        &Action::StashApply {
            name: "stash@{0}".into(),
            pop: false,
        },
        None,
    )
    .unwrap();
    repo.execute(
        &Action::CreateTag {
            name: "v0.1".into(),
            target: "HEAD".into(),
            message: "".into(),
        },
        None,
    )
    .unwrap();
    assert_eq!(repo.entries("tags").unwrap()[0].name, "v0.1");
    assert!(!repo.entries("recovery").unwrap().is_empty());
}
#[test]
fn rejects_untrusted_and_path_traversal() {
    let (dir, mut repo) = fixture();
    repo.trusted = false;
    assert!(repo.execute(&Action::Clean, None).is_err());
    assert!(repo.file("../outside").is_err());
    assert!(repo.file(".git/config").is_err());
    assert!(repo.file("nested/../../outside").is_err());
    assert!(repo.file("C:/outside").is_err());
    assert!(dir.path().exists());
}
#[test]
fn untracked_diff_keeps_missing_newline_and_crlf() {
    let (dir, repo) = fixture();
    fs::write(dir.path().join("without newline.txt"), "first\r\nlast").unwrap();
    let diff = repo.diff("without newline.txt", false, "", "").unwrap();
    assert!(diff.contains("\\ No newline at end of file"));
    assert!(diff.contains("first\r\n"));
}
#[test]
fn non_utf8_diff_does_not_offer_lossy_patch_content() {
    let (dir, repo) = fixture();
    fs::write(dir.path().join("encoded.txt"), [0xff, 0xfe, b'a']).unwrap();
    assert!(repo
        .diff("encoded.txt", false, "", "")
        .unwrap()
        .contains("non-UTF-8"));
}
#[test]
fn unicode_spaces_binary_and_bare_are_readable() {
    let (dir, repo) = fixture();
    fs::write(dir.path().join("日本語 notes.txt"), "text\r\n").unwrap();
    fs::write(dir.path().join("image.bin"), [0, 1, 2]).unwrap();
    let snapshot = repo.snapshot().unwrap();
    assert_eq!(snapshot.changes.len(), 2);
    assert!(repo
        .diff("image.bin", false, "", "")
        .unwrap()
        .contains("Binary"));
    let bare = tempfile::tempdir().unwrap();
    run(bare.path(), &["init", "--bare"]);
    assert!(
        Repository::open(bare.path(), true)
            .unwrap()
            .snapshot()
            .unwrap()
            .bare
    );
}
#[test]
fn real_merge_conflict_can_be_resolved_and_continued() {
    let (dir, repo) = fixture();
    fs::write(dir.path().join("hello.txt"), "base\n").unwrap();
    commit(&repo, "Base");
    run(dir.path(), &["switch", "-c", "topic"]);
    fs::write(dir.path().join("hello.txt"), "topic\n").unwrap();
    commit(&repo, "Topic");
    run(dir.path(), &["switch", "dev"]);
    fs::write(dir.path().join("hello.txt"), "dev\n").unwrap();
    commit(&repo, "Dev");
    assert!(repo
        .execute(
            &Action::Merge {
                target: "topic".into()
            },
            None
        )
        .is_err());
    assert_eq!(repo.snapshot().unwrap().operation.as_deref(), Some("merge"));
    let conflict = repo.conflict("hello.txt").unwrap();
    assert_eq!(conflict.base, "base\n");
    repo.execute(
        &Action::Resolve {
            path: "hello.txt".into(),
            content: Some("resolved\n".into()),
            side: None,
        },
        None,
    )
    .unwrap();
    repo.execute(&Action::Continue, None).unwrap();
    assert!(repo.snapshot().unwrap().operation.is_none());
}
