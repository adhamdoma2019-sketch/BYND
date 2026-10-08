import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTenant } from '../../context/TenantContext';
import { useLanguage } from '../../context/LanguageContext';
import AdminTopBar from '../../components/admin/AdminTopBar';
import { listAudit } from '../../firebase/audit.service';

const TYPES = ['product', 'order', 'expense', 'promo', 'settings', 'team'];

export default function Activity() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { tenant } = useTenant();

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [who, setWho] = useState('all');
  const [type, setType] = useState('all');

  useEffect(() => {
    if (!tenant) return;
    listAudit(tenant.id)
      .then(setEntries)
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [tenant]);

  const people = useMemo(() => {
    const map = new Map();
    entries.forEach((e) => map.set(e.actorUid, e.actorName || e.actorEmail || e.actorUid));
    return [...map];
  }, [entries]);

  const shown = entries.filter(
    (e) => (who === 'all' || e.actorUid === who) && (type === 'all' || e.entityType === type)
  );

  const when = (ts) =>
    ts?.seconds
      ? new Date(ts.seconds * 1000).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-GB', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : '';

  // Makes a stored value readable (statuses and yes/no are translated).
  const show = (field, value) => {
    if (value === null || value === undefined || value === '') return '—';
    if (field === 'status') return t(`admin.status.${value}`, { defaultValue: value });
    if (field === 'role') return t(`team.role_${value}`, { defaultValue: value });
    if (value === 'true') return t('audit.yes');
    if (value === 'false') return t('audit.no');
    return value;
  };

  const selectClass = 'rounded border border-ink/15 bg-white px-3 py-2 text-sm';

  return (
    <div className="min-h-screen px-6 py-10">
      <AdminTopBar />
      <h1 className="font-display text-2xl font-semibold">{t('audit.title')}</h1>
      <p className="mb-6 mt-1 max-w-xl text-sm text-ink-soft">{t('audit.help')}</p>

      <div className="mb-6 flex flex-wrap gap-3">
        <select value={who} onChange={(e) => setWho(e.target.value)} className={selectClass}>
          <option value="all">{t('audit.everyone')}</option>
          {people.map(([uid, name]) => (
            <option key={uid} value={uid}>
              {name}
            </option>
          ))}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} className={selectClass}>
          <option value="all">{t('audit.allTypes')}</option>
          {TYPES.map((ty) => (
            <option key={ty} value={ty}>
              {t(`audit.type.${ty}`)}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-ink-soft">{t('common.loading')}</p>
      ) : failed ? (
        <p className="text-rust">{t('audit.loadFailed')}</p>
      ) : shown.length === 0 ? (
        <p className="text-ink-soft">{t('audit.none')}</p>
      ) : (
        <div className="max-w-3xl divide-y divide-ink/10 rounded-md border border-ink/10 bg-white">
          {shown.map((e) => (
            <div key={e.id} className="px-4 py-3">
              <p className="text-sm">
                <strong>{e.actorName || e.actorEmail}</strong>{' '}
                {t(`audit.action.${e.action}`, { defaultValue: e.action })}{' '}
                {e.entityLabel && <strong>{e.entityLabel}</strong>}
              </p>
              <p className="text-xs text-ink-faint">{when(e.at)}</p>
              {(e.changes || []).length > 0 && (
                <ul className="mt-1 space-y-0.5 text-xs text-ink-soft">
                  {e.changes.map((c, i) => (
                    <li key={i}>
                      {t(`audit.field.${c.field}`, { defaultValue: c.field })}
                      {(c.from !== undefined && c.from !== null) ||
                      (c.to !== undefined && c.to !== null)
                        ? `: ${show(c.field, c.from)} → ${show(c.field, c.to)}`
                        : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
