import { buildQuery, fetchJson } from '../../api/fetchJson';

export interface Product {
  id: string;
  name: string;
  price: number;
}

/** Search products, newest first, and drop items without a price. */
export async function searchProducts(term: string, page = 1): Promise<Product[]> {
  const trimmed = term.trim();
  if (trimmed.length < 2) return [];
  const items = await fetchJson<Product[]>(`/api/products${buildQuery({ q: trimmed, page, sort: 'new' })}`);
  return items.filter((p) => typeof p.price === 'number' && p.price >= 0).slice(0, 20);
}
