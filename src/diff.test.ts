import { describe, expect, it } from 'vitest';
import { parseDiff, selectionPatch } from './diff';
const patch =
  'diff --git a/test.txt b/test.txt\nindex abc..def 100644\n--- a/test.txt\n+++ b/test.txt\n@@ -1,3 +1,4 @@\n one\n-two\n+changed\n+added\n three\n';
describe('partial staging', () => {
  it('counts old and new line numbers independently', () => {
    const rows = parseDiff(patch).hunks[0].lines;
    expect(rows.find((r) => r.text === 'changed')).toMatchObject({ old: null, next: 2 });
    expect(rows.find((r) => r.text === 'three')).toMatchObject({ old: 3, next: 4 });
  });
  it('keeps unselected deletions as context and omits unselected additions', () => {
    const parsed = parseDiff(patch);
    const addition = parsed.hunks[0].lines.find((r) => r.text === 'added')!;
    const result = selectionPatch(parsed, new Set([addition.id]), false);
    expect(result).toContain(' two\n+added\n');
    expect(result).not.toContain('+changed');
  });
  it('keeps all changed lines when selecting a whole hunk', () => {
    const parsed = parseDiff(patch);
    expect(
      selectionPatch(parsed, new Set(parsed.hunks[0].lines.map((r) => r.id)), false),
    ).toContain('-two\n+changed\n+added');
  });
  it('does not produce a patch when nothing is selected', () => {
    expect(selectionPatch(parseDiff(patch), new Set(), false)).toBe('');
  });
  it('does not treat another file header as a changed line', () => {
    const parsed = parseDiff(
      patch +
        '\ndiff --git a/other.txt b/other.txt\n--- a/other.txt\n+++ b/other.txt\n@@ -1 +1 @@\n-before\n+after\n',
    );
    expect(parsed.hunks).toHaveLength(2);
    expect(parsed.hunks[0].lines.some((l) => l.text.includes('other.txt'))).toBe(false);
    expect(parsed.hunks[1].file).toContain('other.txt');
  });
});
