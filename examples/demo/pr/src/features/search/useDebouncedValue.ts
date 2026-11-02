import { useEffect, useState } from 'react';

// Debounce the search text so we don't call the API on every key press.
export const useDebouncedValue = <V,>(input: V, wait: number = 300): V => {
  const [current, setCurrent] = useState<V>(input);
  useEffect(() => {
    const handle = setTimeout(() => setCurrent(input), wait);
    return () => clearTimeout(handle);
  }, [input, wait]);
  return current;
};
