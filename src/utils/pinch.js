// Two-finger zoom (update 30): the maths only, so it can be tested. The screen code is in WallDesigner.jsx.

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const fingerDistance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const fingerMiddle = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

// The new zoom while two fingers move apart / together (relative to where the gesture started).
export function pinchZoom(startZoom, startDistance, nowDistance, lo, hi) {
  if (!(startDistance > 0) || !(nowDistance > 0)) return clamp(startZoom, lo, hi);
  return clamp(+((startZoom * nowDistance) / startDistance).toFixed(3), lo, hi);
}

// Keep the spot between the fingers where it is while the picture grows or shrinks:
//   scroll   = how far the box is scrolled now { left, top }
//   point    = the middle between the fingers on the screen { x, y }
//   box      = the scroll box on the screen { left, top }
//   oldSize / newSize = the size of the picture before / after zooming { w, h }
// returns the scroll position to set after zooming.
export function scrollAfterZoom({ scroll, point, box, oldSize, newSize }) {
  const px = point.x - box.left;
  const py = point.y - box.top;
  const fx = oldSize.w > 0 ? (scroll.left + px) / oldSize.w : 0.5;
  const fy = oldSize.h > 0 ? (scroll.top + py) / oldSize.h : 0.5;
  return {
    left: Math.max(0, Math.round(fx * newSize.w - px)),
    top: Math.max(0, Math.round(fy * newSize.h - py)),
  };
}
