import { useTranslation } from 'react-i18next';

// Shown on an admin page when its data could not be read (no internet, or the
// database refused). Without it the page would say "Loading..." for ever.
//   message   optional: a more specific sentence (default: the general one)
//   onRetry   what the "Try again" button does (usually: load the page's data again)
export default function LoadError({ message, onRetry, retryLabel }) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className="max-w-xl rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800"
    >
      <p>{message || t('common.loadError')}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded border border-red-300 px-3 py-1.5 hover:bg-red-100"
        >
          {retryLabel || t('common.retry')}
        </button>
      )}
    </div>
  );
}
