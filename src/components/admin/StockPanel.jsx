import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import { restockProduct, adjustStock } from '../../firebase/stock.service';
import { planRestock, planAdjust } from '../../utils/stock';
import { formatPrice } from '../../utils/format';
import { countedRows, optionTotal } from '../../utils/optionStock';

const CATEGORIES = ['manufacturing', 'materials', 'packaging', 'marketing', 'shipping', 'software', 'other'];
const input =
  'mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass';

// "Add stock" and "Adjust stock" for one product, shown under its card.
//   mode 'restock' = a batch you made or bought (can update the cost price and record the expense)
//   mode 'adjust'  = a stocktake, or damaged / lost units
export default function StockPanel({ product, cost, mode, tenantId, actor, log, onClose, onDone }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const name = product.name?.[language] || product.name?.en || '';
  const money = (n) => formatPrice(n, language);

  // ----- add stock -----
  const [quantity, setQuantity] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [note, setNote] = useState('');
  const [updateCost, setUpdateCost] = useState(true);
  const [recordExpense, setRecordExpense] = useState(false);
  const [category, setCategory] = useState('manufacturing');
  // ----- counted per colour / option: which number is this for? -----
  const rows = useMemo(() => countedRows(product), [product]);
  const counted = rows.length > 0;
  const [optionKey, setOptionKey] = useState('');
  const row = rows.find((r) => r.key === optionKey) || null;
  const groups = [];
  rows.forEach((r) => {
    let g = groups.find((x) => x.id === r.optionId);
    if (!g) {
      g = { id: r.optionId, label: r.optionLabel?.[language] || r.optionLabel?.en || r.optionId, rows: [] };
      groups.push(g);
    }
    g.rows.push(r);
  });
  // ----- adjust -----
  const [adjMode, setAdjMode] = useState('count');
  const [value, setValue] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // What would happen, shown before saving.
  const plan = useMemo(() => {
    if (counted && !row) return null;
    const current = counted ? row.left : product.stock;
    if (mode === 'restock') {
      if (quantity === '') return null;
      return planRestock({
        stock: current,
        cost,
        quantity,
        totalCost,
        // the cost price belongs to the whole product: only the first counted option may change it
        updateCost: updateCost && (!counted || row.primary),
        costUnits: counted ? optionTotal(product, row.optionId) : undefined,
      });
    }
    if (value === '') return null;
    return planAdjust({ stock: current, mode: adjMode, value });
  }, [mode, quantity, totalCost, updateCost, value, adjMode, product, cost, counted, row]);

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    if (counted && !row) {
      setError(t('stock.err.NEED_OPTION'));
      return;
    }
    if (!plan || plan.error) {
      setError(t(`stock.err.${plan?.error || 'BAD_QUANTITY'}`));
      return;
    }
    setBusy(true);
    try {
      if (mode === 'restock') {
        const r = await restockProduct(
          tenantId,
          product.id,
          { quantity, totalCost, note, updateCost, recordExpense, expenseCategory: category, optionKey },
          actor
        );
        log({
          action: 'stock.restock',
          entityType: 'product',
          entityId: product.id,
          entityLabel: product.name?.en || '',
          changes: [
            { field: 'stock', from: String(r.before), to: String(r.after) },
            ...(r.costBefore !== r.costAfter && r.costAfter !== null
              ? [{ field: 'cost', from: String(r.costBefore ?? ''), to: String(r.costAfter) }]
              : []),
          ],
        });
        onDone(t('stock.doneRestock', { q: quantity, name, n: r.after }));
      } else {
        const r = await adjustStock(tenantId, product.id, { mode: adjMode, value, note, optionKey }, actor);
        log({
          action: 'stock.adjust',
          entityType: 'product',
          entityId: product.id,
          entityLabel: product.name?.en || '',
          changes: [{ field: 'stock', from: String(r.before), to: String(r.after) }],
        });
        onDone(t('stock.doneAdjust', { name, n: r.after }));
      }
    } catch (err) {
      setError(t(`stock.err.${err.code}`, { defaultValue: t('stock.err.SERVER') }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSave}
      className="mt-3 rounded border border-ink/10 bg-paper-soft p-3 text-sm"
    >
      <div className="flex items-center justify-between">
        <p className="font-medium">
          {mode === 'restock' ? t('stock.addStock') : t('stock.adjust')}
        </p>
        <button type="button" onClick={onClose} className="text-ink-soft hover:underline">
          {t('stock.close')}
        </button>
      </div>
      {counted ? (
        <div className="mt-2">
          <label className="block text-ink-soft">
            {t('stock.chooseOption')}
            <select value={optionKey} onChange={(e) => setOptionKey(e.target.value)} className={input}>
              <option value="">{t('checkout.choose')}</option>
              {groups.map((g) => (
                <optgroup key={g.id} label={g.label}>
                  {g.rows.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.valueLabel?.[language] || r.valueLabel?.en} ({r.left})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          {row && (
            <p className="mt-1 text-xs text-ink-faint">{t('stock.currentStock', { n: row.left })}</p>
          )}
        </div>
      ) : (
        <p className="mt-1 text-xs text-ink-faint">{t('stock.currentStock', { n: product.stock })}</p>
      )}

      {mode === 'restock' ? (
        <div className="mt-3 space-y-3">
          <label className="block text-ink-soft">
            {t('stock.quantity')}
            <input
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className={input}
            />
          </label>
          <label className="block text-ink-soft">
            {t('stock.totalCost')}
            <input
              type="number"
              min="0"
              step="0.01"
              value={totalCost}
              onChange={(e) => setTotalCost(e.target.value)}
              className={input}
            />
            <span className="mt-1 block text-xs text-ink-faint">{t('stock.totalCostHint')}</span>
          </label>
          <label className="block text-ink-soft">
            {t('stock.note')}
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className={input} />
          </label>
          {totalCost !== '' && (!counted || !row || row.primary) && (
            <>
              <label className="flex items-center gap-2 text-ink-soft">
                <input type="checkbox" checked={updateCost} onChange={(e) => setUpdateCost(e.target.checked)} />
                {t('stock.updateCost')}
              </label>
              <label className="flex items-center gap-2 text-ink-soft">
                <input
                  type="checkbox"
                  checked={recordExpense}
                  onChange={(e) => setRecordExpense(e.target.checked)}
                />
                {t('stock.recordExpense')}
              </label>
              {recordExpense && (
                <label className="block text-ink-soft">
                  {t('stock.expenseCategory')}
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className={input}>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {t(`expenses.cat.${c}`)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex flex-col gap-2 text-ink-soft">
            {['count', 'remove'].map((m) => (
              <label key={m} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`adj-${product.id}`}
                  checked={adjMode === m}
                  onChange={() => {
                    setAdjMode(m);
                    setValue('');
                  }}
                />
                {t(m === 'count' ? 'stock.modeCount' : 'stock.modeRemove')}
              </label>
            ))}
          </div>
          <label className="block text-ink-soft">
            {t(adjMode === 'count' ? 'stock.countLabel' : 'stock.removeLabel')}
            <input
              type="number"
              min={adjMode === 'count' ? 0 : 1}
              step="1"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className={input}
            />
          </label>
          <label className="block text-ink-soft">
            {t('stock.reason')}
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} className={input} />
          </label>
        </div>
      )}

      {/* what will happen */}
      {plan && !plan.error && (
        <div className="mt-3 rounded border border-sage/40 bg-sage/10 p-2 text-xs text-sage-dark">
          <p>{t('stock.previewStock', { n: plan.newStock })}</p>
          {mode === 'restock' && plan.unitCost !== null && (
            <p>{t('stock.previewUnit', { unit: money(plan.unitCost) })}</p>
          )}
          {mode === 'restock' && plan.costChanged && (
            <p>{t('stock.previewAvg', { cost: money(plan.newCost) })}</p>
          )}
          {mode === 'adjust' && (
            <p>{t('stock.previewChange', { delta: plan.delta > 0 ? `+${plan.delta}` : plan.delta })}</p>
          )}
        </div>
      )}
      {plan?.error && <p className="mt-3 text-xs text-rust">{t(`stock.err.${plan.error}`)}</p>}
      {error && <p className="mt-3 text-xs text-rust">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="mt-3 rounded bg-ink px-4 py-2 text-paper transition hover:bg-brass disabled:opacity-60"
      >
        {busy ? t('common.saving') : t('common.save')}
      </button>
    </form>
  );
}
