// Update 46: after a new version of the shop is published, a page that was already open
// can fail to fetch a piece of code that no longer exists (for example "Track my order").
// Instead of showing "Something went wrong", the shop reloads itself ONCE.
// A guard (kept in the tab's session storage) makes sure it can never reload in a loop.

const KEY = 'chunkReloadAt';
const WINDOW_MS = 60 * 1000; // at most one automatic reload per minute

export function isChunkLoadError(error) {
  const text = `${error?.name || ''} ${error?.message || ''}`;
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk [^ ]+ failed|Loading CSS chunk|ChunkLoadError/i.test(text);
}

// Returns true (and remembers the time) only when an automatic reload is allowed now.
export function allowAutoReload(storage, now = Date.now()) {
  if (!storage) return false;
  try {
    const last = Number(storage.getItem(KEY) || 0);
    if (last && now - last < WINDOW_MS) return false;
    storage.setItem(KEY, String(now));
    return true;
  } catch {
    // No usable storage (private mode): do NOT reload, we could not stop a loop.
    return false;
  }
}

// Reloads the page once if this error is a "code piece missing" error. Returns true if it reloaded.
export function reloadIfChunkError(error, win = typeof window !== 'undefined' ? window : null) {
  if (!win || !isChunkLoadError(error)) return false;
  let storage = null;
  try { storage = win.sessionStorage; } catch { storage = null; }
  if (!allowAutoReload(storage)) return false;
  win.location.reload();
  return true;
}

// Vite tells the page when a piece of code could not be fetched.
export function installChunkReload(win = typeof window !== 'undefined' ? window : null) {
  if (!win?.addEventListener) return;
  win.addEventListener('vite:preloadError', (event) => {
    if (reloadIfChunkError({ message: 'Failed to fetch dynamically imported module' }, win)) {
      event.preventDefault?.();
    }
  });
}
