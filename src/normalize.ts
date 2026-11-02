import type { Node } from '@babel/types';

/** AST keys that never matter for similarity. */
const SKIP_KEYS = new Set([
  'type', 'loc', 'start', 'end', 'range', 'extra', 'comments', 'leadingComments', 'trailingComments',
  'innerComments', 'typeAnnotation', 'returnType', 'typeParameters', 'typeArguments', 'predicate',
  'decorators', 'directives',
]);

/** Values that are flags/operators: kept so `a + b` differs from `a - b`. */
const VALUE_KEYS = new Set(['operator', 'kind', 'async', 'generator', 'computed', 'prefix', 'optional', 'method', 'shorthand']);

const WRAPPERS = new Set(['BlockStatement', 'ExpressionStatement', 'ReturnStatement', 'ParenthesizedExpression']);

function isNode(v: unknown): v is Node {
  return typeof v === 'object' && v !== null && typeof (v as { type?: unknown }).type === 'string';
}

/** Names bound inside the unit: params, variables, inner functions, catch params. */
export function collectBindings(root: Node): Set<string> {
  const names = new Set<string>();
  const addPattern = (p: Node | null | undefined): void => {
    if (!p) return;
    switch (p.type) {
      case 'Identifier': names.add(p.name); break;
      case 'ObjectPattern':
        for (const prop of p.properties) {
          if (prop.type === 'RestElement') addPattern(prop.argument);
          else addPattern(prop.value as Node);
        }
        break;
      case 'ArrayPattern': for (const el of p.elements) addPattern(el); break;
      case 'AssignmentPattern': addPattern(p.left); break;
      case 'RestElement': addPattern(p.argument); break;
      case 'TSParameterProperty': addPattern(p.parameter); break;
      default: break;
    }
  };
  const visit = (n: Node): void => {
    switch (n.type) {
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
      case 'ObjectMethod':
      case 'ClassMethod':
      case 'ClassPrivateMethod':
        if ('id' in n && n.id && n !== root) names.add(n.id.name);
        for (const p of n.params) addPattern(p as Node);
        break;
      case 'VariableDeclarator': addPattern(n.id); break;
      case 'CatchClause': addPattern(n.param); break;
      case 'ClassDeclaration': if (n.id && n !== root) names.add(n.id.name); break;
      default: break;
    }
    walkChildren(n, visit);
  };
  visit(root);
  return names;
}

function walkChildren(n: Node, fn: (child: Node) => void): void {
  for (const key of Object.keys(n)) {
    if (SKIP_KEYS.has(key)) continue;
    const v = (n as unknown as Record<string, unknown>)[key];
    if (Array.isArray(v)) {
      for (const c of v) if (isNode(c)) fn(c);
    } else if (isNode(v)) fn(v);
  }
}

export interface Normalized {
  tokens: string[];
  apis: Set<string>;
  hasJsx: boolean;
}

/**
 * Turn a function's AST into a token stream that ignores naming:
 * every local name becomes $, literals become STR/NUM, types are dropped.
 * Free names, member names and JSX tags are collected as "APIs".
 */
export function normalize(root: Node, selfName?: string): Normalized {
  const locals = collectBindings(root);
  // The unit's own name is a local too (recursion, displayName).
  if (selfName) locals.add(selfName);
  if ('id' in root && root.id && root.id.type === 'Identifier') locals.add(root.id.name);
  const tokens: string[] = [];
  const apis = new Set<string>();
  let hasJsx = false;

  const visit = (n: Node, parent?: Node, parentKey?: string): void => {
    // TypeScript-only nodes: keep the wrapped expression, drop the types.
    if (n.type.startsWith('TS')) {
      const inner = (n as unknown as { expression?: unknown }).expression;
      if (isNode(inner)) visit(inner, parent, parentKey);
      return;
    }
    switch (n.type) {
      case 'Identifier': {
        const isMemberProp = parent?.type === 'MemberExpression' || parent?.type === 'OptionalMemberExpression';
        if (isMemberProp && parentKey === 'property' && !(parent as { computed: boolean }).computed) {
          tokens.push('PROP');
          apis.add(`.${n.name}`);
        } else if (
          (parent?.type === 'ObjectProperty' || parent?.type === 'ObjectMethod' || parent?.type === 'ClassMethod' ||
            parent?.type === 'ClassProperty') &&
          parentKey === 'key' && !(parent as { computed: boolean }).computed
        ) {
          tokens.push('KEY');
        } else if (locals.has(n.name)) {
          tokens.push('$'); // every local name looks the same
        } else {
          tokens.push(`id:${n.name}`);
          apis.add(n.name);
        }
        return;
      }
      case 'PrivateName': tokens.push('PRIVATE'); return;
      case 'StringLiteral': tokens.push('STR'); return;
      case 'NumericLiteral': tokens.push('NUM'); return;
      case 'BigIntLiteral': tokens.push('NUM'); return;
      case 'BooleanLiteral': tokens.push(n.value ? 'TRUE' : 'FALSE'); return;
      case 'NullLiteral': tokens.push('NULL'); return;
      case 'RegExpLiteral': tokens.push('REGEX'); return;
      case 'TemplateElement': tokens.push('TPL'); return;
      case 'JSXIdentifier': {
        hasJsx = true;
        if (parent?.type === 'JSXAttribute') {
          tokens.push('ATTR');
          apis.add(`@${n.name}`);
        } else {
          tokens.push('TAG');
          apis.add(`<${n.name}>`);
        }
        return;
      }
      case 'JSXText': if (n.value.trim()) tokens.push('TEXT'); return;
      default: break;
    }
    if (n.type.startsWith('JSX')) hasJsx = true;
    // Wrappers that differ between styles (`() => x` vs `() => { return x; }`) add no meaning.
    if (n !== root && !WRAPPERS.has(n.type)) tokens.push(n.type);
    const rec = n as unknown as Record<string, unknown>;
    for (const key of n === root ? [] : VALUE_KEYS) {
      const v = rec[key];
      if (typeof v === 'string') tokens.push(v);
      else if (v === true) tokens.push(key);
    }
    for (const key of Object.keys(n)) {
      if (SKIP_KEYS.has(key) || VALUE_KEYS.has(key)) continue;
      if (n === root && key === 'id') continue; // the unit's own name
      const v = rec[key];
      if (Array.isArray(v)) {
        for (const c of v) if (isNode(c)) visit(c, n, key);
      } else if (isNode(v)) visit(v, n, key);
    }
  };
  visit(root);
  return { tokens, apis, hasJsx };
}
