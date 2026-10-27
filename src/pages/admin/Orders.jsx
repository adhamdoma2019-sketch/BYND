import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTenant } from '../../context/TenantContext';
import {
  ALL_STATUSES,
  nextStatus,
  canReturnStatus,
  canCancelStatus,
  statusBadgeClass,
} from '../../utils/orderRules';
import { downloadFile } from '../../utils/csv';
import { ordersToCsv } from '../../utils/exports';
import { useLanguage } from '../../context/LanguageContext';
import AdminTopBar from '../../components/admin/AdminTopBar';
import { formatPrice } from '../../utils/format';
import { whatsappLink } from '../../utils/phone';
import { optimizedImage } from '../../utils/images';
import OptionSummary from '../../components/storefront/OptionSummary';
import { useAudit } from '../../hooks/useAudit';
import { diffFields } from '../../utils/audit';
import { canSeeCosts, canCancelOrders, canManageCouriers } from '../../utils/roles';
import { listCouriers, setOrderCourier } from '../../firebase/couriers.service';
import { feeForZone, courierSnapshot } from '../../utils/couriers';
import {
  listOrders,
  updateOrderStatus,
  cancelOrder,
  returnOrder,
  updateOrderCustomer,
} from '../../firebase/orders.service';
import { orderCost } from '../../utils/profit';


function orderDateStr(order) {
  if (!order.createdAt?.seconds) return '';
  return new Date(order.createdAt.seconds * 1000).toISOString().slice(0, 10);
}

export default function Orders() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { tenant, role } = useTenant();
  const log = useAudit(); // records who changed what (Activity log)
  const orderLabel = (o) => o.orderNumberLabel || `#${o.orderNumber}`;

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [actionError, setActionError] = useState('');

  // Couriers: only owners and managers choose them and see their fees.
  const canCourier = canManageCouriers(role);
  const [couriers, setCouriers] = useState([]);
  const [courierFilter, setCourierFilter] = useState('all'); // all | none | <courier id>
  const [courierPick, setCourierPick] = useState({}); // orderId -> { courierId, fee }

  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [editingCustomerId, setEditingCustomerId] = useState(null);
  const [customerForm, setCustomerForm] = useState({
    name: '',
    phone: '',
    address: '',
    notes: '',
  });

  async function refresh() {
    if (!tenant) return;
    setLoading(true);
    const data = await listOrders(tenant.id);
    setOrders(data);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant]);

  useEffect(() => {
    if (!tenant || !canCourier) return;
    listCouriers(tenant.id).then(setCouriers).catch(() => {});
  }, [tenant, canCourier]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;
      if (courierFilter === 'none' && order.courier) return false;
      if (courierFilter !== 'all' && courierFilter !== 'none' && order.courier?.id !== courierFilter)
        return false;

      if (search.trim()) {
        const term = search.trim().toLowerCase();
        const name = (order.customer?.name || '').toLowerCase();
        const phone = (order.customer?.phone || '').toLowerCase();
        if (!name.includes(term) && !phone.includes(term)) return false;
      }

      const orderDate = orderDateStr(order);
      if (dateFrom && orderDate && orderDate < dateFrom) return false;
      if (dateTo && orderDate && orderDate > dateTo) return false;

      return true;
    });
  }, [orders, statusFilter, courierFilter, search, dateFrom, dateTo]);

  async function handleAdvance(order) {
    const next = nextStatus(order.status);
    if (!next) return;
    setUpdatingId(order.id);
    setActionError('');
    await updateOrderStatus(order.id, next);
    log({
      action: 'order.status',
      entityType: 'order',
      entityId: order.id,
      entityLabel: orderLabel(order),
      changes: [{ field: 'status', from: order.status, to: next }],
    });
    await refresh();
    setUpdatingId(null);
  }

  // Returned parcels: first choose whether the items go back on the shelf.
  const [returningId, setReturningId] = useState(null);

  async function handleReturn(order, restock) {
    setUpdatingId(order.id);
    setActionError('');
    try {
      await returnOrder(order.id, { restock });
      log({
        action: 'order.return',
        entityType: 'order',
        entityId: order.id,
        entityLabel: orderLabel(order),
        changes: [
          { field: 'status', from: order.status, to: 'returned' },
          { field: 'restock', to: String(restock) },
        ],
      });
      setReturningId(null);
      await refresh();
    } catch (err) {
      setActionError(
        err.code
          ? t(`orders.err.${err.code}`, { defaultValue: t('orders.returnFailed') })
          : t('orders.returnFailed')
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleCancel(order) {
    if (
      !window.confirm(t('orders.confirmCancel'))
    )
      return;
    setUpdatingId(order.id);
    setActionError('');
    try {
      await cancelOrder(order.id);
      log({
        action: 'order.cancel',
        entityType: 'order',
        entityId: order.id,
        entityLabel: orderLabel(order),
        changes: [{ field: 'status', from: order.status, to: 'cancelled' }],
      });
      await refresh();
    } catch (err) {
      setActionError(
        err.code
          ? t(`orders.err.${err.code}`, { defaultValue: t('orders.cancelFailed') })
          : t('orders.cancelFailed')
      );
    } finally {
      setUpdatingId(null);
    }
  }

  function startCourierPick(order) {
    setCourierPick((p) => ({
      ...p,
      [order.id]: {
        courierId: order.courier?.id || '',
        fee: order.courier ? String(order.courier.fee) : '',
      },
    }));
  }

  function chooseCourier(order, courierId) {
    const c = couriers.find((x) => x.id === courierId);
    setCourierPick((p) => ({
      ...p,
      [order.id]: {
        courierId,
        fee: c ? String(feeForZone(c, order.shipping?.zoneId)) : '',
      },
    }));
  }

  async function saveCourierPick(order) {
    const pick = courierPick[order.id];
    const c = couriers.find((x) => x.id === pick?.courierId);
    if (!c) return;
    if (!(Number(pick.fee) >= 0) || pick.fee === '') {
      setActionError(t('couriers.errFee'));
      return;
    }
    setUpdatingId(order.id);
    setActionError('');
    try {
      await setOrderCourier(order.id, courierSnapshot(c, pick.fee));
      log({
        action: 'order.courier',
        entityType: 'order',
        entityId: order.id,
        entityLabel: orderLabel(order),
        changes: [{ field: 'courier', from: order.courier?.name || '', to: c.name }],
      });
      setCourierPick((p) => {
        const { [order.id]: _gone, ...rest } = p;
        return rest;
      });
      await refresh();
    } catch {
      setActionError(t('couriers.errSave'));
    }
    setUpdatingId(null);
  }

  async function removeCourier(order) {
    setUpdatingId(order.id);
    setActionError('');
    try {
      await setOrderCourier(order.id, null);
      log({
        action: 'order.courier',
        entityType: 'order',
        entityId: order.id,
        entityLabel: orderLabel(order),
        changes: [{ field: 'courier', from: order.courier?.name || '', to: '' }],
      });
      await refresh();
    } catch {
      setActionError(t('couriers.errSave'));
    }
    setUpdatingId(null);
  }

  function startEditCustomer(order) {
    setEditingCustomerId(order.id);
    setCustomerForm({
      name: order.customer?.name || '',
      phone: order.customer?.phone || '',
      address: order.customer?.address || '',
      notes: order.customer?.notes || '',
    });
  }

  async function saveCustomerEdit(orderId) {
    setUpdatingId(orderId);
    const order = orders.find((o) => o.id === orderId);
    await updateOrderCustomer(orderId, customerForm);
    const changes = diffFields(
      {
        name: order?.customer?.name,
        phone: order?.customer?.phone,
        address: order?.customer?.address,
        notes: order?.customer?.notes,
      },
      customerForm
    );
    if (changes.length > 0) {
      log({
        action: 'order.customer',
        entityType: 'order',
        entityId: orderId,
        entityLabel: order ? orderLabel(order) : '',
        changes,
      });
    }
    setEditingCustomerId(null);
    await refresh();
    setUpdatingId(null);
  }

  return (
    <div className="min-h-screen px-6 py-10">
      <AdminTopBar />
      <h1 className="mb-6 font-display text-2xl font-semibold">
        {t('admin.orders')}
      </h1>

      <div className="mb-6 flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus-visible:border-brass"
        >
          <option value="all">{t('orders.allStatuses')}</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t('admin.status.' + s)}
            </option>
          ))}
        </select>

        {canCourier && couriers.length > 0 && (
          <select
            value={courierFilter}
            onChange={(e) => setCourierFilter(e.target.value)}
            className="rounded border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus-visible:border-brass"
          >
            <option value="all">{t('orders.allCouriers')}</option>
            <option value="none">{t('orders.noCourier')}</option>
            {couriers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}

        <input
          type="text"
          placeholder={t('orders.searchPh')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus-visible:border-brass"
        />

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="rounded border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus-visible:border-brass"
        />
        <span className="self-center text-sm text-ink-faint">{t('orders.to')}</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="rounded border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus-visible:border-brass"
        />

        {filteredOrders.length > 0 && (
          <button
            onClick={() =>
              downloadFile(
                `orders-${new Date().toISOString().slice(0, 10)}.csv`,
                ordersToCsv(filteredOrders, { language, t, includeCourierFee: canCourier })
              )
            }
            className="rounded border border-ink/15 px-3 py-2 text-sm text-ink-soft hover:border-brass hover:text-brass"
          >
            {t('exports.button')}
          </button>
        )}

        {(statusFilter !== 'all' || search || dateFrom || dateTo) && (
          <button
            onClick={() => {
              setStatusFilter('all');
              setSearch('');
              setDateFrom('');
              setDateTo('');
            }}
            className="rounded border border-ink/15 px-3 py-2 text-sm text-ink-soft hover:border-rust hover:text-rust"
          >
            {t('orders.clear')}
          </button>
        )}
      </div>

      {actionError && <p className="mb-4 text-sm text-rust">{actionError}</p>}

      {loading ? (
        <p className="text-ink-soft">{t('common.loading')}</p>
      ) : filteredOrders.length === 0 ? (
        <p className="text-ink-soft">
          {orders.length === 0 ? t('orders.none') : t('orders.noMatch')}
        </p>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const isOpen = expandedId === order.id;
            const next = nextStatus(order.status);
            const canCancel = canCancelStatus(order.status);
            const canReturn = canReturnStatus(order.status);
            const isEditingCustomer = editingCustomerId === order.id;

            return (
              <div
                key={order.id}
                className="rounded-md border border-ink/10 bg-white"
              >
                <button
                  onClick={() => setExpandedId(isOpen ? null : order.id)}
                  className="flex w-full items-center justify-between px-4 py-3 text-start"
                >
                  <div>
                    <span className="font-medium">
                      {t('orders.orderLabel', {
                        label: order.orderNumberLabel || `#${order.orderNumber}`,
                      })}
                    </span>
                    <span className="ms-3 text-sm text-ink-soft">
                      {order.customer?.name}
                    </span>
                    {order.courier?.name && (
                      <span className="ms-3 text-xs text-ink-faint">🚚 {order.courier.name}</span>
                    )}
                    {order.orderType === 'preorder' && (
                      <span className="ms-3 rounded bg-ink px-2 py-0.5 text-xs text-paper">
                        {t('orders.preorder')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-ink-soft">
                      {formatPrice(order.totalAmount, language)}
                    </span>
                    <span
                      className={
                        'rounded px-2 py-0.5 text-xs ' +
                        statusBadgeClass(order.status)
                      }
                    >
                      {t('admin.status.' + order.status)}
                    </span>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-ink/10 px-4 py-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <div className="mb-1 flex items-center justify-between">
                          <p className="text-sm font-medium text-ink-soft">
                            {t('orders.customer')}
                          </p>
                          {!isEditingCustomer && (
                            <button
                              onClick={() => startEditCustomer(order)}
                              className="text-xs text-brass hover:underline"
                            >
                              {t('common.edit')}
                            </button>
                          )}
                        </div>

                        {isEditingCustomer ? (
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={customerForm.name}
                              onChange={(e) =>
                                setCustomerForm({
                                  ...customerForm,
                                  name: e.target.value,
                                })
                              }
                              placeholder={t('orders.namePh')}
                              className="w-full rounded border border-ink/15 px-2 py-1 text-sm"
                            />
                            <input
                              type="text"
                              value={customerForm.phone}
                              onChange={(e) =>
                                setCustomerForm({
                                  ...customerForm,
                                  phone: e.target.value,
                                })
                              }
                              placeholder={t('orders.phonePh')}
                              className="w-full rounded border border-ink/15 px-2 py-1 text-sm"
                            />
                            <textarea
                              value={customerForm.address}
                              onChange={(e) =>
                                setCustomerForm({
                                  ...customerForm,
                                  address: e.target.value,
                                })
                              }
                              placeholder={t('orders.addressPh')}
                              rows={2}
                              className="w-full rounded border border-ink/15 px-2 py-1 text-sm"
                            />
                            <textarea
                              value={customerForm.notes}
                              onChange={(e) =>
                                setCustomerForm({
                                  ...customerForm,
                                  notes: e.target.value,
                                })
                              }
                              placeholder={t('orders.notesPh')}
                              rows={2}
                              className="w-full rounded border border-ink/15 px-2 py-1 text-sm"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveCustomerEdit(order.id)}
                                disabled={updatingId === order.id}
                                className="rounded bg-ink px-3 py-1 text-xs text-paper hover:bg-brass"
                              >
                                {t('common.save')}
                              </button>
                              <button
                                onClick={() => setEditingCustomerId(null)}
                                className="rounded border border-ink/15 px-3 py-1 text-xs text-ink-soft"
                              >
                                {t('common.cancel')}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p>{order.customer?.name}</p>
                            <p className="flex flex-wrap items-center gap-3 text-sm text-ink-soft">
                              <span dir="ltr">{order.customer?.phone}</span>
                              <a
                                href={whatsappLink(
                                  order.customer?.phone,
                                  tenant?.defaultCountryCode || '20'
                                )}
                                target="_blank"
                                rel="noreferrer"
                                className="text-brass hover:underline"
                              >
                                {t('orders.whatsapp')}
                              </a>
                              <a
                                href={`tel:${order.customer?.phone}`}
                                className="text-brass hover:underline"
                              >
                                {t('orders.call')}
                              </a>
                            </p>
                            {order.customer?.email && (
                              <p className="text-sm text-ink-soft" dir="ltr">
                                {order.customer.email}
                              </p>
                            )}
                            <p className="text-sm text-ink-soft">
                              {order.customer?.address}
                            </p>
                            {['floor', 'apartment', 'landmark'].map(
                              (key) =>
                                order.customer?.[key] && (
                                  <p key={key} className="text-sm text-ink-soft">
                                    {t(`checkoutFields.${key}`)}: {order.customer[key]}
                                  </p>
                                )
                            )}
                            {(order.customFields || []).map((f) => (
                              <p key={f.id} className="text-sm text-ink-soft">
                                {f.label?.[language] || f.label?.en}:{' '}
                                {f.type === 'checkbox'
                                  ? t('orders.yes')
                                  : typeof f.value === 'object'
                                    ? f.value[language] || f.value.en
                                    : f.value}
                              </p>
                            ))}
                            {order.customer?.notes && (
                              <p className="mt-1 text-sm italic text-ink-faint">
                                "{order.customer.notes}"
                              </p>
                            )}
                          </>
                        )}
                      </div>

                      <div>
                        <p className="text-sm font-medium text-ink-soft">
                          {t('orders.items')}
                        </p>
                        {order.items?.map((item, i) => (
                          <div key={i} className="flex justify-between gap-3 text-sm">
                            <span className="flex gap-3">
                              {/* picture of what was ordered (the chosen color/version) */}
                              {item.imageUrl && (
                                <img
                                  src={optimizedImage(item.imageUrl, 120)}
                                  alt=""
                                  className="h-12 w-12 shrink-0 rounded object-cover"
                                />
                              )}
                              <span>
                                {item.name?.[language] || item.name?.en} ×{' '}
                                {item.quantity}
                                <OptionSummary labels={item.options} />
                              </span>
                            </span>
                            <span>{formatPrice(item.subtotal, language)}</span>
                          </div>
                        ))}
                        {(order.discount > 0 || order.shipping) && (
                          <div className="mt-2 space-y-0.5 border-t border-ink/10 pt-2 text-sm">
                            <div className="flex justify-between text-ink-soft">
                              <span>{t('storefront.subtotal')}</span>
                              <span>{formatPrice(order.subtotal, language)}</span>
                            </div>
                            {order.discount > 0 && (
                              <div className="flex justify-between text-sage-dark">
                                <span>
                                  {t('checkout.discount')}
                                  {order.promo?.code && ` (${order.promo.code})`}
                                </span>
                                <span>− {formatPrice(order.discount, language)}</span>
                              </div>
                            )}
                            {order.shipping && (
                              <div className="flex justify-between text-ink-soft">
                                <span>
                                  {t('checkout.shipping')} —{' '}
                                  {order.shipping.zoneName?.[language] ||
                                    order.shipping.zoneName?.en}
                                </span>
                                <span>
                                  {order.shippingFee === 0
                                    ? t('checkout.free')
                                    : formatPrice(order.shippingFee, language)}
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between font-medium">
                              <span>{t('checkout.total')}</span>
                              <span>{formatPrice(order.totalAmount, language)}</span>
                            </div>
                          </div>
                        )}
                        {canSeeCosts(role) && (() => {
                          const c = orderCost(order);
                          return c.complete ? (
                            <p className="mt-2 border-t border-ink/10 pt-2 text-xs text-ink-faint">
                              {t('orders.costLine', {
                                cogs: formatPrice(c.cogs, language),
                                profit: formatPrice(
                                  (order.totalAmount || 0) - c.cogs,
                                  language
                                ),
                              })}
                            </p>
                          ) : (
                            <p className="mt-2 border-t border-ink/10 pt-2 text-xs text-ink-faint">
                              {t('orders.noCostRecorded')}
                            </p>
                          );
                        })()}
                      </div>
                    </div>

                    {canCourier && order.status !== 'cancelled' && (() => {
                      const pick = courierPick[order.id];
                      const active = couriers.filter((c) => c.active !== false);
                      const busy = updatingId === order.id;
                      return (
                        <div className="mt-4 rounded border border-ink/10 bg-paper-soft p-3 text-sm">
                          <p className="font-medium text-ink-soft">{t('orders.courier')}</p>
                          {pick ? (
                            <div className="mt-2 space-y-2">
                              <select
                                value={pick.courierId}
                                onChange={(e) => chooseCourier(order, e.target.value)}
                                className="w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass"
                              >
                                <option value="">{t('orders.chooseCourier')}</option>
                                {active.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                              <label className="block text-xs text-ink-faint">
                                {t('orders.courierFee')}
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  inputMode="decimal"
                                  value={pick.fee}
                                  onChange={(e) =>
                                    setCourierPick((p) => ({
                                      ...p,
                                      [order.id]: { ...pick, fee: e.target.value },
                                    }))
                                  }
                                  className="mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-sm text-ink outline-none focus-visible:border-brass"
                                />
                              </label>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => saveCourierPick(order)}
                                  disabled={busy || !pick.courierId}
                                  className="rounded bg-ink px-3 py-1.5 text-paper hover:bg-brass disabled:opacity-60"
                                >
                                  {t('common.save')}
                                </button>
                                <button
                                  onClick={() =>
                                    setCourierPick((p) => {
                                      const { [order.id]: _gone, ...rest } = p;
                                      return rest;
                                    })
                                  }
                                  className="rounded border border-ink/15 px-3 py-1.5"
                                >
                                  {t('common.cancel')}
                                </button>
                              </div>
                            </div>
                          ) : order.courier ? (
                            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                              <span>
                                {order.courier.name} —{' '}
                                {t('orders.courierFeeLine', {
                                  fee: formatPrice(order.courier.fee, language),
                                })}
                                {order.courier.collectsCash === false
                                  ? ` · ${t('couriers.tagShopCash')}`
                                  : ''}
                              </span>
                              <span className="flex gap-3">
                                <button
                                  onClick={() => startCourierPick(order)}
                                  className="text-xs text-brass hover:underline"
                                >
                                  {t('orders.changeCourier')}
                                </button>
                                <button
                                  onClick={() => removeCourier(order)}
                                  disabled={busy}
                                  className="text-xs text-rust hover:underline disabled:opacity-60"
                                >
                                  {t('common.remove')}
                                </button>
                              </span>
                            </div>
                          ) : active.length === 0 ? (
                            <p className="mt-1 text-xs text-ink-faint">{t('orders.noCouriersYet')}</p>
                          ) : (
                            <button
                              onClick={() => startCourierPick(order)}
                              className="mt-1 rounded border border-ink/15 bg-white px-3 py-1.5 hover:border-brass"
                            >
                              {t('orders.assignCourier')}
                            </button>
                          )}
                        </div>
                      );
                    })()}

                    <div className="mt-4 flex flex-wrap gap-2">
                      {next && (
                        <button
                          onClick={() => handleAdvance(order)}
                          disabled={updatingId === order.id}
                          className="rounded bg-ink px-3 py-1.5 text-sm text-paper transition hover:bg-brass disabled:opacity-60"
                        >
                          {t('orders.markAs', {
                            status: t('admin.status.' + next),
                          })}
                        </button>
                      )}
                      {canCancel && canCancelOrders(role) && (
                        <button
                          onClick={() => handleCancel(order)}
                          disabled={updatingId === order.id}
                          className="rounded border border-ink/15 px-3 py-1.5 text-sm text-rust hover:border-rust disabled:opacity-60"
                        >
                          {t('orders.cancelOrder')}
                        </button>
                      )}
                      {canReturn && canCancelOrders(role) && returningId !== order.id && (
                        <button
                          onClick={() => setReturningId(order.id)}
                          disabled={updatingId === order.id}
                          className="rounded border border-ink/15 px-3 py-1.5 text-sm text-rust hover:border-rust disabled:opacity-60"
                        >
                          {t('orders.returnBtn')}
                        </button>
                      )}
                    </div>
                    {returningId === order.id && (
                      <div className="mt-3 rounded border border-ink/10 bg-paper-soft p-3 text-sm">
                        <p className="text-ink-soft">{t('orders.returnHelp')}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            onClick={() => handleReturn(order, true)}
                            disabled={updatingId === order.id}
                            className="rounded bg-ink px-3 py-1.5 text-paper transition hover:bg-brass disabled:opacity-60"
                          >
                            {t('orders.returnRestock')}
                          </button>
                          <button
                            onClick={() => handleReturn(order, false)}
                            disabled={updatingId === order.id}
                            className="rounded border border-ink/15 px-3 py-1.5 hover:border-rust disabled:opacity-60"
                          >
                            {t('orders.returnNoRestock')}
                          </button>
                          <button
                            onClick={() => setReturningId(null)}
                            className="px-3 py-1.5 text-ink-soft hover:underline"
                          >
                            {t('orders.returnKeep')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
