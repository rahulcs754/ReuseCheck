import { describe, expect, it } from 'vitest';
import { extractUnits } from '../src/parse.js';

const one = (code: string, file = 'a.tsx') => {
  const units = extractUnits(code, file);
  expect(units).toHaveLength(1);
  return units[0]!;
};

describe('normalize', () => {
  it('ignores names, types, comments and arrow vs block bodies', () => {
    const a = one(`export function sum(items: number[]): number {
      // add them up
      let total = 0;
      for (const item of items) { total += item; }
      return total;
    }`);
    const b = one(`export const addAll = (values) => {
      let acc = 0;
      for (const v of values) acc += v;
      return acc;
    };`, 'b.js');
    expect(a.hash).toBe(b.hash);
  });

  it('keeps operators, so a + b differs from a - b', () => {
    const a = one('function f(a, b) { return a + b; }');
    const b = one('function g(a, b) { return a - b; }');
    expect(a.hash).not.toBe(b.hash);
  });

  it('keeps the APIs a unit calls', () => {
    const u = one(`function load(url) { return fetch(url).then((r) => r.json()); }`);
    expect([...u.apis].sort()).toEqual(['.json', '.then', 'fetch']);
  });

  it('collects JSX tags and attributes as APIs', () => {
    const u = one('export const Btn = ({ onPress }) => <button type="button" onClick={onPress}>Go</button>;');
    expect(u.kind).toBe('component');
    expect(u.apis).toContain('<button>');
    expect(u.apis).toContain('@onClick');
  });
});

describe('extractUnits', () => {
  it('finds functions, hooks, components, methods and unwraps memo/forwardRef', () => {
    const code = `
      import { memo, forwardRef } from 'react';
      export function useThing() { return 1; }
      const helper = function () { return 2; };
      export const Card = memo(forwardRef((props, ref) => <div ref={ref} />));
      class Store { save(x) { return x; } #reset() {} }
      export const api = { get(id) { return id; }, put: async (id) => id };
      export default function () { return null; }
      describe('x', () => { it('y', () => {}); });
      function outer() { function inner() {} return inner; }
    `;
    const units = extractUnits(code, 'a.tsx');
    expect(units.map((u) => `${u.name}:${u.kind}`)).toEqual([
      'useThing:hook',
      'helper:function',
      'Card:component',
      'Store.save:function',
      'Store.#reset:function',
      'api.get:function',
      'api.put:function',
      'default:function',
      'outer:function',
    ]);
  });

  it('parses TypeScript generics in .ts and returns [] for broken code', () => {
    expect(extractUnits('const id = <T>(x: T): T => x;', 'a.ts')).toHaveLength(1);
    expect(extractUnits('function (', 'a.ts')).toEqual([]);
  });
});
