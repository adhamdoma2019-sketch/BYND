import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { useLanguage } from '../../context/LanguageContext';
import AdminTopBar from '../../components/admin/AdminTopBar';
import { useAudit } from '../../hooks/useAudit';
import { formatPrice } from '../../utils/format';
import { listOrders } from '../../firebase/orders.service';
import {
  listCouriers,
  saveCourier,
  listSettlements,
  addSettlement,
} from '../../firebase/couriers.service';
import {
  cleanCourierForm,
  cleanSettlement,
  courierStatement,
  courierDayReport,
  localDay,
} from '../../utils/couriers';
import { courierDayToCsv } from '../../utils/exports';
import { downloadFile } from '../../utils/csv';

const inputClass =
  'mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass';
const today = () => localDay(new Date());

const emptyForm = {
  name: '',
  kind: 'company',
  collectsCash: true,
  defaultFee: '',
  fees: {},
  returnFeePercent: '100',
  active: true,
};

function courierToForm(c) {
  const fees = {};
  Object.keys(c.fees || {}).forEach((k) => (fees[k] = String(c.fees[k])));
  return {
    name: c.name || '',
    kind: c.kind || 'own',
    collectsCash: c.collectsCash !== false,
    defaultFee: c.defaultFee ? String(c.defaultFee) : '',
    fees,
    returnFeePercent: String(c.returnFeePercent ?? 100),
    active: c.active !== false,
  };
}

export default function Couriers() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { user } = useAuth();
  const { tenant, member } = useTenant();
  const log = useAudit();
  const money = (n) => formatPrice(n, language);
  const zones = useMemo(
    () => (tenant?.shipping?.zones || []).filter((z) => z.active !== false),
    [tenant]
  );

  const [couriers, setCouriers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState(null); // courier id, or 'new'
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [reportDay, setReportDay] = useState(today());

  const [payingId, setPayingId] = useState(null);
  const [pay, setPay] = useState({ amount: '', direction: 'in', date: today(), note: '' });
  const [payError, setPayError] = useState('');

  async function refresh() {
    if (!tenant) return;
    setLoading(true);
    const [c, o, s] = await Promise.all([
      listCouriers(tenant.id),
      listOrders(tenant.id),
      listSettlements(tenant.id),
    ]);
    setCouriers(c);
    setOrders(o);
    setSettlements(s);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant]);

  function startNew() {
    setForm(emptyForm);
    setEditingId('new');
    setError('');
  }
  function startEdit(c) {
    setForm(courierToForm(c));
    setEditingId(c.id);
    setError('');
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    const res = cleanCourierForm(form, zones);
    if (!res.ok) {
      setError(
        res.errors.includes('name')
          ? t('couriers.errName')
          : res.errors.includes('percent')
            ? t('couriers.errPercent')
            : t('couriers.errFee')
      );
      return;
    }
    // keep fees of areas that are switched off in Settings (so they are not lost)
    const old = couriers.find((c) => c.id === editingId);
    const value = { ...res.value, fees: { ...(old?.fees || {}), ...res.value.fees } };
    zones.forEach((z) => {
      if (!(z.id in res.value.fees)) delete value.fees[z.id];
    });
    setSaving(true);
    try {
      const id = await saveCourier(tenant.id, editingId === 'new' ? null : editingId, value);
      log({
        action: editingId === 'new' ? 'courier.create' : 'courier.update',
        entityType: 'courier',
        entityId: id,
        entityLabel: value.name,
        changes: [],
      });
      setEditingId(null);
      await refresh();
    } catch {
      setError(t('couriers.errSave'));
    }
    setSaving(false);
  }

  function startPay(c, balance) {
    setPayingId(c.id);
    setPayError('');
    setPay({
      amount: balance === 0 ? '' : String(Math.abs(balance)),
      direction: balance < 0 ? 'out' : 'in',
      date: today(),
      note: '',
    });
  }

  async function handlePay(c) {
    setPayError('');
    const res = cleanSettlement(pay);
    if (!res.ok) {
      setPayError(t('couriers.errAmount'));
      return;
    }
    setSaving(true);
    try {
      await addSettlement(
        tenant.id,
        { uid: user.uid, name: member?.name, email: user.email },
        {
          courierId: c.id,
          courierName: c.name,
          amount: res.value.amount,
          note: res.value.note,
          date: pay.date || today(),
        }
      );
      log({
        action: 'courier.settlement',
        entityType: 'courier',
        entityId: c.id,
        entityLabel: c.name,
        changes: [{ field: 'handover', to: String(res.value.amount) }],
      });
      setPayingId(null);
      await refresh();
    } catch {
      setPayError(t('couriers.errSave'));
    }
    setSaving(false);
  }

  const dayReport = useMemo(
    () => courierDayReport(orders, couriers, settlements, reportDay),
    [orders, couriers, settlements, reportDay]
  );
  const orderLabel = (o) => o.orderNumberLabel || `#${o.orderNumber}`;

  const zoneName = (z) => z.name?.[language] || z.name?.en || z.id;

  return (
    <div className="min-h-screen px-6 py-10">
      <AdminTopBar />
      <div className="mb-2 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-semibold">{t('couriers.title')}</h1>
        {editingId === null && (
          <button
            onClick={startNew}
            className="rounded bg-ink px-4 py-2 text-sm text-paper transition hover:bg-brass"
          >
            {t('couriers.add')}
          </button>
        )}
      </div>
      <p className="mb-6 max-w-2xl text-sm text-ink-soft">{t('couriers.intro')}</p>

      {editingId !== null && (
        <form
          onSubmit={handleSave}
          className="mb-8 max-w-2xl space-y-4 rounded-md border border-ink/10 bg-white p-5"
        >
          <h2 className="font-display text-lg font-medium">
            {editingId === 'new' ? t('couriers.addTitle') : t('couriers.editTitle')}
          </h2>

          <label className="block text-sm">
            {t('couriers.name')}
            <input
              className={inputClass}
              value={form.name}
              maxLength={80}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>

          <label className="block text-sm">
            {t('couriers.kind')}
            <select
              className={inputClass}
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value })}
            >
              <option value="company">{t('couriers.kindCompany')}</option>
              <option value="own">{t('couriers.kindOwn')}</option>
            </select>
          </label>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.collectsCash}
              onChange={(e) => setForm({ ...form, collectsCash: e.target.checked })}
            />
            <span>
              {t('couriers.collectsCash')}
              <span className="block text-xs text-ink-faint">{t('couriers.collectsCashHelp')}</span>
            </span>
          </label>

          <div>
            <p className="text-sm font-medium">{t('couriers.feesTitle')}</p>
            <p className="text-xs text-ink-faint">{t('couriers.feesHelp')}</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {zones.map((z) => (
                <label key={z.id} className="block text-sm">
                  {zoneName(z)}
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    className={inputClass}
                    value={form.fees[z.id] ?? ''}
                    placeholder={t('couriers.useOther')}
                    onChange={(e) =>
                      setForm({ ...form, fees: { ...form.fees, [z.id]: e.target.value } })
                    }
                  />
                </label>
              ))}
              <label className="block text-sm">
                {t('couriers.otherAreas')}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  className={inputClass}
                  value={form.defaultFee}
                  placeholder="0"
                  onChange={(e) => setForm({ ...form, defaultFee: e.target.value })}
                />
              </label>
            </div>
            {zones.length === 0 && (
              <p className="mt-2 text-xs text-ink-faint">{t('couriers.noZones')}</p>
            )}
          </div>

          <label className="block text-sm">
            {t('couriers.returnPercent')}
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              inputMode="decimal"
              className={inputClass}
              value={form.returnFeePercent}
              onChange={(e) => setForm({ ...form, returnFeePercent: e.target.value })}
            />
            <span className="block text-xs text-ink-faint">{t('couriers.returnPercentHelp')}</span>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            {t('couriers.active')}
          </label>

          {error && <p className="text-sm text-rust">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-ink px-4 py-2 text-sm text-paper hover:bg-brass disabled:opacity-60"
            >
              {saving ? t('common.saving') : t('common.save')}
            </button>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="rounded border border-ink/15 px-4 py-2 text-sm"
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      )}

      {!loading && couriers.length > 0 && (
        <section className="mb-8 max-w-3xl rounded-md border border-ink/10 bg-white p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-medium">{t('couriers.dayTitle')}</h2>
              <p className="text-xs text-ink-faint">{t('couriers.dayHelp')}</p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="block text-sm">
                {t('couriers.dayPick')}
                <input
                  type="date"
                  className={inputClass}
                  value={reportDay}
                  onChange={(e) => setReportDay(e.target.value)}
                />
              </label>
              {dayReport.some((r) => r.orders.length > 0) && (
                <button
                  onClick={() =>
                    downloadFile(
                      `couriers-${reportDay}.csv`,
                      courierDayToCsv(dayReport, { language, t })
                    )
                  }
                  className="rounded border border-ink/15 px-3 py-2 text-sm text-ink-soft hover:border-brass hover:text-brass"
                >
                  {t('exports.button')}
                </button>
              )}
            </div>
          </div>

          {!reportDay || dayReport.length === 0 ? (
            <p className="mt-4 text-sm text-ink-soft">{t('couriers.dayNone')}</p>
          ) : (
            <div className="mt-4 space-y-4">
              {dayReport.map((r) => (
                <div key={r.courierId} className="rounded border border-ink/10 bg-paper-soft p-4">
                  <h3 className="font-medium">{r.name}</h3>
                  <div className="mt-2 space-y-1 text-sm">
                    <Line label={t('couriers.dayDelivered')} value={r.delivered} />
                    <Line label={t('couriers.dayReturned')} value={r.returned} />
                    <Line label={t('couriers.sCash')} value={money(r.cash)} />
                    <Line label={t('couriers.sFees')} value={`− ${money(r.fees)}`} />
                    {r.handedIn > 0 && (
                      <Line label={t('couriers.dayHandedIn')} value={money(r.handedIn)} />
                    )}
                    {r.paidOut > 0 && (
                      <Line label={t('couriers.dayPaidOut')} value={money(r.paidOut)} />
                    )}
                  </div>
                  {r.orders.length > 0 && (
                    <ul className="mt-3 space-y-1 border-t border-ink/10 pt-2 text-xs text-ink-soft">
                      {r.orders.map((x) => (
                        <li key={x.order.id} className="flex justify-between gap-3">
                          <span>
                            {orderLabel(x.order)} ·{' '}
                            {t(`admin.status.${x.status}`, { defaultValue: x.status })}
                          </span>
                          <span>
                            {money(x.cash)} · − {money(x.fee)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {loading ? (
        <p className="text-ink-soft">{t('common.loading')}</p>
      ) : couriers.length === 0 ? (
        <p className="text-ink-soft">{t('couriers.none')}</p>
      ) : (
        <div className="grid max-w-3xl gap-4">
          {couriers.map((c) => {
            const s = courierStatement(c.id, orders, settlements);
            const mine = settlements.filter((x) => x.courierId === c.id);
            const owes = s.balance > 0;
            const owed = s.balance < 0;
            return (
              <div key={c.id} className="rounded-md border border-ink/10 bg-paper-soft p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="font-display text-lg font-medium">{c.name}</h2>
                    <p className="text-xs text-ink-faint">
                      {c.kind === 'company' ? t('couriers.kindCompany') : t('couriers.kindOwn')} ·{' '}
                      {c.collectsCash !== false ? t('couriers.tagCourierCash') : t('couriers.tagShopCash')}
                      {c.active === false && ` · ${t('couriers.inactive')}`}
                    </p>
                  </div>
                  <button
                    onClick={() => startEdit(c)}
                    className="text-sm text-brass hover:underline"
                  >
                    {t('common.edit')}
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <Stat label={t('couriers.sOpen')} value={s.open} />
                  <Stat label={t('couriers.sDelivered')} value={s.delivered} />
                  <Stat label={t('couriers.sReturned')} value={s.returned} />
                  <Stat label={t('couriers.sCancelled')} value={s.cancelled} />
                </div>

                <div className="mt-3 space-y-1 text-sm">
                  <Line label={t('couriers.sCash')} value={money(s.cash)} />
                  <Line label={t('couriers.sFees')} value={`− ${money(s.fees)}`} />
                  <Line
                    label={t('couriers.sSettled')}
                    value={s.settled === 0 ? money(0) : `− ${money(s.settled)}`}
                  />
                  <div className="flex justify-between border-t border-ink/10 pt-2 text-base font-semibold">
                    <span>
                      {owes
                        ? t('couriers.owesYou')
                        : owed
                          ? t('couriers.youOwe')
                          : t('couriers.allSettled')}
                    </span>
                    <span className={owes ? 'text-rust' : owed ? 'text-brass-dark' : 'text-sage-dark'}>
                      {money(Math.abs(s.balance))}
                    </span>
                  </div>
                </div>

                {payingId !== c.id ? (
                  <button
                    onClick={() => startPay(c, s.balance)}
                    className="mt-3 rounded border border-ink/15 px-3 py-1.5 text-sm hover:border-brass"
                  >
                    {t('couriers.recordHandover')}
                  </button>
                ) : (
                  <div className="mt-3 space-y-3 rounded border border-ink/10 bg-white p-3 text-sm">
                    <label className="block">
                      {t('couriers.hDirection')}
                      <select
                        className={inputClass}
                        value={pay.direction}
                        onChange={(e) => setPay({ ...pay, direction: e.target.value })}
                      >
                        <option value="in">{t('couriers.hIn')}</option>
                        <option value="out">{t('couriers.hOut')}</option>
                      </select>
                    </label>
                    <label className="block">
                      {t('couriers.hAmount')}
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        className={inputClass}
                        value={pay.amount}
                        onChange={(e) => setPay({ ...pay, amount: e.target.value })}
                      />
                    </label>
                    <label className="block">
                      {t('couriers.hDate')}
                      <input
                        type="date"
                        className={inputClass}
                        value={pay.date}
                        onChange={(e) => setPay({ ...pay, date: e.target.value })}
                      />
                    </label>
                    <label className="block">
                      {t('couriers.hNote')}
                      <input
                        className={inputClass}
                        maxLength={200}
                        value={pay.note}
                        onChange={(e) => setPay({ ...pay, note: e.target.value })}
                      />
                    </label>
                    <p className="text-xs text-ink-faint">{t('couriers.hHelp')}</p>
                    {payError && <p className="text-rust">{payError}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePay(c)}
                        disabled={saving}
                        className="rounded bg-ink px-3 py-1.5 text-paper hover:bg-brass disabled:opacity-60"
                      >
                        {t('common.save')}
                      </button>
                      <button
                        onClick={() => setPayingId(null)}
                        className="rounded border border-ink/15 px-3 py-1.5"
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  </div>
                )}

                {mine.length > 0 && (
                  <details className="mt-3 text-sm">
                    <summary className="cursor-pointer text-ink-soft">
                      {t('couriers.history', { n: mine.length })}
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {mine.slice(0, 30).map((x) => (
                        <li key={x.id} className="flex justify-between gap-3 text-ink-soft">
                          <span>
                            {x.date} · {x.amount > 0 ? t('couriers.hIn') : t('couriers.hOut')}
                            {x.note ? ` · ${x.note}` : ''}
                          </span>
                          <span className="font-medium text-ink">{money(Math.abs(x.amount))}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded border border-ink/10 bg-white px-3 py-2">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-ink-faint">{label}</div>
    </div>
  );
}

function Line({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-soft">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
