// Design step 5: grey placeholder pages instead of the word "Loading...".
// They have the shape of the real page, so nothing jumps when the real page arrives.

// The shop record is loading (before the shop's colours are known): a neutral top bar + a banner block.
export function ShopSkeleton({ label }) {
  return (
    <div className="min-h-screen animate-pulse" role="status" aria-busy="true" aria-label={label}>
      <div className="flex items-center justify-between border-b border-black/10 px-4 py-3 sm:px-8" aria-hidden="true">
        <div className="h-6 w-28 rounded bg-black/10" />
        <div className="flex gap-2"><div className="h-11 w-11 rounded bg-black/10" /><div className="h-11 w-11 rounded bg-black/10" /></div>
      </div>
      <div className="mx-4 mt-6 h-64 rounded-md bg-black/10 sm:mx-8 sm:h-96" aria-hidden="true" />
    </div>
  );
}

// A product page is loading: photo square, title, price and a few lines.
export function ProductPageSkeleton({ label }) {
  return (
    <div className="min-h-screen animate-pulse" role="status" aria-busy="true" aria-label={label}>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12" aria-hidden="true">
        <div className="h-4 w-24 rounded bg-paper-dim" />
        <div className="mt-6 grid gap-8 md:grid-cols-2">
          <div className="aspect-square w-full rounded-md bg-paper-dim" />
          <div>
            <div className="h-8 w-3/4 rounded bg-paper-dim" />
            <div className="mt-3 h-7 w-1/3 rounded bg-paper-dim" />
            <div className="mt-8 h-4 w-full rounded bg-paper-dim" />
            <div className="mt-2 h-4 w-5/6 rounded bg-paper-dim" />
            <div className="mt-8 flex gap-3"><div className="h-11 w-11 rounded-full bg-paper-dim" /><div className="h-11 w-11 rounded-full bg-paper-dim" /></div>
            <div className="mt-8 h-12 w-full rounded bg-paper-dim" />
          </div>
        </div>
      </div>
    </div>
  );
}
