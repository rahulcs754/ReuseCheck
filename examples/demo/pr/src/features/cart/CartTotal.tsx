import type { Product } from '../search/searchProducts';

export function CartTotal({ items, currency = 'INR' }: { items: Array<Product & { qty: number }>; currency?: string }) {
  const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const formatted = new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(total);
  return (
    <p className="cart-total">
      {items.length} items · <strong>{formatted}</strong>
    </p>
  );
}
