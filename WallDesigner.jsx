import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  WALL_MAX,
  keyOf,
  freeSpots,
  canAdd,
  canRemove,
  addCell,
  removeCell,
  resizeLayout,
  randomLayout,
  toPixel,
  hexPoints,
  viewBoxFor,
} from '../../utils/wallLayout';
import { assignColours, shuffleColours } from '../../utils/wallColors';
import { pinchZoom, fingerDistance, fingerMiddle, scrollAfterZoom } from '../../utils/pinch';

// "Plan your wall" (update 27, step 1). The number of pieces IS the quantity of the order:
// the page owns the quantity (`quantity` / `onQuantity`), this component draws the wall that matches it.
// Colours per piece and saving the layout with the order come in step 2.
const SIZE = 22; // size of one hexagon in the drawing (the picture scales to the screen)
const ZOOM_MIN = 0.6;
const ZOOM_MAX = 4;
// (useLayoutEffect only exists in the browser; the server render just uses useEffect)
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// Update 33: the colour list sits right above the wall (`paintBox`), no colour is pre-selected (pieces stay neutral until
// one is picked), a chip says which colour is being painted with, and the first pick paints the pieces that have none.
// Colours (update 28): with a `palette` ([{ id, label, color }]) every piece has a colour `c`. `paint` is the colour
// the customer has picked in the page's colour list; `limitOf(id)` = how many pieces of that colour can be ordered.
export default function WallDesigner({
  quantity,
  min = 1,
  max = WALL_MAX,
  onQuantity,
  onCells,
  palette = null,
  paint = '',
  limitOf = () => Infinity,
  totalText = '',
  paintBox = null, // the colour list, drawn right above the wall (update 33)
  needColour = false, // the customer tried to add the wall without a colour
}) {
  const { t } = useTranslation();
  const cap = Math.max(min, Math.min(max, WALL_MAX));
  const colored = Array.isArray(palette) && palette.length > 0;
  const ids = colored ? palette.map((p) => p.id) : [];
  const hexOf = (id) => palette?.find((p) => p.id === id)?.color;
  const paintOk = colored && ids.includes(paint);
  const countOf = (list, id) => list.filter((c) => c.c === id).length;
  const withColours = (list) => (colored ? assignColours(list, ids, limitOf, paint) : list);
  const [cells, setCells] = useState(() => withColours(resizeLayout([], quantity, { min, max: cap })));
  const [zoom, setZoom] = useState(1);
  const [draft, setDraft] = useState(null); // what the customer is typing in the count box
  const [notice, setNotice] = useState('');
  const noticeTimer = useRef(null);

  // ----- two-finger zoom (phones): the box scrolls by itself with one finger, two fingers zoom -----
  const boxRef = useRef(null);
  const svgRef = useRef(null);
  const fingers = useRef(new Map()); // pointerId -> { x, y }
  const pinch = useRef(null); // { startDistance, startZoom } while two fingers are down
  const pendingScroll = useRef(null); // where to scroll after the picture changed size
  const quietUntil = useRef(0); // taps right after a pinch must not add / remove pieces

  const onFingerDown = (e) => {
    fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (fingers.current.size === 2) {
      const [a, b] = [...fingers.current.values()];
      pinch.current = { startDistance: fingerDistance(a, b), startZoom: zoom };
      quietUntil.current = Date.now() + 500;
    }
  };
  const onFingerMove = (e) => {
    if (!fingers.current.has(e.pointerId)) return;
    fingers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (fingers.current.size !== 2 || !pinch.current) return;
    quietUntil.current = Date.now() + 500;
    const [a, b] = [...fingers.current.values()];
    const next = pinchZoom(pinch.current.startZoom, pinch.current.startDistance, fingerDistance(a, b), ZOOM_MIN, ZOOM_MAX);
    if (next === zoom) return;
    const box = boxRef.current;
    const svg = svgRef.current;
    if (box && svg) {
      const rect = svg.getBoundingClientRect();
      const boxRect = box.getBoundingClientRect();
      pendingScroll.current = {
        scroll: { left: box.scrollLeft, top: box.scrollTop },
        point: fingerMiddle(a, b),
        box: { left: boxRect.left, top: boxRect.top },
        oldSize: { w: rect.width, h: rect.height },
      };
    }
    setZoom(next);
  };
  const onFingerUp = (e) => {
    fingers.current.delete(e.pointerId);
    if (fingers.current.size < 2) {
      if (pinch.current) quietUntil.current = Date.now() + 500;
      pinch.current = null;
    }
  };

  // after zooming: keep the spot between the fingers where it was
  useIsoLayoutEffect(() => {
    const p = pendingScroll.current;
    pendingScroll.current = null;
    const box = boxRef.current;
    const svg = svgRef.current;
    if (!p || !box || !svg) return;
    const rect = svg.getBoundingClientRect();
    const to = scrollAfterZoom({ ...p, newSize: { w: rect.width, h: rect.height } });
    box.scrollLeft = to.left;
    box.scrollTop = to.top;
  }, [zoom]);

  // The quantity can also change from outside (a click in the price table): the wall follows it.
  useEffect(() => {
    if (cells.length !== quantity) setCells((cur) => withColours(resizeLayout(cur, quantity, { min, max: cap })));
  }, [quantity, min, cap]); // eslint-disable-line react-hooks/exhaustive-deps

  // The first colour the customer picks paints the pieces that have no colour yet (later picks only affect new taps).
  useEffect(() => {
    if (!paintOk) return;
    setCells((cur) => (cur.some((c) => !c.c) ? withColours(cur) : cur));
  }, [paint]); // eslint-disable-line react-hooks/exhaustive-deps

  // The page needs to know the pieces (and their colours) to add the right lines to the cart.
  useEffect(() => {
    if (onCells) onCells(cells);
  }, [cells]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  const say = (key, vars) => {
    setNotice(t(key, vars));
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 2500);
  };

  const apply = (next) => {
    setCells(next);
    onQuantity(next.length);
  };

  const spots = cells.length < cap ? freeSpots(cells) : [];
  const vb = viewBoxFor(cells, spots, SIZE);
  const hexAction = (fn) => (e) => {
    if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (Date.now() < quietUntil.current) return; // a pinch is not a tap
    fn();
  };

  const setCount = (n) => {
    setDraft(null);
    apply(withColours(resizeLayout(cells, n, { min, max: cap })));
  };

  // a new piece next to the wall, in the picked colour
  const place = (spot) => {
    if (!canAdd(cells, spot, cap)) return;
    if (colored) {
      if (!paintOk) return say('wall.pickColour');
      if (countOf(cells, paint) >= limitOf(paint)) return say('wall.colourLimit', { n: limitOf(paint) });
      apply([...cells, { q: spot.q, r: spot.r, c: paint }]);
      return;
    }
    apply(addCell(cells, spot, cap));
  };

  // tap a piece: another colour = paint it; same colour (or no colours) = take it away
  const tapPiece = (c) => {
    if (colored && !paintOk) return say('wall.pickColour'); // pick a colour first (no accidental removals)
    if (colored && c.c !== paint) {
      if (countOf(cells, paint) >= limitOf(paint)) return say('wall.colourLimit', { n: limitOf(paint) });
      setCells(cells.map((x) => (keyOf(x) === keyOf(c) ? { ...x, c: paint } : x)));
      return;
    }
    if (canRemove(cells, c, min)) apply(removeCell(cells, c, min));
    else say(cells.length <= min ? 'wall.cannotRemoveMin' : 'wall.cannotRemoveSplit');
  };

  const randomise = () => {
    const shape = randomLayout(cells.length, Math.random, { max: cap });
    if (!colored) return setCells(shape);
    const mixed = shuffleColours(cells.map((c) => c.c));
    setCells(shape.map((c, i) => ({ ...c, c: mixed[i] })));
  };

  const used = colored ? palette.map((p) => ({ ...p, n: countOf(cells, p.id) })).filter((p) => p.n > 0) : [];

  return (
    <div className="mt-8" data-wall-designer>
      <p className="text-sm font-medium">{t('wall.title')}</p>
      <p className="mt-1 text-xs text-ink-soft">{t('wall.hint')}</p>

      {/* the colour choices, right next to the wall */}
      {colored && (
        <div id="wall-paint" className="mt-4 scroll-mt-24" data-wall-paint>
          {paintBox}
          <p className="mt-2 text-xs text-ink-soft" data-wall-paint-hint>
            {t('wall.paintHint')}
          </p>
          {needColour && !paintOk && (
            <p className="mt-2 text-sm text-rust" role="alert" data-wall-need-colour>
              {t('wall.pickColourToAdd')}
            </p>
          )}
        </div>
      )}

      <div className="mt-3 rounded border border-ink/15 bg-paper-soft">
        <div className="flex items-center gap-2 border-b border-ink/10 p-2">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(ZOOM_MAX, +(z * 1.25).toFixed(3)))}
            disabled={zoom >= ZOOM_MAX}
            className="h-11 w-11 rounded border border-ink/15 text-lg hover:border-brass disabled:opacity-40"
            aria-label={t('wall.zoomIn')}
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(ZOOM_MIN, +(z / 1.25).toFixed(3)))}
            disabled={zoom <= ZOOM_MIN}
            className="h-11 w-11 rounded border border-ink/15 text-lg hover:border-brass disabled:opacity-40"
            aria-label={t('wall.zoomOut')}
          >
            −
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="h-11 rounded border border-ink/15 px-3 text-xs hover:border-brass"
          >
            {t('wall.fit')}
          </button>
        </div>

        {colored && (
          <div className="flex items-center gap-2 border-b border-ink/10 px-3 py-2 text-sm" data-wall-chip>
            {paintOk ? (
              <>
                <span
                  className="inline-block h-4 w-4 shrink-0 rounded-full border border-ink/30"
                  style={{ backgroundColor: hexOf(paint) }}
                />
                <span>{t('wall.paintingWith', { name: palette.find((p) => p.id === paint)?.label || '' })}</span>
              </>
            ) : (
              <span className={needColour ? 'text-rust' : 'text-ink-faint'}>{t('wall.noColourYet')}</span>
            )}
          </div>
        )}

        <div
          ref={boxRef}
          className="max-h-[26rem] overflow-auto p-2"
          dir="ltr"
          style={{ touchAction: 'pan-x pan-y' }}
          onPointerDown={onFingerDown}
          onPointerMove={onFingerMove}
          onPointerUp={onFingerUp}
          onPointerCancel={onFingerUp}
          onPointerLeave={onFingerUp}
          data-wall-box
        >
          <svg
            ref={svgRef}
            viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
            style={{ width: `${zoom * 100}%`, minWidth: 0 }}
            className="mx-auto block"
            role="group"
            aria-label={t('wall.title')}
          >
            {/* free places: dashed hexagon with a plus */}
            {spots.map((s) => {
              const p = toPixel(s, SIZE);
              const open = canAdd(cells, s, cap);
              return (
                <g
                  key={keyOf(s)}
                  role="button"
                  tabIndex={open ? 0 : -1}
                  aria-label={t('wall.addHere')}
                  onClick={hexAction(() => open && place(s))}
                  onKeyDown={hexAction(() => open && place(s))}
                  className="cursor-pointer outline-none [&:focus-visible>polygon]:stroke-brass"
                  data-spot
                >
                  <polygon
                    points={hexPoints(p.x, p.y, SIZE - 1)}
                    className="fill-transparent stroke-ink-faint"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={p.x}
                    y={p.y + 5}
                    textAnchor="middle"
                    fontSize="14"
                    className="fill-ink-faint"
                    pointerEvents="none"
                  >
                    +
                  </text>
                </g>
              );
            })}

            {/* placed pieces */}
            {cells.map((c) => {
              const p = toPixel(c, SIZE);
              const fill = colored && c.c ? hexOf(c.c) : undefined;
              return (
                <g
                  key={keyOf(c)}
                  role="button"
                  tabIndex={0}
                  aria-label={t('wall.removeThis')}
                  onClick={hexAction(() => tapPiece(c))}
                  onKeyDown={hexAction(() => tapPiece(c))}
                  className="cursor-pointer outline-none [&:focus-visible>polygon]:stroke-brass"
                  data-cell
                >
                  <polygon
                    points={hexPoints(p.x, p.y, SIZE - 1)}
                    style={fill ? { fill } : undefined}
                    className={fill ? 'stroke-ink' : 'fill-brass/25 stroke-ink'}
                    strokeWidth="1.5"
                  />
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={SIZE * 0.42}
                    className={fill ? 'fill-transparent' : 'fill-transparent stroke-ink-soft'}
                    stroke={fill ? '#ffffff' : undefined}
                    strokeOpacity={fill ? 0.6 : undefined}
                    strokeWidth="1.5"
                    data-ring
                  />
                </g>
              );
            })}
          </svg>
        </div>
        <p className="min-h-[1.25rem] px-3 pb-2 text-xs text-brass-dark" role="status" aria-live="polite">
          {notice}
        </p>

        <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-t border-ink/10 p-2">
          <input
            type="number"
            inputMode="numeric"
            min={min}
            max={cap}
            value={draft ?? cells.length}
            onChange={(e) => {
              setDraft(e.target.value);
              const n = parseInt(e.target.value, 10);
              if (Number.isInteger(n) && n >= min) apply(withColours(resizeLayout(cells, n, { min, max: cap })));
            }}
            onBlur={() => setDraft(null)}
            aria-label={t('wall.count')}
            className="h-11 min-w-0 rounded border border-ink/15 bg-transparent text-center text-lg outline-none focus-visible:border-brass"
          />
          <button
            type="button"
            onClick={() => setCount(cells.length - 1)}
            disabled={cells.length <= min}
            className="h-11 w-11 rounded border border-ink/15 text-lg hover:border-brass disabled:opacity-40"
            aria-label={t('wall.fewer')}
          >
            −
          </button>
          <button
            type="button"
            onClick={() => setCount(cells.length + 1)}
            disabled={cells.length >= cap}
            className="h-11 w-11 rounded border border-ink/15 text-lg hover:border-brass disabled:opacity-40"
            aria-label={t('wall.more')}
          >
            +
          </button>
          <button
            type="button"
            onClick={randomise}
            className="col-span-1 h-11 rounded border border-ink/15 px-3 text-sm hover:border-brass"
          >
            {t('wall.random')}
          </button>
          <button
            type="button"
            onClick={() => apply(withColours(resizeLayout([], min, { min, max: cap })))}
            className="col-span-2 h-11 rounded border border-ink/15 px-3 text-sm hover:border-brass"
          >
            {t('wall.clear')}
          </button>
        </div>
      </div>
      {used.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm" data-wall-legend>
          {used.map((p) => (
            <li key={p.id} className="flex items-center gap-1.5">
              <span className="inline-block h-3.5 w-3.5 rounded-sm border border-ink/30" style={{ backgroundColor: p.color }} />
              {t('wall.legendItem', { n: p.n, name: p.label })}
            </li>
          ))}
        </ul>
      )}
      {totalText && <p className="mt-2 text-sm font-medium">{t('wall.total', { price: totalText })}</p>}
      <p className="mt-2 text-xs text-ink-soft">{t('wall.maxNote', { n: cap })}</p>
    </div>
  );
}
