import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTenant } from '../../context/TenantContext';
import { useLanguage } from '../../context/LanguageContext';
import AdminTopBar from '../../components/admin/AdminTopBar';
import { formatPrice } from '../../utils/format';
import {
  listOrders,
  updateOrderStatus,
  cancelOrder,
  updateOrderCustomer,
} from '../../firebase/orders.service';
import { orderCost } from '../../utils/profit';

const STATUS_FLOW = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];
const ALL_STATUSES = [...STATUS_FLOW, 'cancelled'];

function nextStatus(current) {
  const idx = STATUS_FLOW.indexOf(current);
  if (idx === -1 || idx === STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[idx + 1];
}

function statusBadgeClass(status) {
  if (status === 'delivered') return 'bg-sage/15 text-sage-dark';
  if (status === 'cancelled') return 'bg-rust/15 text-rust';
  if (status === 'shipped') return 'bg-brass/15 text-brass-dark';
  if (status === 'confirmed') return 'bg-sage/10 text-sage-dark';
  return 'bg-paper-dim text-ink-soft';
}

function orderDateStr(order) {
  if (!order.createdAt?.seconds) return '';
  return new Date(order.createdAt.seconds * 1000).toISOString().slice(0, 10);
}

export default function Orders() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { tenant } = useTenant();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [actionError, setActionError] = useState('');

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

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (statusFilter !== 'all' && order.status !== statusFilter) return false;

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
  }, [orders, statusFilter, search, dateFrom, dateTo]);

  async function handleAdvance(order) {
    const next = nextStatus(order.status);
    if (!next) return;
    setUpdatingId(order.id);
    setActionError('');
    await updateOrderStatus(order.id, next);
    await refresh();
    setUpdatingId(null);
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
    await updateOrderCustomer(orderId, customerForm);
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
            const canCancel =
              order.status !== 'delivered' && order.status !== 'cancelled';
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
                            <p className="text-sm text-ink-soft">
                              {order.customer?.phone}
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
                          <div key={i} className="flex justify-between text-sm">
                            <span>
                              {item.name?.[language] || item.name?.en} ×{' '}
                              {item.quantity}
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
                        {(() => {
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
                      {canCancel && (
                        <button
                          onClick={() => handleCancel(order)}
                          disabled={updatingId === order.id}
                          className="rounded border border-ink/15 px-3 py-1.5 text-sm text-rust hover:border-rust disabled:opacity-60"
                        >
                          {t('orders.cancelOrder')}
                        </button>
                      )}
                    </div>
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
