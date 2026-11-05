import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import { receiptModel, mailtoLink } from '../../utils/receipt';
import { receiptPngBlob, receiptPdfBlob, downloadBlob } from '../../utils/receiptImage';

// The receipt on the thank-you page (update 34): shows the order as it was saved, and lets the customer keep it:
// a picture, a PDF, or an email draft in their OWN email app. Nothing here is sent or stored by the shop.
export default function ReceiptCard({ receipt, shopName = '', accent = '', trackUrl = '' }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [busy, setBusy] = useState('');
  const [failed, setFailed] = useState(false);
  const rtl = language === 'ar';

  const rows = useMemo(
    () => receiptModel(receipt, { language, shopName, t, trackUrl }),
    [receipt, language, shopName, t, trackUrl]
  );
  const base = `receipt-${receipt.orderNumberLabel || 'order'}`;

  async function save(kind) {
    setBusy(kind);
    setFailed(false);
    try {
      if (kind === 'png') downloadBlob(await receiptPngBlob(rows, { rtl, accent }), `${base}.png`);
      else downloadBlob(receiptPdfBlob(rows, { rtl, accent }), `${base}.pdf`);
    } catch {
      setFailed(true);
    } finally {
      setBusy('');
    }
  }

  const mail = mailtoLink({
    to: receipt.customer?.email || '',
    subject: t('receipt.emailSubject', { number: receipt.orderNumberLabel, shop: shopName }),
    rows,
  });
  const button =
    'rounded border border-ink/20 px-4 py-2 text-center text-sm font-medium hover:border-brass disabled:opacity-50';

  return (
    <section className="mt-6 w-full max-w-md text-start" data-receipt>
      <h2 className="text-center font-display text-lg font-semibold">{t('receipt.heading')}</h2>
      <div className="mt-3 rounded-md border border-ink/10 bg-white p-4 text-sm text-ink" data-receipt-card>
        {rows.map((r, i) => {
          if (r.kind === 'title') return <p key={i} className="text-center font-display text-lg font-semibold">{r.text}</p>;
          if (r.kind === 'subtitle') return <p key={i} className="text-center text-xs text-ink-soft">{r.text}</p>;
          if (r.kind === 'rule') return <hr key={i} className="my-3 border-ink/10" />;
          if (r.kind === 'pair' || r.kind === 'total') {
            return (
              <div key={i} className={`flex justify-between gap-4 py-0.5 ${r.kind === 'total' ? 'text-base font-semibold' : ''}`}>
                <span className={r.kind === 'total' ? '' : 'text-ink-soft'}>{r.label}</span>
                <span className={`text-end ${r.strong ? 'font-semibold' : ''}`}>{r.value}</span>
              </div>
            );
          }
          if (r.kind === 'item') {
            return (
              <div key={i} className="py-1">
                <div className="flex justify-between gap-4 font-medium">
                  <span>{r.name}</span>
                  <span className="shrink-0">{r.amount}</span>
                </div>
                {r.details.map((d, k) => (
                  <p key={k} className="text-xs text-ink-soft">{d}</p>
                ))}
                {r.tag && <p className="text-xs font-semibold text-brass-dark">{r.tag}</p>}
              </div>
            );
          }
          if (r.kind === 'note') return <p key={i} className="text-xs text-ink-soft">{r.text}</p>;
          return null;
        })}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <button type="button" onClick={() => save('png')} disabled={busy !== ''} className={button} data-receipt-png>
          {busy === 'png' ? t('receipt.preparing') : t('receipt.savePicture')}
        </button>
        <button type="button" onClick={() => save('pdf')} disabled={busy !== ''} className={button} data-receipt-pdf>
          {busy === 'pdf' ? t('receipt.preparing') : t('receipt.savePdf')}
        </button>
        <a href={mail} className={button} data-receipt-mail>
          {t('receipt.emailMe')}
        </a>
      </div>
      {failed && <p className="mt-2 text-center text-xs text-rust" role="alert">{t('receipt.saveFailed')}</p>}
      <p className="mt-2 text-center text-xs text-ink-faint">{t('receipt.emailHint')}</p>
    </section>
  );
}
