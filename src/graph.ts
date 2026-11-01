import type { Commit } from './types';
export function layoutGraph(commits: Pick<Commit, 'oid' | 'parents'>[]) {
  const active: string[] = [];
  return commits.map((commit) => {
    let lane = active.indexOf(commit.oid);
    if (lane < 0) {
      lane = active.length;
      active.push(commit.oid);
    }
    const before = [...active];
    active.splice(lane, 1);
    commit.parents.forEach((parent, index) => {
      if (!active.includes(parent)) active.splice(Math.min(lane + index, active.length), 0, parent);
    });
    return {
      lane,
      before: before.length,
      after: active.length,
      targets: commit.parents.map((parent) => active.indexOf(parent)),
      tracks: before.flatMap((oid, from) =>
        oid === commit.oid ? [] : [{ from, to: active.indexOf(oid) }],
      ),
    };
  });
}
