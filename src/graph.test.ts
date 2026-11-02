import { expect, it } from 'vitest';
import { layoutGraph } from './graph';
it('keeps distinct merge-parent lanes and connects a branch back to an existing ancestor', () => {
  const graph = layoutGraph([
    { oid: 'merge', parents: ['a', 'b'] },
    { oid: 'a', parents: ['base'] },
    { oid: 'b', parents: ['base'] },
    { oid: 'base', parents: [] },
  ]);
  expect(graph[0].targets).toEqual([0, 1]);
  expect(graph[1].tracks).toMatchObject([{ from: 1, to: 1 }]);
  expect(graph[2].targets).toEqual([0]);
  expect(graph[2].tracks).toMatchObject([{ from: 0, to: 0 }]);
  expect(graph[3].after).toBe(0);
  expect(new Set(graph[0].targetColors).size).toBe(2);
  expect(graph[1].color).toBe(graph[0].targetColors[0]);
  expect(graph[2].color).toBe(graph[0].targetColors[1]);
});
