import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import { formatPrice } from '../../utils/format';

// One option on the product page: color swatches, a list of choices
// (activity / sport...), a tick box (extension) or a text box (custom text).
export default function OptionPicker({
  option,
  value,
  onChange,
  highlight,
  textValue = '',
  onTextChange = () => {},
}) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const name = option.label?.[language] || option.label?.en || '';
  const valueName = (v) => v.label?.[language] || v.label?.en || '';
  const plus = (v) =>
    Number(v.priceDelta) > 0 ? ` (+${formatPrice(v.priceDelta, language)})` : '';
  const mark = option.required ? (
    <span className="text-rust"> *</span>
  ) : (
    <span className="text-ink-faint"> ({t('checkout.optional')})</span>
  );
  const frame = highlight ? 'rounded border border-rust/60 p-2' : '';

  // ----- tick box (an extension that adds to the price) -----
  if (option.type === 'addon') {
    const v = option.values?.[0] || {};
    return (
      <div className={frame}>
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked ? true : '')}
            className="mt-0.5"
          />
          <span>
            {name}
            {plus(v)}
          </span>
        </label>
        {/* the shop can ask for a word / comment once the box is ticked */}
        {option.askText && value === true && (
          <label className="mt-2 block text-sm">
            <span className="text-ink-soft">
              {option.textLabel?.[language] || option.textLabel?.en || name}
              {option.textRequired ? (
                <span className="text-rust"> *</span>
              ) : (
                <span className="text-ink-faint"> ({t('checkout.optional')})</span>
              )}
            </span>
            <input
              type="text"
              maxLength={Number(option.textMax) > 0 ? Number(option.textMax) : 60}
              value={textValue}
              onChange={(e) => onTextChange(e.target.value)}
              className="mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass"
            />
          </label>
        )}
      </div>
    );
  }

  // ----- custom text -----
  if (option.type === 'text') {
    return (
      <label className={`block text-sm ${frame}`}>
        <span className="text-ink-soft">
          {name}
          {mark}
        </span>
        <input
          type="text"
          maxLength={Number(option.maxLength) > 0 ? Number(option.maxLength) : 60}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass"
        />
      </label>
    );
  }

  const values = option.values || [];
  const chosen = values.find((v) => v.id === value);

  // ----- color swatches -----
  if (option.type === 'color') {
    return (
      <div className={`text-sm ${frame}`} role="radiogroup" aria-label={name}>
        <p className="text-ink-soft">
          {name}
          {mark}
          {chosen && <span className="text-ink"> — {valueName(chosen)}{plus(chosen)}</span>}
        </p>
        <div className="mt-2 flex flex-wrap gap-3">
          {values.map((v) => (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={value === v.id}
              aria-label={valueName(v)}
              title={valueName(v)}
              onClick={() => onChange(value === v.id && !option.required ? '' : v.id)}
              className={
                'h-9 w-9 rounded-full border-2 transition ' +
                (value === v.id ? 'border-brass ring-2 ring-brass/40' : 'border-ink/25')
              }
              style={{ backgroundColor: v.color || '#999999' }}
            />
          ))}
        </div>
      </div>
    );
  }

  // ----- choice (activity / sport / size ...) -----
  if (values.length > 6) {
    return (
      <label className={`block text-sm ${frame}`}>
        <span className="text-ink-soft">
          {name}
          {mark}
        </span>
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass"
        >
          <option value="">{t('checkout.choose')}</option>
          {values.map((v) => (
            <option key={v.id} value={v.id}>
              {valueName(v)}
              {plus(v)}
            </option>
          ))}
        </select>
      </label>
    );
  }
  return (
    <div className={`text-sm ${frame}`} role="radiogroup" aria-label={name}>
      <p className="text-ink-soft">
        {name}
        {mark}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.map((v) => (
          <button
            key={v.id}
            type="button"
            role="radio"
            aria-checked={value === v.id}
            onClick={() => onChange(value === v.id && !option.required ? '' : v.id)}
            className={
              'rounded border px-3 py-1.5 transition ' +
              (value === v.id
                ? 'border-brass bg-brass/15 text-ink'
                : 'border-ink/20 text-ink-soft hover:border-brass')
            }
          >
            {valueName(v)}
            {plus(v)}
          </button>
        ))}
      </div>
    </div>
  );
}
