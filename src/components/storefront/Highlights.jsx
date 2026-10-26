// The shop's own "why us" points as cards under the banner (e.g. quality, free returns,
// real support). The texts come from Admin > Settings > Shop content: nothing is
// invented here, and if the shop wrote none this part is not shown.
export default function Highlights({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <section className="border-y border-ink/10 bg-paper-soft px-5 py-8 sm:px-8">
      <ul
        className={
          'mx-auto grid max-w-6xl gap-4 ' +
          (items.length === 1 ? '' : items.length === 2 ? 'sm:grid-cols-2' : items.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4')
        }
      >
        {items.map((item) => (
          <li
            key={item.title}
            className="flex items-start gap-3 rounded-md border border-ink/10 bg-paper p-4"
          >
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brass text-on-brass">
              <svg
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <div>
              <h3 className="font-display text-base font-semibold">{item.title}</h3>
              {item.text && <p className="mt-1 text-sm text-ink-soft">{item.text}</p>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
