// Picture upload (Cloudinary, free plan) and picture optimizing.
//
// To switch uploads on, add these two settings in Vercel and redeploy:
//   VITE_CLOUDINARY_CLOUD_NAME     your Cloudinary "cloud name"
//   VITE_CLOUDINARY_UPLOAD_PRESET  an UNSIGNED upload preset you create there
// Until then, the admin can still paste picture links.

const CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export const uploadsEnabled = Boolean(CLOUD && PRESET);
export const MAX_UPLOAD_MB = 8;

// Uploads one picture and returns its https link. Throws an Error whose
// `code` is 'NOT_IMAGE', 'TOO_BIG' or 'FAILED'.
export async function uploadImage(file) {
  const fail = (code) => Object.assign(new Error(code), { code });
  if (!file.type.startsWith('image/')) throw fail('NOT_IMAGE');
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) throw fail('TOO_BIG');

  const body = new FormData();
  body.append('file', file);
  body.append('upload_preset', PRESET);

  let response;
  try {
    response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, {
      method: 'POST',
      body,
    });
  } catch {
    throw fail('FAILED');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.secure_url) throw fail('FAILED');
  return data.secure_url;
}

// Cloudinary pictures can be resized and compressed on the fly, which makes the
// shop load much faster (especially on phones). Other links are left unchanged.
export function optimizedImage(url, width) {
  if (!url || !url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url;
  const [start, end] = url.split('/upload/');
  if (/^(?:[a-z]_[^/]+,?)+\//.test(end)) return url; // already has settings
  // c_limit = never enlarge a small original (saves bytes, no blur from upscaling)
  return `${start}/upload/f_auto,q_auto,c_limit,w_${width}/${end}`;
}

// Design step 4: several sizes of the same picture, so a phone downloads a small one and a big
// screen a big one (the browser picks, using the `sizes` text of the <img>). Returns undefined
// for pictures that are not resizable Cloudinary links (then the plain src is used).
export function imageSrcSet(url, widths) {
  const first = optimizedImage(url, widths[0]);
  if (!url || first === url) return undefined;
  return widths.map((w) => `${optimizedImage(url, w)} ${w}w`).join(', ');
}

// The width (from the same list) the browser would pick on this screen: used to get the NEXT
// banner picture ready in the cache without downloading a bigger one than the screen needs.
export function pickWidth(widths, cssWidth) {
  const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 3) : 1;
  const w = cssWidth || (typeof window !== 'undefined' ? window.innerWidth : 1200);
  const need = w * dpr;
  return widths.find((x) => x >= need) || widths[widths.length - 1];
}

export const HERO_WIDTHS = [640, 960, 1400, 1800];
export const CARD_WIDTHS = [400, 700, 1000];
export const GALLERY_WIDTHS = [500, 800, 1000];
