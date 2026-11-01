# Git workflow

- Initialize a Git repository when a project is not already versioned.
- Never make changes or merge into main. Use dev as the integration branch.
- For changes that might break existing behavior, branch from dev using a descriptive name such as feature/git-workbench or fix/status-refresh. Do not use agent names or codex/ prefixes.
- Test changes on that branch. Merge into dev only after the relevant checks pass; otherwise keep the branch and report the failure.
