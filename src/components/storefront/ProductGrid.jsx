import ProductCard from './ProductCard';

// The grid of product cards, shared by the home page (featured) and the Products page.
export default function ProductGrid({ products, onAddToCart }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} onAddToCart={onAddToCart} />
      ))}
    </div>
  );
}

// Grey placeholder cards shown while the products load (instead of the word "Loading...").
// They have the same shape as a real card, so the page does not jump when the products arrive.
export function ProductGridSkeleton({ count = 6, label }) {
  return (
    <div
      className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3"
      role="status"
      aria-busy="true"
      aria-label={label}
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="animate-pulse rounded-md border border-ink/10 bg-white p-3" aria-hidden="true">
          <div className="mb-3 aspect-square w-full rounded bg-paper-dim" />
          <div className="mx-1 h-5 w-2/3 rounded bg-paper-dim" />
          <div className="mx-1 mt-2 h-4 w-1/3 rounded bg-paper-dim" />
          <div className="mt-4 h-10 w-full rounded bg-paper-dim" />
        </div>
      ))}
    </div>
  );
}
