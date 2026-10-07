import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import { optimizedImage } from '../../utils/images';

// The big banner at the top of the shop.
// `slides` = [{ imageUrl, headline, subtext, ctaLabel, to }]
//
// One slide = a still banner. Several slides = a slideshow: visitors change
// pictures with the arrows, by swiping, or with the dots; it can also change by
// itself after a time (the shop chooses this in Admin > Settings).
//
// Only the picture on screen (and the one fading out) is kept on the page, which
// keeps it light for phones.
export default function Hero({ slides, intervalMs = 6000, fadeMs = 1000, autoplay = true }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const rtl = language === 'ar';
  const count = slides.length;

  const [index, setIndex] = useState(0);
  const [prev, setPrev] = useState(null); // slide fading out
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef(null);
  const fadeTimer = useRef(null);

  const current = index < count ? index : 0;
  const next = (current + 1) % Math.max(count, 1);
  const previous = (current - 1 + Math.max(count, 1)) % Math.max(count, 1);

  const goTo = useCallback(
    (target) => {
      if (target === current || count < 2) return;
      setPrev(current);
      setIndex(target);
      clearTimeout(fadeTimer.current);
      fadeTimer.current = setTimeout(() => setPrev(null), fadeMs + 50);
    },
    [current, count, fadeMs]
  );

  useEffect(() => () => clearTimeout(fadeTimer.current), []);

  // Changes by itself after the chosen time (restarts after every change).
  useEffect(() => {
    if (!autoplay || count < 2 || paused) return undefined;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return undefined;
    const timer = setTimeout(() => goTo(next), intervalMs);
    return () => clearTimeout(timer);
  }, [autoplay, count, paused, intervalMs, next, goTo]);

  // Gets the next picture ready so it doesn't pop in.
  useEffect(() => {
    if (count < 2 || !slides[next]?.imageUrl) return;
    const img = new Image();
    img.src = optimizedImage(slides[next].imageUrl, 1800);
  }, [count, next, slides]);

  if (count === 0) return null;

  function onTouchEnd(e) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 50) return;
    // Swiping left shows the next picture (the other way round in Arabic).
    const forward = rtl ? dx > 0 : dx < 0;
    goTo(forward ? next : previous);
  }

  const shown = [prev !== null && prev !== current && prev < count ? prev : null, current].filter(
    (i) => i !== null
  );

  const arrowClass =
    'absolute top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-[#fff] transition hover:bg-black/60';
  const chevron = (d) => (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 rtl:rotate-180"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );

  return (
    <section
      className="relative isolate min-h-[72svh] overflow-hidden bg-paper-soft sm:min-h-[80vh]"
      aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0].clientX;
      }}
      onTouchEnd={onTouchEnd}
    >
      {shown.map((i) => {
        const slide = slides[i];
        const active = i === current;
        return (
          <div
            key={i}
            className={'absolute inset-0 ' + (active && prev !== null ? 'hero-slide-enter' : '')}
            style={active && prev !== null ? { animationDuration: `${fadeMs}ms` } : undefined}
            aria-hidden={!active}
          >
            {slide.imageUrl && (
              <img
                src={optimizedImage(slide.imageUrl, 1800)}
                alt=""
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
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
                <p className="mt-4 max-w-xl text-base text-[#e7e6e2] sm:text-lg">{slide.subtext}</p>
              )}
              {slide.ctaLabel && active && (
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
        <>
          <button
            type="button"
            onClick={() => goTo(previous)}
            aria-label={t('storefront.prevSlide')}
            className={arrowClass + ' start-3'}
          >
            {chevron('M15 5l-7 7 7 7')}
          </button>
          <button
            type="button"
            onClick={() => goTo(next)}
            aria-label={t('storefront.nextSlide')}
            className={arrowClass + ' end-3'}
          >
            {chevron('M9 5l7 7-7 7')}
          </button>

          <div className="absolute bottom-5 start-1/2 z-20 flex -translate-x-1/2 gap-2 rtl:translate-x-1/2">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`${i + 1}`}
                aria-current={i === current}
                className={
                  'h-2 rounded-full transition-all ' +
                  (i === current ? 'w-8 bg-brass' : 'w-2 bg-[#fff]/50 hover:bg-[#fff]/80')
                }
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
