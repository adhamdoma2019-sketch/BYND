import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <span className="font-display text-2xl font-medium tracking-wide">The Workshop</span>
      <p className="mt-3 max-w-md text-ink-soft">
        Build a simple storefront and mini business dashboard for your handmade
        or small-batch product — no coding needed.
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          to="/admin/signup"
          className="rounded bg-ink px-5 py-2.5 text-paper transition hover:bg-brass"
        >
          Create your shop
        </Link>
        <Link
          to="/admin/login"
          className="rounded border border-ink/15 px-5 py-2.5 text-ink-soft transition hover:border-brass hover:text-brass"
        >
          Partner login
        </Link>
      </div>
    </div>
  );
}