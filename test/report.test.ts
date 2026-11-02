import { describe, expect, it } from 'vitest';
import { findReuse, unitsOf } from '../src/check.js';
import { markdownReport } from '../src/report.js';
import { DEFAULTS } from '../src/types.js';

const existing = `export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}`;
const fresh = existing.replace('useDebounce', 'useDebouncedValue').replace(/debounced/g, 'current').replace(/Debounced/g, 'Current');

describe('markdownReport', () => {
  it('renders a table with links and reasons', () => {
    const all = unitsOf([{ file: 'src/hooks/useDebounce.js', code: existing }, { file: 'src/search/useDebouncedValue.js', code: fresh }], 1);
    const findings = findReuse(all, all.filter((u) => u.file.includes('search')), DEFAULTS);
    expect(markdownReport(findings, { checked: 1, threshold: 0.8 })).toMatchSnapshot();
  });

  it('says so when nothing is found', () => {
    expect(markdownReport([], { checked: 4, threshold: 0.8 })).toContain('no duplicates found');
  });
});
