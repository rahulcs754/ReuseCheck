import { describe, expect, it } from 'vitest';
import { newUnits } from '../src/check.js';
import { addedLines } from '../src/diff.js';
import { extractUnits } from '../src/parse.js';

const DIFF = `diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -3,0 +4,3 @@ export function old() {
+export function fresh() {
+  return 1;
+}
@@ -10 +13 @@
-  const x = 1;
+  const x = 2;
diff --git a/gone.ts b/gone.ts
--- a/gone.ts
+++ /dev/null
@@ -1 +0,0 @@
-x
`;

describe('addedLines', () => {
  it('reads new-side line numbers per file', () => {
    const m = addedLines(DIFF);
    expect([...m.get('src/a.ts')!]).toEqual([4, 5, 6, 13]);
    expect(m.has('gone.ts')).toBe(false);
  });

  it('marks units as new when most of their lines were added', () => {
    const code = 'function old() {\n  return 0;\n}\nexport function fresh() {\n  return 1;\n}\n';
    const units = extractUnits(code, 'src/a.ts');
    const fresh = newUnits(units, addedLines(DIFF));
    expect(fresh.map((u) => u.name)).toEqual(['fresh']);
  });
});
