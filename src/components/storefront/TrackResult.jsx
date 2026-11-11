import { useTranslation } from 'react-i18next';
import OrderProgress, { progressIndex } from './OrderProgress';
import WhatsAppOrderButton from './WhatsAppOrderButton';

function formatWhen(timestamp, language) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

// What the customer sees after tracking: the progress line, the status in words, what happens next,
// the dates, and a WhatsApp button about this order. Only status + dates: never names, addresses or prices.
export default function TrackResult({ result, tenant, language }) {
  const { t } = useTranslation();
  const history = result?.history || [];
  const idx = progressIndex(result.status);
  return (
    <section aria-live="polite" className="mt-10 rounded-md border border-ink/10 bg-paper-soft p-5" data-track-result>
      <p className="text-sm text-ink-soft">
        {t('track.orderNumber')}: <span dir="ltr">{result.orderNumberLabel}</span>
      </p>
      <OrderProgress status={result.status} />
      <h2 className="font-display mt-6 text-2xl font-semibold">{t(`track.status.${result.status}`)}</h2>
      <p className="mt-2 text-ink-soft">{t(`track.desc.${result.status}`)}</p>
      {idx >= 0 && idx < 3 && (
        <p className="mt-3 text-sm font-medium text-ink" data-track-next>
          {t(`track.next.${result.status}`)}
        </p>
      )}
      {result.orderType === 'preorder' && (
        <p className="mt-3 rounded border border-brass/30 bg-brass/10 px-3 py-2 text-sm text-brass-dark">
          {t('track.preorderNote')}
        </p>
      )}

      {history.length > 0 && (
        <>
          <h3 className="mt-6 text-sm font-semibold uppercase tracking-wider text-ink-soft">{t('track.timeline')}</h3>
          <ol className="mt-3 space-y-3 border-s border-ink/15 ps-4">
            {history.map((h, i) => (
              <li key={`${h.status}-${i}`} className="text-sm">
                <span className="font-medium text-ink">{t(`track.status.${h.status}`)}</span>
                <span className="block text-ink-faint">{formatWhen(h.timestamp, language)}</span>
              </li>
            ))}
          </ol>
        </>
      )}

      <div className="mt-6 flex justify-center">
        <WhatsAppOrderButton tenant={tenant} orderNumber={result.orderNumberLabel} />
      </div>
    </section>
  );
}
