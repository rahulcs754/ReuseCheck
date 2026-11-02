import { parse, type ParserPlugin } from '@babel/parser';
import type { Node } from '@babel/types';
import { normalize } from './normalize.js';
import { bag, shingles } from './similarity.js';
import type { Unit, UnitKind } from './types.js';

export const SOURCE_EXT = /\.(m?[jt]sx?|cjs|cts|mts)$/;

function pluginsFor(file: string): ParserPlugin[] {
  const base: ParserPlugin[] = ['decorators-legacy', 'importAttributes'];
  if (/\.(m|c)?ts$/.test(file)) return [...base, 'typescript'];
  if (/\.tsx$/.test(file)) return [...base, 'typescript', 'jsx'];
  return [...base, 'jsx'];
}

/** Parse source; returns undefined if the file can't be parsed. */
export function parseSource(code: string, file = 'input.tsx'): Node | undefined {
  try {
    return parse(code, {
      sourceType: 'unambiguous',
      plugins: pluginsFor(file),
      errorRecovery: true,
      allowReturnOutsideFunction: true,
    }) as unknown as Node;
  } catch {
    return undefined;
  }
}

type FnNode = Extract<Node, { type: 'FunctionDeclaration' | 'FunctionExpression' | 'ArrowFunctionExpression' | 'ObjectMethod' | 'ClassMethod' | 'ClassPrivateMethod' }>;

const FN_TYPES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression', 'ObjectMethod', 'ClassMethod', 'ClassPrivateMethod']);

function isFn(n: unknown): n is FnNode {
  return typeof n === 'object' && n !== null && FN_TYPES.has((n as Node).type);
}

/** `memo(forwardRef((props) => ...))` → the inner function. */
function unwrap(n: Node | null | undefined): FnNode | undefined {
  let cur = n;
  for (let i = 0; i < 4 && cur; i++) {
    if (isFn(cur)) return cur;
    if (cur.type === 'CallExpression') {
      cur = cur.arguments.find((a) => isFn(a) || a.type === 'CallExpression') as Node | undefined;
    } else if (cur.type.startsWith('TS') && 'expression' in cur) {
      cur = (cur as { expression: Node }).expression;
    } else return undefined;
  }
  return undefined;
}

function keyName(key: Node): string | undefined {
  if (key.type === 'Identifier') return key.name;
  if (key.type === 'StringLiteral') return key.value;
  if (key.type === 'PrivateName') return `#${key.id.name}`;
  return undefined;
}

/** FNV-1a over the token stream (works in Node and the browser). */
export function hashTokens(tokens: string[]): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  const s = tokens.join(' ');
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}:${tokens.length}`;
}

export function kindOf(name: string, hasJsx: boolean): UnitKind {
  if (/^use[A-Z0-9]/.test(name)) return 'hook';
  if (/^[A-Z]/.test(name) && hasJsx) return 'component';
  return 'function';
}

/**
 * Top-level functions, arrow functions, object methods and class methods.
 * Functions nested inside another unit are part of that unit, not their own.
 */
export function extractUnits(code: string, file: string): Unit[] {
  const ast = parseSource(code, file);
  if (!ast) return [];
  const found: Array<{ name: string; fn: FnNode }> = [];

  const visit = (n: Node, owner?: string): void => {
    switch (n.type) {
      case 'FunctionDeclaration':
        found.push({ name: n.id?.name ?? 'default', fn: n });
        return;
      case 'VariableDeclarator': {
        const fn = unwrap(n.init);
        if (fn && n.id.type === 'Identifier') {
          found.push({ name: n.id.name, fn });
          return;
        }
        break;
      }
      case 'ExportDefaultDeclaration': {
        const fn = unwrap(n.declaration as Node);
        if (fn) {
          found.push({ name: 'default', fn });
          return;
        }
        break;
      }
      case 'ObjectMethod':
      case 'ClassMethod':
      case 'ClassPrivateMethod': {
        const name = keyName(n.key as Node);
        if (name) found.push({ name: owner ? `${owner}.${name}` : name, fn: n });
        return;
      }
      case 'ObjectProperty':
      case 'ClassProperty': {
        const fn = unwrap(n.value as Node);
        const name = keyName(n.key as Node);
        if (fn && name) {
          found.push({ name: owner ? `${owner}.${name}` : name, fn });
          return;
        }
        break;
      }
      case 'ClassDeclaration':
      case 'ClassExpression':
        for (const m of n.body.body) visit(m as Node, n.id?.name ?? owner);
        return;
      default:
        if (isFn(n)) return; // anonymous callback at top level, e.g. describe(() => ...)
        break;
    }
    let childOwner = owner;
    if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier') childOwner = n.id.name;
    for (const key of Object.keys(n)) {
      if (key === 'loc' || key === 'leadingComments' || key === 'trailingComments' || key === 'innerComments') continue;
      const v = (n as unknown as Record<string, unknown>)[key];
      if (Array.isArray(v)) {
        for (const c of v) if (c && typeof c === 'object' && 'type' in c) visit(c as Node, childOwner);
      } else if (v && typeof v === 'object' && 'type' in v) visit(v as Node, childOwner);
    }
  };
  visit(ast);

  return found.map(({ name, fn }) => {
    const { tokens, apis, hasJsx } = normalize(fn, name.split('.').pop());
    const line = fn.loc?.start.line ?? 1;
    return {
      id: `${file}:${line}:${name}`,
      file,
      name,
      kind: kindOf(name.split('.').pop() ?? name, hasJsx),
      line,
      endLine: fn.loc?.end.line ?? line,
      tokens,
      shingles: shingles(tokens),
      bag: bag(tokens),
      apis,
      hash: hashTokens(tokens),
    };
  });
}
