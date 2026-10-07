import { useTranslation } from 'react-i18next';
import { OPTION_TYPES, MAX_OPTIONS, MAX_VALUES } from '../../utils/productOptions';
import { newOption, newValue } from '../../utils/productOptionsForm';

const input =
  'mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass';

// Where the shop defines the choices customers get on a product:
// colors, an activity / sport list, an extension, a custom text.
export default function OptionsEditor({ options, onChange }) {
  const { t } = useTranslation();

  const updateOption = (i, patch) =>
    onChange(options.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));

  const updateValue = (i, j, patch) =>
    updateOption(i, {
      values: options[i].values.map((v, idx) => (idx === j ? { ...v, ...patch } : v)),
    });

  function changeType(i, type) {
    const o = options[i];
    // Keep the choices when switching between color and choice list.
    let values = o.values;
    if (type === 'addon') values = [o.values[0] || newValue('addon')];
    else if (type === 'text') values = [];
    else if (values.length === 0) values = [newValue(type)];
    else if (type === 'color') {
      values = values.map((v) => ({ ...v, color: v.color || '#222222' }));
    }
    updateOption(i, { type, values });
  }

  return (
    <div className="col-span-full rounded border border-ink/10 bg-white p-4">
      <h3 className="font-display text-base font-medium">{t('options.title')}</h3>
      <p className="mt-1 text-xs text-ink-faint">{t('options.help')}</p>

      <div className="mt-4 space-y-4">
        {options.map((o, i) => (
          <div key={o.id} className="rounded-md border border-ink/10 bg-paper-soft p-3">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium">{t('options.optionN', { n: i + 1 })}</p>
              <button
                type="button"
                onClick={() => onChange(options.filter((_, idx) => idx !== i))}
                className="text-sm text-rust hover:underline"
              >
                {t('common.remove')}
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-ink-soft">
                {t('options.type')}
                <select
                  value={o.type}
                  onChange={(e) => changeType(i, e.target.value)}
                  className={input}
                >
                  {OPTION_TYPES.map((ty) => (
                    <option key={ty} value={ty}>
                      {t(`options.type_${ty}`)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex items-end text-sm text-ink-soft">
                {o.type !== 'addon' && (
                  <label className="flex items-center gap-2 pb-2">
                    <input
                      type="checkbox"
                      checked={o.required}
                      onChange={(e) => updateOption(i, { required: e.target.checked })}
                    />
                    {t('options.required')}
                  </label>
                )}
              </div>
              <label className="text-sm text-ink-soft">
                {t('options.labelEn')}
                <input
                  type="text"
                  dir="ltr"
                  value={o.labelEn}
                  onChange={(e) => updateOption(i, { labelEn: e.target.value })}
                  className={input}
                />
              </label>
              <label className="text-sm text-ink-soft">
                {t('options.labelAr')}
                <input
                  type="text"
                  dir="rtl"
                  value={o.labelAr}
                  onChange={(e) => updateOption(i, { labelAr: e.target.value })}
                  className={input}
                />
              </label>
            </div>

            {o.type === 'text' && (
              <label className="mt-3 block max-w-xs text-sm text-ink-soft">
                {t('options.maxLength')}
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={o.maxLength}
                  placeholder="60"
                  onChange={(e) => updateOption(i, { maxLength: e.target.value })}
                  className={input}
                />
              </label>
            )}

            {o.type === 'addon' && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-sm text-ink-soft">
                  {t('options.extPrice')}
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={o.values[0]?.priceDelta ?? ''}
                    onChange={(e) => updateValue(i, 0, { priceDelta: e.target.value })}
                    className={input}
                  />
                </label>
                <label className="text-sm text-ink-soft">
                  {t('options.extCost')}
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={o.values[0]?.costDelta ?? ''}
                    onChange={(e) => updateValue(i, 0, { costDelta: e.target.value })}
                    className={input}
                  />
                </label>
              </div>
            )}

            {(o.type === 'color' || o.type === 'choice') && (
              <div className="mt-3 space-y-2">
                {o.values.map((v, j) => (
                  <div
                    key={v.id}
                    className="grid items-end gap-2 rounded border border-ink/10 bg-white p-2 sm:grid-cols-6"
                  >
                    {o.type === 'color' && (
                      <label className="text-xs text-ink-soft">
                        {t('options.color')}
                        <input
                          type="color"
                          value={v.color || '#222222'}
                          onChange={(e) => updateValue(i, j, { color: e.target.value })}
                          className="mt-1 h-9 w-full cursor-pointer rounded border border-ink/15 bg-white"
                        />
                      </label>
                    )}
                    <label
                      className={
                        'text-xs text-ink-soft ' + (o.type === 'color' ? 'sm:col-span-1' : 'sm:col-span-2')
                      }
                    >
                      {t('options.valueEn')}
                      <input
                        type="text"
                        dir="ltr"
                        value={v.labelEn}
                        onChange={(e) => updateValue(i, j, { labelEn: e.target.value })}
                        className={input}
                      />
                    </label>
                    <label
                      className={
                        'text-xs text-ink-soft ' + (o.type === 'color' ? 'sm:col-span-1' : 'sm:col-span-2')
                      }
                    >
                      {t('options.valueAr')}
                      <input
                        type="text"
                        dir="rtl"
                        value={v.labelAr}
                        onChange={(e) => updateValue(i, j, { labelAr: e.target.value })}
                        className={input}
                      />
                    </label>
                    <label className="text-xs text-ink-soft">
                      {t('options.priceDelta')}
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={v.priceDelta}
                        onChange={(e) => updateValue(i, j, { priceDelta: e.target.value })}
                        className={input}
                      />
                    </label>
                    <label className="text-xs text-ink-soft">
                      {t('options.costDelta')}
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={v.costDelta}
                        onChange={(e) => updateValue(i, j, { costDelta: e.target.value })}
                        className={input}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        updateOption(i, { values: o.values.filter((_, idx) => idx !== j) })
                      }
                      className="pb-2 text-start text-xs text-rust hover:underline"
                    >
                      {t('common.remove')}
                    </button>
                  </div>
                ))}
                {o.values.length < MAX_VALUES && (
                  <button
                    type="button"
                    onClick={() => updateOption(i, { values: [...o.values, newValue(o.type)] })}
                    className="rounded border border-ink/15 px-3 py-1.5 text-sm hover:border-brass"
                  >
                    {t('options.addValue')}
                  </button>
                )}
                <p className="text-xs text-ink-faint">{t('options.costHint')}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {options.length < MAX_OPTIONS && (
        <button
          type="button"
          onClick={() => onChange([...options, newOption()])}
          className="mt-4 rounded border border-ink/15 px-4 py-2 text-sm hover:border-brass"
        >
          {t('options.add')}
        </button>
      )}
    </div>
  );
}
