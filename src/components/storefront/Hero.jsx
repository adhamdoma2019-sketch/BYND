import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { optimizedImage } from '../../utils/images';

// The big banner at the top of the shop.
// `slides` = [{ imageUrl, headline, subtext, ctaLabel, to }]
// One slide = a still banner. Several slides = a slideshow that changes by
// itself (and has dots to jump). The shop edits slides in Admin > Settings.
export default function Hero({ slides, intervalMs = 6000, fadeMs = 1000 }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;

  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [count, index]);

  useEffect(() => {
    if (count < 2 || paused) return undefined;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return undefined;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), intervalMs);
    return () => clearInterval(timer);
  }, [count, paused, intervalMs]);

  if (count === 0) return null;

  return (
    <section
      className="relative isolate min-h-[72svh] overflow-hidden bg-paper-soft sm:min-h-[80vh]"
      aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {slides.map((slide, i) => {
        const active = i === index;
        return (
          <div
            key={i}
            className={
              'absolute inset-0 transition-opacity ' +
              (active ? 'opacity-100' : 'pointer-events-none opacity-0')
            }
            style={{ transitionDuration: `${fadeMs}ms` }}
            aria-hidden={!active}
          >
            {slide.imageUrl && (
              <img
                src={optimizedImage(slide.imageUrl, 1800)}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                loading={i === 0 ? 'eager' : 'lazy'}
              />
            )}
            {/* dark gradient so the text is readable on any photo */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />

            <div className="relative mx-auto flex h-full min-h-[72svh] max-w-6xl flex-col justify-end px-5 pb-16 pt-24 sm:min-h-[80vh] sm:px-8 sm:pb-24">
              {slide.headline && (
                <h1 className="font-display max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight text-[#fff] sm:text-6xl lg:text-7xl">
                  {slide.headline}
                </h1>
              )}
              {slide.subtext && (
                <p className="mt-4 max-w-xl text-base text-[#e7e6e2] sm:text-lg">
                  {slide.subtext}
                </p>
              )}
              {slide.ctaLabel && (
                <div className="mt-8">
                  {slide.to.startsWith('#') ? (
                    <a
                      href={slide.to}
                      className="inline-block rounded bg-brass px-7 py-3 text-sm font-semibold uppercase tracking-wider text-paper transition hover:opacity-90"
                    >
                      {slide.ctaLabel}
                    </a>
                  ) : (
                    <Link
                      to={slide.to}
                      className="inline-block rounded bg-brass px-7 py-3 text-sm font-semibold uppercase tracking-wider text-paper transition hover:opacity-90"
                    >
                      {slide.ctaLabel}
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {count > 1 && (
        <div className="absolute bottom-5 start-1/2 z-10 flex -translate-x-1/2 gap-2 rtl:translate-x-1/2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Slide ${i + 1}`}
              aria-current={i === index}
              className={
                'h-2 rounded-full transition-all ' +
                (i === index ? 'w-8 bg-brass' : 'w-2 bg-[#fff]/50 hover:bg-[#fff]/80')
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}
