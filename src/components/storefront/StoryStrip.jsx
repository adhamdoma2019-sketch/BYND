import FadeImage from './FadeImage';
import { optimizedImage, imageSrcSet, CARD_WIDTHS } from '../../utils/images';

// Design step 7: the shop's own short brand story (a title, a few lines, up to 4 real photos).
// It only exists when the shop wrote it in Admin > Settings > Content: nothing is invented.
export default function StoryStrip({ story }) {
  if (!story) return null;
  const { title, text, images } = story;
  const cols = images.length >= 3 ? 'grid-cols-2 sm:grid-cols-4' : images.length === 2 ? 'grid-cols-2' : 'grid-cols-1';
  return (
    <section className="mt-20 border-t border-ink/10 pt-14 sm:mt-24" data-story>
      <div className="mx-auto max-w-2xl text-center">
        {title && <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>}
        {text && <p className={'whitespace-pre-line text-ink-soft ' + (title ? 'mt-4' : '')}>{text}</p>}
      </div>
      {images.length > 0 && (
        <div className={`mt-10 grid gap-3 sm:gap-4 ${cols}`} data-story-photos>
          {images.map((url, i) => (
            <div key={url + i} className={'overflow-hidden rounded-md bg-paper-dim ' + (images.length === 1 ? 'mx-auto aspect-[16/10] w-full max-w-3xl' : 'aspect-[4/5]')}>
              <FadeImage
                src={optimizedImage(url, 700)}
                srcSet={imageSrcSet(url, CARD_WIDTHS)}
                sizes={images.length === 1 ? '(min-width: 768px) 768px, 100vw' : '(min-width: 640px) 25vw, 50vw'}
                alt={title || ''}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
