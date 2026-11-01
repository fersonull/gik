export type View =
  'changes' | 'history' | 'branches' | 'tags' | 'stashes' | 'worktrees' | 'remotes' | 'recovery';
export interface Repository {
  id: string;
  path: string;
  trusted: boolean;
}
export interface Change {
  path: string;
  originalPath: string | null;
  index: string;
  worktree: string;
  conflict: boolean;
  submodule: boolean;
}
export interface Snapshot {
  root: string;
  branch: string;
  head: string;
  upstream: string;
  ahead: number;
  behind: number;
  changes: Change[];
  operation: string | null;
  bare: boolean;
  token: string;
}
export interface Commit {
  oid: string;
  parents: string[];
  subject: string;
  author: string;
  date: string;
  refs: string;
}
export interface Entry {
  name: string;
  detail: string;
  oid: string;
}
export interface Conflict {
  base: string;
  ours: string;
  theirs: string;
  binary: boolean;
}
export interface RebaseStep {
  oid: string;
  action: string;
}
export type Action =
  | { kind: 'mergetool'; path: string }
  | { kind: 'stage' | 'unstage' | 'discard'; paths: string[] }
  | { kind: 'apply_patch'; patch: string; reverse: boolean; cached: boolean }
  | { kind: 'commit'; message: string; amend: boolean; sign: boolean }
  | { kind: 'clean' | 'continue' | 'skip' | 'abort' }
  | { kind: 'switch'; branch: string }
  | { kind: 'create_branch'; name: string; start: string }
  | { kind: 'rename_branch'; old: string; name: string }
  | { kind: 'delete_branch'; name: string; force: boolean }
  | { kind: 'upstream'; branch: string; upstream: string }
  | { kind: 'fetch'; remote: string }
  | { kind: 'pull'; rebase: boolean }
  | { kind: 'push'; force: boolean }
  | { kind: 'merge' | 'rebase' | 'cherry_pick' | 'revert'; target: string }
  | { kind: 'interactive_rebase'; base: string; steps: RebaseStep[] }
  | { kind: 'reset'; target: string; mode: string }
  | { kind: 'stash_save'; message: string; untracked: boolean }
  | { kind: 'stash_apply'; name: string; pop: boolean }
  | { kind: 'stash_drop' | 'delete_tag' | 'remove_remote'; name: string }
  | { kind: 'create_tag'; name: string; target: string; message: string }
  | { kind: 'add_remote'; name: string; url: string }
  | { kind: 'add_worktree'; path: string; branch: string }
  | { kind: 'remove_worktree'; path: string }
  | { kind: 'resolve'; path: string; content: string | null; side: string | null }
  | { kind: 'recover'; oid: string; branch: string };
export function destructive(action: Action): boolean {
  return (
    [
      'abort',
      'discard',
      'clean',
      'reset',
      'rebase',
      'interactive_rebase',
      'stash_drop',
      'delete_tag',
      'remove_remote',
      'remove_worktree',
    ].includes(action.kind) ||
    (action.kind === 'commit' && action.amend) ||
    (action.kind === 'delete_branch' && action.force) ||
    (action.kind === 'push' && action.force)
  );
}
export const nameOf = (path: string) =>
  path.replaceAll('\\', '/').split('/').filter(Boolean).at(-1) || path;
export const isStaged = (change: Change) =>
  !['.', '?', ' '].includes(change.index) && !change.conflict;
export const isUnstaged = (change: Change) =>
  !['.', ' '].includes(change.worktree) || change.conflict;
