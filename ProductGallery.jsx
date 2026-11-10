import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import PictureText from './PictureText';
import { optimizedImage } from '../../utils/images';

// Design step 3: the product photos as a swipeable strip with dots (phones swipe natively,
// computers use the small arrows or the dots). The picture of a picked colour/choice is
// scrolled into view by the page (`shown`). The customer's typed words are drawn on every
// slide exactly like before (update 35). Nothing here is invented: only the product's photos.
export default function ProductGallery({ pictures, shown, onShow, name, texts }) {
  const { t } = useTranslation();
  const strip = useRef(null);
  const shownIndex = Math.max(0, pictures.indexOf(shown));
  const [index, setIndex] = useState(shownIndex);
  const moving = useRef(null); // set while the page itself scrolls the strip (a colour was picked): ignore those scroll events

  useEffect(() => () => clearTimeout(moving.current), []);

  // Follow the page: a colour/choice picture (or a dot) was picked -> scroll to that slide.
  useEffect(() => {
    setIndex(shownIndex);
    const el = strip.current;
    if (!el || !el.clientWidth) return;
    // In right-to-left pages scrollLeft is negative: work with the sign.
    const dir = getComputedStyle(el).direction === 'rtl' ? -1 : 1;
    const target = dir * shownIndex * el.clientWidth;
    if (Math.abs(el.scrollLeft - target) > 2) {
      const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      clearTimeout(moving.current);
      moving.current = setTimeout(() => { moving.current = null; }, smooth ? 700 : 50);
      el.scrollTo({ left: target, behavior: smooth ? 'smooth' : 'auto' });
    }
  }, [shownIndex]);

  // The customer swiped: tell the page which picture is on show (it keeps the dots in step).
  function onScroll() {
    const el = strip.current;
    if (!el || !el.clientWidth || moving.current) return;
    const i = Math.round(Math.abs(el.scrollLeft) / el.clientWidth);
    const clamped = Math.min(pictures.length - 1, Math.max(0, i));
    if (clamped !== index) {
      setIndex(clamped);
      if (pictures[clamped] !== shown) onShow(pictures[clamped]);
    }
  }

  function go(i) {
    const next = Math.min(pictures.length - 1, Math.max(0, i));
    onShow(pictures[next]);
  }

  if (pictures.length === 0) return null;

  return (
    <div data-gallery>
      <div className="relative">
        <div
          ref={strip}
          onScroll={onScroll}
          className="flex snap-x snap-mandatory overflow-x-auto rounded-md [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ scrollBehavior: 'auto' }}
        >
          {pictures.map((url, i) => (
            <div key={url} className="w-full shrink-0 snap-center" data-gallery-slide>
              <PictureText
                src={optimizedImage(url, 1000)}
                alt={name}
                texts={texts}
                className="aspect-square w-full object-cover"
                eager={i === 0}
              />
            </div>
          ))}
        </div>
        {pictures.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              disabled={index === 0}
              aria-label={t('storefront.galleryPrev')}
              className="absolute start-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-paper/80 text-ink shadow transition hover:bg-paper disabled:opacity-0 md:flex rtl:rotate-180"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              disabled={index === pictures.length - 1}
              aria-label={t('storefront.galleryNext')}
              className="absolute end-2 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-paper/80 text-ink shadow transition hover:bg-paper disabled:opacity-0 md:flex rtl:rotate-180"
            >
              ›
            </button>
          </>
        )}
      </div>

      {pictures.length > 1 && (
        <div className="mt-3 flex items-center justify-center" role="tablist" aria-label={t('storefront.galleryDots')}>
          {pictures.map((url, i) => (
            <button
              key={url}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={t('storefront.galleryPhoto', { n: i + 1, total: pictures.length })}
              onClick={() => go(i)}
              className="flex h-11 w-7 items-center justify-center"
            >
              <span
                className={
                  'block rounded-full transition-all ' +
                  (i === index ? 'h-2 w-5 bg-brass' : 'h-2 w-2 bg-ink/25')
                }
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
