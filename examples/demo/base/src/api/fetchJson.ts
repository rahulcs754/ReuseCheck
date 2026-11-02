export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** GET a URL and parse JSON, throwing HttpError on a bad status. */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { accept: 'application/json', ...init?.headers } });
  if (!res.ok) {
    throw new HttpError(res.status, `Request to ${url} failed with ${res.status}`);
  }
  return (await res.json()) as T;
}

export function buildQuery(params: Record<string, string | number | undefined>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length ? `?${parts.join('&')}` : '';
}
