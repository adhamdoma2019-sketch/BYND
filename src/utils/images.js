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
  return `${start}/upload/f_auto,q_auto,w_${width}/${end}`;
}
