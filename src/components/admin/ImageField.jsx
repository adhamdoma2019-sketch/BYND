import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { uploadImage, uploadsEnabled } from '../../utils/images';

// A picture field: upload a file (when Cloudinary is connected) or paste a link.
export default function ImageField({ label, value, onChange }) {
  const { t } = useTranslation();
  const fileInput = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // lets the same file be chosen again
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      onChange(await uploadImage(file));
    } catch (err) {
      setError(
        err.code === 'NOT_IMAGE'
          ? t('upload.notImage')
          : err.code === 'TOO_BIG'
            ? t('upload.tooBig')
            : t('upload.failed')
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="text-sm text-ink-soft">
      {label}
      <div className="mt-1 flex gap-2">
        <input
          type="url"
          dir="ltr"
          placeholder="https://..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass"
        />
        {uploadsEnabled && (
          <>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              className="shrink-0 rounded border border-ink/15 px-3 text-ink hover:border-brass disabled:opacity-60"
            >
              {uploading ? t('upload.uploading') : t('upload.choose')}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              onChange={handleFile}
              className="hidden"
            />
          </>
        )}
      </div>
      {!uploadsEnabled && (
        <span className="mt-1 block text-xs text-ink-faint">{t('upload.notSetUp')}</span>
      )}
      {error && <span className="mt-1 block text-xs text-rust">{error}</span>}
    </div>
  );
}
