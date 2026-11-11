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
export const MAX_VIDEO_MB = 40; // a short phone video (10-20 s); Cloudinary's free plan allows more, phones' data does not

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

// Step 10: a short product video, uploaded the same way as a picture (Cloudinary 'video' endpoint).
export async function uploadVideo(file) {
  const fail = (code) => Object.assign(new Error(code), { code });
  if (!file.type.startsWith('video/')) throw fail('NOT_VIDEO');
  if (file.size > MAX_VIDEO_MB * 1024 * 1024) throw fail('TOO_BIG');
  const body = new FormData();
  body.append('file', file);
  body.append('upload_preset', PRESET);
  let response;
  try {
    response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/video/upload`, { method: 'POST', body });
  } catch {
    throw fail('FAILED');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.secure_url) throw fail('FAILED');
  return data.secure_url;
}

// A Cloudinary video is delivered in the best format and size for the phone (f_auto, q_auto, never
// enlarged, 900 px wide). Other links are used as they are.
export function optimizedVideo(url, width = 900) {
  if (!url || !url.includes('res.cloudinary.com') || !url.includes('/video/upload/')) return url;
  const [start, end] = url.split('/video/upload/');
  if (/^(?:[a-z]_[^/]+,?)+\//.test(end)) return url; // already has settings
  return `${start}/video/upload/f_auto,q_auto,c_limit,w_${width}/${end}`;
}

// The still picture shown before the video plays: the first frame of a Cloudinary video as a small
// JPEG. Returns '' for other links (the page then uses the product's first photo).
export function videoPoster(url, width = 900) {
  if (!url || !url.includes('res.cloudinary.com') || !url.includes('/video/upload/')) return '';
  const [start, end] = url.split('/video/upload/');
  const clean = end.replace(/^(?:[a-z]_[^/]+,?)+\//, '');
  return `${start}/video/upload/so_0,f_jpg,q_auto,c_limit,w_${width}/${clean.replace(/\.[a-z0-9]+(\?.*)?$/i, '')}.jpg`;
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
