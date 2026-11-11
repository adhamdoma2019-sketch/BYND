import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { uploadVideo, uploadsEnabled, MAX_VIDEO_MB, optimizedVideo } from '../../utils/images';

// A short product video: upload a file from the phone (when Cloudinary is connected) or paste a link.
export default function VideoField({ label, help, value, onChange }) {
  const { t } = useTranslation();
  const fileInput = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      onChange(await uploadVideo(file));
    } catch (err) {
      setError(
        err.code === 'NOT_VIDEO'
          ? t('upload.notVideo')
          : err.code === 'TOO_BIG'
            ? t('upload.videoTooBig', { mb: MAX_VIDEO_MB })
            : t('upload.videoFailed')
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="col-span-full text-sm text-ink-soft" data-video-field>
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
              className="min-h-[44px] shrink-0 rounded border border-ink/15 px-3 text-ink hover:border-brass disabled:opacity-60"
            >
              {uploading ? t('upload.uploading') : t('upload.chooseVideo')}
            </button>
            <input ref={fileInput} type="file" accept="video/*" onChange={handleFile} className="hidden" />
          </>
        )}
      </div>
      {help && <span className="mt-1 block text-xs text-ink-faint">{help}</span>}
      {!uploadsEnabled && <span className="mt-1 block text-xs text-ink-faint">{t('upload.videoNotSetUp')}</span>}
      {error && <span className="mt-1 block text-xs text-rust">{error}</span>}
      {/^https:\/\//i.test(value) && (
        <video src={optimizedVideo(value, 480)} controls playsInline preload="metadata" className="mt-2 max-h-48 rounded bg-black" />
      )}
    </div>
  );
}
