export interface DiffLine {
  id: number;
  type: 'add' | 'remove' | 'context' | 'note';
  text: string;
  old: number | null;
  next: number | null;
}
export interface Hunk {
  header: string;
  file: string;
  oldStart: number;
  newStart: number;
  lines: DiffLine[];
}
export interface ParsedDiff {
  header: string;
  hunks: Hunk[];
  binary: boolean;
  text: string;
}
export function parseDiff(text: string): ParsedDiff {
  const header: string[] = [];
  const hunks: Hunk[] = [];
  let current: Hunk | undefined;
  let old = 0;
  let next = 0;
  let id = 0;
  let file = '';
  for (const line of text.split('\n')) {
    if (line.startsWith('diff --git ')) {
      current = undefined;
      file = line.slice(11);
    }
    const match = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (match) {
      old = Number(match[1]);
      next = Number(match[2]);
      current = { header: line, file, oldStart: old, newStart: next, lines: [] };
      hunks.push(current);
      continue;
    }
    if (!current) {
      if (!hunks.length) header.push(line);
      continue;
    }
    if (!line) continue;
    if (line[0] === '+')
      current.lines.push({ id: id++, type: 'add', text: line.slice(1), old: null, next: next++ });
    else if (line[0] === '-')
      current.lines.push({ id: id++, type: 'remove', text: line.slice(1), old: old++, next: null });
    else if (line[0] === ' ')
      current.lines.push({
        id: id++,
        type: 'context',
        text: line.slice(1),
        old: old++,
        next: next++,
      });
    else if (line[0] === '\\')
      current.lines.push({ id: id++, type: 'note', text: line, old: null, next: null });
  }
  return {
    header: header.join('\n'),
    hunks,
    binary: /Binary files|GIT binary patch|Binary file/.test(text),
    text,
  };
}
export function selectionPatch(diff: ParsedDiff, selected: Set<number>, reverse: boolean): string {
  let result = '';
  let offset = 0;
  for (const hunk of diff.hunks) {
    if (!hunk.lines.some((l) => selected.has(l.id) && ['add', 'remove'].includes(l.type))) continue;
    const lines: string[] = [];
    let oldCount = 0;
    let newCount = 0;
    let keptPrevious = false;
    for (const line of hunk.lines) {
      if (line.type === 'note') {
        if (keptPrevious) lines.push(line.text);
        continue;
      }
      let prefix = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';
      if (prefix !== ' ' && !selected.has(line.id)) {
        if ((reverse && prefix === '-') || (!reverse && prefix === '+')) {
          keptPrevious = false;
          continue;
        }
        prefix = ' ';
      }
      lines.push(prefix + line.text);
      keptPrevious = true;
      if (prefix !== '+') oldCount++;
      if (prefix !== '-') newCount++;
    }
    const oldStart = reverse ? hunk.newStart - offset : hunk.oldStart;
    const newStart = reverse ? hunk.newStart : hunk.oldStart + offset;
    result += `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@\n${lines.join('\n')}\n`;
    offset += newCount - oldCount;
  }
  return result ? `${diff.header}\n${result}` : '';
}
