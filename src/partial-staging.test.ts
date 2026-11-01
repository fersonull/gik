import { it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseDiff, selectionPatch } from './diff';

it('stages and unstages selected lines against a real Git index without changing the worktree', () => {
  const directory = mkdtempSync(join(tmpdir(), 'gik-patch-'));
  const git = (args: string[], input?: string) =>
    execFileSync('git', args, {
      cwd: directory,
      encoding: 'utf8',
      input,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  try {
    git(['init', '-b', 'dev']);
    git(['config', 'core.autocrlf', 'false']);
    writeFileSync(join(directory, 'test.txt'), 'one\ntwo\nthree\n');
    git(['add', 'test.txt']);
    writeFileSync(join(directory, 'test.txt'), 'one\nchanged\nadded\nthree\n');
    const parsed = parseDiff(git(['diff', '--', 'test.txt']));
    const added = parsed.hunks[0].lines.find((l) => l.text === 'added')!;
    const patch = selectionPatch(parsed, new Set([added.id]), false);
    git(['apply', '--cached', '--recount', '-'], patch);
    expect(git(['show', ':test.txt'])).toBe('one\ntwo\nadded\nthree\n');
    const staged = parseDiff(git(['diff', '--cached', '--', 'test.txt']));
    // An unborn repository's cached diff is a new-file patch; commit an index baseline for reverse testing.
    git(['config', 'user.name', 'Fixture']);
    git(['config', 'user.email', 'fixture@example.test']);
    git(['-c', 'commit.gpgsign=false', 'commit', '-m', 'Baseline']);
    git(['add', 'test.txt']);
    const index = parseDiff(git(['diff', '--cached', '--', 'test.txt']));
    const reverse = selectionPatch(
      index,
      new Set(
        index.hunks[0].lines.filter((l) => ['add', 'remove'].includes(l.type)).map((l) => l.id),
      ),
      true,
    );
    git(['apply', '--cached', '--reverse', '--recount', '-'], reverse);
    expect(git(['show', ':test.txt'])).toBe('one\ntwo\nadded\nthree\n');
    expect(readFileSync(join(directory, 'test.txt'), 'utf8')).toBe('one\nchanged\nadded\nthree\n');
    expect(staged.hunks.length).toBeGreaterThan(0);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
