import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { useLanguage } from '../../context/LanguageContext';
import AdminTopBar from '../../components/admin/AdminTopBar';
import { ASSIGNABLE_ROLES } from '../../utils/roles';
import {
  listTeam,
  addTeamMember,
  updateTeamMember,
  getResetLink,
} from '../../firebase/team.service';

const inputClass =
  'mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass';

export default function Team() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { user } = useAuth();
  const { tenant } = useTenant();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', email: '', role: 'staff' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [link, setLink] = useState(null); // { name, url } shown after adding / "password link"
  const [copied, setCopied] = useState(false);

  const errorText = (code) => t(`team.err.${code}`, { defaultValue: t('team.err.SERVER') });
  const shopName = tenant?.name?.[language] || tenant?.name?.en || '';

  async function refresh() {
    setLoading(true);
    const result = await listTeam();
    if (result.ok) setMembers(result.members);
    else setError(errorText(result.error));
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    setError('');
    setLink(null);
    setBusy(true);
    const result = await addTeamMember(form);
    setBusy(false);
    if (!result.ok) {
      setError(errorText(result.error));
      return;
    }
    setLink({ name: result.name, url: result.resetLink });
    setForm({ name: '', email: '', role: 'staff' });
    await refresh();
  }

  async function handleUpdate(uid, patch) {
    setError('');
    const result = await updateTeamMember(uid, patch);
    if (!result.ok) setError(errorText(result.error));
    await refresh();
  }

  async function handleSwitch(member) {
    if (member.active && !window.confirm(t('team.confirmOff', { name: member.name || member.email }))) {
      return;
    }
    await handleUpdate(member.uid, { active: !member.active });
  }

  async function handleLink(member) {
    setError('');
    setLink(null);
    const result = await getResetLink(member.uid);
    if (!result.ok) {
      setError(errorText(result.error));
      return;
    }
    setLink({ name: member.name || member.email, url: result.resetLink });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // the link is also visible on screen to copy by hand
    }
  }

  const when = (iso) =>
    iso
      ? new Date(iso).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-GB', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : null;

  return (
    <div className="min-h-screen px-6 py-10">
      <AdminTopBar />
      <h1 className="font-display text-2xl font-semibold">{t('team.title')}</h1>
      <p className="mb-8 mt-1 max-w-xl text-sm text-ink-soft">{t('team.help')}</p>

      {error && <p className="mb-4 max-w-2xl text-sm text-rust">{error}</p>}

      {/* ---------- link to send to a person ---------- */}
      {link && (
        <div className="mb-8 max-w-2xl rounded-md border border-sage/40 bg-sage/10 p-4 text-sm">
          <p className="font-medium text-sage-dark">{t('team.linkTitle', { name: link.name })}</p>
          <p className="mt-1 text-ink-soft">{t('team.linkHelp', { name: link.name })}</p>
          <p className="mt-3 break-all rounded border border-ink/10 bg-white p-2 text-xs" dir="ltr">
            {link.url}
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={copyLink}
              className="rounded border border-ink/15 bg-white px-3 py-1.5 hover:border-brass"
            >
              {copied ? t('team.copied') : t('team.copy')}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                t('team.shareMessage', { name: link.name, shop: shopName, link: link.url })
              )}`}
              target="_blank"
              rel="noreferrer"
              className="rounded border border-ink/15 bg-white px-3 py-1.5 hover:border-brass"
            >
              {t('team.shareWhatsApp')}
            </a>
          </div>
        </div>
      )}

      {/* ---------- the team ---------- */}
      {loading ? (
        <p className="text-ink-soft">{t('common.loading')}</p>
      ) : (
        <div className="divide-y divide-ink/10 rounded-md border border-ink/10 bg-white">
          {members.map((m) => {
            const isMe = m.uid === user?.uid;
            const locked = isMe || m.role === 'owner';
            return (
              <div
                key={m.uid}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <p className="font-medium">
                    {m.name || m.email}
                    {isMe && <span className="ms-2 text-xs text-ink-faint">{t('team.you')}</span>}
                    {!m.active && (
                      <span className="ms-2 rounded bg-rust/15 px-2 py-0.5 text-xs text-rust">
                        {t('team.off')}
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-ink-soft" dir="ltr">
                    {m.email}
                  </p>
                  <p className="text-xs text-ink-faint">
                    {m.lastSignIn
                      ? t('team.lastSignIn', { date: when(m.lastSignIn) })
                      : t('team.neverSignedIn')}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-sm">
                  {locked ? (
                    <span className="rounded bg-ink/10 px-2 py-1">{t(`team.role_${m.role}`)}</span>
                  ) : (
                    <select
                      value={m.role}
                      onChange={(e) => handleUpdate(m.uid, { role: e.target.value })}
                      className="rounded border border-ink/15 bg-white px-2 py-1.5"
                      aria-label={t('team.role')}
                    >
                      {ASSIGNABLE_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {t(`team.role_${r}`)}
                        </option>
                      ))}
                    </select>
                  )}
                  {!locked && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleLink(m)}
                        className="text-brass hover:underline"
                      >
                        {t('team.passwordLink')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSwitch(m)}
                        className={m.active ? 'text-rust hover:underline' : 'text-brass hover:underline'}
                      >
                        {m.active ? t('team.switchOff') : t('team.switchOn')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---------- add a person ---------- */}
      <form
        onSubmit={handleAdd}
        className="mt-8 grid max-w-2xl gap-4 rounded-md border border-ink/10 bg-paper-soft p-6 sm:grid-cols-2"
      >
        <h2 className="col-span-full font-display text-lg font-medium">{t('team.addTitle')}</h2>
        <label className="text-sm text-ink-soft">
          {t('team.name')}
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputClass}
          />
        </label>
        <label className="text-sm text-ink-soft">
          {t('team.email')}
          <input
            type="email"
            required
            dir="ltr"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className={inputClass}
          />
        </label>
        <label className="text-sm text-ink-soft sm:col-span-2">
          {t('team.role')}
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className={inputClass}
          >
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {t(`team.role_${r}`)} — {t(`team.roleHelp_${r}`)}
              </option>
            ))}
          </select>
        </label>
        <div className="col-span-full">
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-ink px-5 py-2 text-sm text-paper transition hover:bg-brass disabled:opacity-60"
          >
            {busy ? t('team.adding') : t('team.addBtn')}
          </button>
        </div>
        <p className="col-span-full text-xs text-ink-faint">{t('team.roleHelp_owner')}</p>
      </form>
    </div>
  );
}
