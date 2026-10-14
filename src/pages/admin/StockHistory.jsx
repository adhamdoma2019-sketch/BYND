import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTenant } from '../../context/TenantContext';
import { useLanguage } from '../../context/LanguageContext';
import AdminTopBar from '../../components/admin/AdminTopBar';
import { listMovements } from '../../firebase/stock.service';
import { MOVEMENT_TYPES } from '../../utils/stock';
import { formatPrice } from '../../utils/format';
import { toCsv, downloadFile } from '../../utils/csv';

// Every change of stock: what happened, how many, who did it and when.
export default function StockHistory() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { tenant } = useTenant();
  const [params, setParams] = useSearchParams();

  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [type, setType] = useState('all');
  const productFilter = params.get('product') || 'all';

  useEffect(() => {
    if (!tenant) return;
    listMovements(tenant.id)
      .then(setMovements)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [tenant]);

  const nameOf = (m) => m.productName?.[language] || m.productName?.en || m.productId;

  const products = useMemo(() => {
    const map = new Map();
    movements.forEach((m) => map.set(m.productId, nameOf(m)));
    return [...map];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movements, language]);

  const shown = movements.filter(
    (m) => (productFilter === 'all' || m.productId === productFilter) && (type === 'all' || m.type === type)
  );

  const when = (ts) =>
    ts?.seconds
      ? new Date(ts.seconds * 1000).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-GB', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : '';
  const money = (n) => formatPrice(n, language);
  const details = (m) =>
    [
      m.orderLabel && `${t('stock.order')} ${m.orderLabel}`,
      m.unitCost !== null && m.unitCost !== undefined && m.type === 'restock' && `${t('stock.unitCost')} ${money(m.unitCost)}`,
      m.totalCost !== null && m.totalCost !== undefined && m.type === 'restock' && `${t('stock.totalCostShort')} ${money(m.totalCost)}`,
      m.note,
    ]
      .filter(Boolean)
      .join(' · ');

  function exportFile() {
    const csv = toCsv(
      [
        { header: t('exports.date'), value: (m) => when(m.at) },
        { header: t('exports.name'), value: nameOf },
        { header: t('exports.type'), value: (m) => t(`stock.type.${m.type}`, { defaultValue: m.type }) },
        { header: t('stock.change'), value: (m) => m.delta },
        { header: t('stock.after'), value: (m) => m.stockAfter },
        { header: t('stock.details'), value: details },
        { header: t('stock.by'), value: (m) => (m.actorUid === 'customer' ? t('stock.customer') : m.actorName) },
      ],
      shown
    );
    downloadFile(`stock-history-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  const select = 'rounded border border-ink/15 bg-white px-3 py-2 text-sm';

  return (
    <div className="min-h-screen px-6 py-10">
      <AdminTopBar />
      <h1 className="font-display text-2xl font-semibold">{t('stock.title')}</h1>
      <p className="mb-6 mt-1 max-w-xl text-sm text-ink-soft">{t('stock.help')}</p>

      <div className="mb-6 flex flex-wrap gap-3">
        <select
          value={productFilter}
          onChange={(e) => setParams(e.target.value === 'all' ? {} : { product: e.target.value })}
          className={select}
        >
          <option value="all">{t('stock.allProducts')}</option>
          {products.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} className={select}>
          <option value="all">{t('stock.allTypes')}</option>
          {MOVEMENT_TYPES.map((ty) => (
            <option key={ty} value={ty}>
              {t(`stock.type.${ty}`)}
            </option>
          ))}
        </select>
        {shown.length > 0 && (
          <button
            onClick={exportFile}
            className="rounded border border-ink/15 px-3 py-2 text-sm text-ink-soft hover:border-brass hover:text-brass"
          >
            {t('exports.button')}
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-ink-soft">{t('common.loading')}</p>
      ) : failed ? (
        <p className="text-rust">{t('stock.loadFailed')}</p>
      ) : shown.length === 0 ? (
        <p className="text-ink-soft">{t('stock.none')}</p>
      ) : (
        <div className="max-w-4xl divide-y divide-ink/10 rounded-md border border-ink/10 bg-white">
          {shown.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <p>
                  <strong>{nameOf(m)}</strong>{' '}
                  <span className="rounded bg-paper-dim px-2 py-0.5 text-xs text-ink-soft">
                    {t(`stock.type.${m.type}`, { defaultValue: m.type })}
                  </span>
                </p>
                <p className="text-xs text-ink-faint">
                  {when(m.at)} ·{' '}
                  {m.actorUid === 'customer' ? t('stock.customer') : m.actorName || '—'}
                  {details(m) && ` · ${details(m)}`}
                </p>
              </div>
              <div className="text-end">
                <p className={m.delta > 0 ? 'font-medium text-sage-dark' : 'font-medium text-rust'} dir="ltr">
                  {m.delta > 0 ? `+${m.delta}` : m.delta}
                </p>
                <p className="text-xs text-ink-faint">{t('stock.stockAfter', { n: m.stockAfter })}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
