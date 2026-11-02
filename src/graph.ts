import type { Commit } from './types';
export function layoutGraph(commits: Pick<Commit, 'oid' | 'parents'>[]) {
  const active: { oid: string; color: number }[] = [];
  let nextColor = 0;
  return commits.map((commit) => {
    let lane = active.findIndex((entry) => entry.oid === commit.oid);
    if (lane < 0) {
      lane = active.length;
      active.push({ oid: commit.oid, color: nextColor++ % 5 });
    }
    const before = [...active];
    const color = active[lane].color;
    active.splice(lane, 1);
    commit.parents.forEach((parent, index) => {
      if (!active.some((entry) => entry.oid === parent))
        active.splice(Math.min(lane + index, active.length), 0, {
          oid: parent,
          color: index === 0 ? color : nextColor++ % 5,
        });
    });
    return {
      lane,
      before: before.length,
      after: active.length,
      color,
      beforeColors: before.map((entry) => entry.color),
      targetColors: commit.parents.map(
        (parent) => active.find((entry) => entry.oid === parent)!.color,
      ),
      targets: commit.parents.map((parent) => active.findIndex((entry) => entry.oid === parent)),
      tracks: before.flatMap((entry, from) =>
        entry.oid === commit.oid
          ? []
          : [{ from, to: active.findIndex((next) => next.oid === entry.oid), color: entry.color }],
      ),
    };
  });
}
