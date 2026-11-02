// A read-only, explicitly labeled fixture for browser design verification. Desktop always uses Rust.
import type { Change, Commit, Entry, Snapshot } from './types';
export const sampleChanges: Change[] = [
  {
    path: 'src/components/RepositorySidebar.tsx',
    originalPath: null,
    index: '.',
    worktree: 'M',
    conflict: false,
    submodule: false,
  },
  {
    path: 'src/components/CommitGraph.tsx',
    originalPath: null,
    index: '.',
    worktree: 'M',
    conflict: false,
    submodule: false,
  },
  {
    path: 'src/styles/workspace.css',
    originalPath: null,
    index: '.',
    worktree: 'M',
    conflict: false,
    submodule: false,
  },
  {
    path: 'src/hooks/useRepository.ts',
    originalPath: null,
    index: '?',
    worktree: '?',
    conflict: false,
    submodule: false,
  },
  {
    path: 'src/components/BranchSelector.tsx',
    originalPath: null,
    index: 'M',
    worktree: '.',
    conflict: false,
    submodule: false,
  },
  {
    path: 'tests/repository.test.ts',
    originalPath: null,
    index: 'A',
    worktree: '.',
    conflict: false,
    submodule: false,
  },
];
const snapshot: Snapshot = {
  root: 'C:/Projects/gik',
  branch: 'feature/workspace',
  head: 'a71c8e9f031f9e1c947f7f7e7fe97f8b31eb2a6a',
  upstream: 'origin/feature/workspace',
  ahead: 2,
  behind: 0,
  changes: sampleChanges,
  operation: null,
  bare: false,
  token: 'preview',
};
const subjects = [
  'Refine repository navigation and branch switching',
  'Keep file selection when repository refreshes',
  'Add keyboard navigation to the changes list',
  'Merge branch feature/diff-viewer',
  'Render unified and split diffs',
  'Add native window controls on Windows',
  'Persist workspace layout between sessions',
  'Handle renamed files in status parser',
  'Add repository trust confirmation',
  'Initialize the desktop workbench',
];
const previewOid = (index: number) =>
  index === 0 ? snapshot.head : (0xb62f908 - index * 17331).toString(16).padEnd(40, '9');
export const sampleCommits: Commit[] = Array.from({ length: 240 }, (_, i) => ({
  oid: previewOid(i),
  parents:
    i === 239
      ? []
      : i === 3
        ? [previewOid(4), previewOid(5)]
        : i === 4
          ? [previewOid(6)]
          : [previewOid(i + 1)],
  subject: subjects[i % subjects.length] + (i >= 10 ? ` (${Math.floor(i / 10) + 1})` : ''),
  author: ['Alex Morgan', 'Jamie Chen', 'Sam Rivera'][i % 3],
  date: new Date(Date.UTC(2026, 9, 31, 10) - i * 3600000).toISOString(),
  refs: i === 0 ? 'HEAD -> feature/workspace' : i === 3 ? 'origin/dev, dev' : '',
}));
export const sampleDiff = `diff --git a/src/components/RepositorySidebar.tsx b/src/components/RepositorySidebar.tsx
index 5e9ab12..74c8201 100644
--- a/src/components/RepositorySidebar.tsx
+++ b/src/components/RepositorySidebar.tsx
@@ -12,13 +12,18 @@ export function RepositorySidebar() {
   const { repository, branches } = useRepository();
   const [filter, setFilter] = useState('');
${' '}
-  const visibleBranches = branches;
+  const visibleBranches = branches.filter((branch) =>
+    branch.name.toLowerCase().includes(filter.toLowerCase())
+  );
${' '}
   return (
     <nav aria-label="Repository">
+      <BranchSearch value={filter} onChange={setFilter} />
       <BranchList
         branches={visibleBranches}
-        onSelect={checkoutBranch}
+        activeBranch={repository.branch}
+        onSelect={switchBranch}
       />
     </nav>
   );
 }`;
export async function previewCall<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (command === 'git_version') return 'Git · browser preview' as T;
  if (command === 'open_repository')
    return { id: 'preview', path: snapshot.root, trusted: false } as T;
  if (command === 'query') {
    const request = args?.request as { kind: string; skip?: number };
    const collections: Record<string, Entry[]> = {
      branches: [
        { name: 'feature/workspace', detail: 'origin/feature/workspace', oid: snapshot.head },
        { name: 'dev', detail: 'origin/dev', oid: sampleCommits[3].oid },
        { name: 'origin/dev', detail: '', oid: sampleCommits[3].oid },
      ],
      tags: [{ name: 'v0.1.0', detail: 'First workbench preview', oid: sampleCommits[8].oid }],
      stashes: [
        {
          name: 'stash@{0}',
          detail: 'On dev: Unfinished toolbar refinement',
          oid: sampleCommits[2].oid,
        },
      ],
      remotes: [{ name: 'origin', detail: 'git@github.com:example/gik.git', oid: '' }],
      worktrees: [
        { name: snapshot.root, detail: 'refs/heads/feature/workspace', oid: snapshot.head },
      ],
      recovery: sampleCommits.map((c, i) => ({
        name: `HEAD@{${i}}`,
        detail: `commit: ${c.subject}`,
        oid: c.oid,
      })),
    };
    if (request.kind === 'snapshot') return snapshot as T;
    if (request.kind === 'history')
      return sampleCommits.slice(request.skip || 0, (request.skip || 0) + 200) as T;
    if (request.kind === 'diff') return sampleDiff as T;
    if (request.kind === 'file_history')
      return sampleCommits.map((c) => `${c.oid.slice(0, 7)} ${c.subject}`).join('\n') as T;
    if (request.kind === 'blame') return sampleDiff as T;
    return (collections[request.kind] || []) as T;
  }
  throw new Error(
    'This browser preview is read-only. Launch the desktop app to work with real repositories.',
  );
}
