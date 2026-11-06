import { useEffect, useRef, useState } from 'react';
import { fitSize } from '../../utils/pictureText';

// The big product picture, with the words the customer typed drawn ON it (update 35).
// Always centred sideways; height, size and colour come from the product settings.
export default function PictureText({ src, alt, texts = [], className = '' }) {
  const box = useRef(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const measure = () => setWidth(el.clientWidth || 0);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [src]);

  const w = width || 400; // before the first measure (or on the server) a normal phone width

  return (
    <div ref={box} className="relative" data-picture-text>
      <img src={src} alt={alt} decoding="async" className={className} />
      {texts.map((x) => (
        <div
          key={x.id}
          data-picture-text-line
          dir="auto"
          style={{
            position: 'absolute',
            insetInline: 0,
            top: `${x.y}%`,
            transform: 'translateY(-50%)',
            textAlign: 'center',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            pointerEvents: 'none',
            lineHeight: 1.1,
            color: x.color,
            fontWeight: x.bold ? 700 : 400,
            fontSize: `${(w * fitSize(x.size, x.text)) / 100}px`,
          }}
        >
          {x.text}
        </div>
      ))}
    </div>
  );
}
