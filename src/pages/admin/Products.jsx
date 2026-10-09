import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTenant } from '../../context/TenantContext';
import { useLanguage } from '../../context/LanguageContext';
import AdminTopBar from '../../components/admin/AdminTopBar';
import ImageField from '../../components/admin/ImageField';
import { useAudit } from '../../hooks/useAudit';
import { diffFields } from '../../utils/audit';
import OptionsEditor from '../../components/admin/OptionsEditor';
import { optionsToForm, optionsAreValid } from '../../utils/productOptionsForm';
import { formatPrice } from '../../utils/format';
import { LOW_STOCK_THRESHOLD } from '../../utils/constants';
import {
  listProducts,
  listProductCostDetails,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../../firebase/products.service';


const emptyForm = {
  options: [],
  images: [],
  relatedIds: [],
  nameEn: '',
  nameAr: '',
  descriptionEn: '',
  descriptionAr: '',
  price: '',
  costPrice: '',
  stock: '',
  sku: '',
  shippingExtra: '',
  imageUrl: '',
  isActive: true,
  isPreorder: false,
  preorderMessageEn: '',
  preorderMessageAr: '',
};

export default function Products() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { tenant } = useTenant();
  const log = useAudit(); // records who changed what (Activity log)

  const [products, setProducts] = useState([]);
  const [costs, setCosts] = useState({}); // private cost prices by product id
  const [optionCostsMap, setOptionCostsMap] = useState({}); // private extra cost of each choice
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function refresh() {
    if (!tenant) return;
    setLoading(true);
    const [data, costMap] = await Promise.all([
      listProducts(tenant.id),
      listProductCostDetails(tenant.id),
    ]);
    setCosts(Object.fromEntries(Object.entries(costMap).map(([id, c]) => [id, c.costPrice])));
    setOptionCostsMap(Object.fromEntries(Object.entries(costMap).map(([id, c]) => [id, c.optionCosts])));
    setProducts(
      data.sort(
        (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
      )
    );
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant]);

  function startAdd() {
    setForm(emptyForm);
    setEditingId('new');
    setError('');
  }

  function startEdit(p) {
    setForm({
      nameEn: p.name?.en || '',
      nameAr: p.name?.ar || '',
      descriptionEn: p.description?.en || '',
      descriptionAr: p.description?.ar || '',
      price: p.price,
      costPrice: costs[p.id] ?? '',
      options: optionsToForm(p.options, optionCostsMap[p.id]),
      images: p.images || [],
      relatedIds: p.relatedIds || [],
      stock: p.stock,
      sku: p.sku || '',
      shippingExtra: p.shippingExtra ?? '',
      imageUrl: p.imageUrl || '',
      isActive: p.isActive,
      isPreorder: p.isPreorder === true,
      preorderMessageEn: p.preorderMessage?.en || '',
      preorderMessageAr: p.preorderMessage?.ar || '',
    });
    setEditingId(p.id);
    setError('');
  }

  function cancelForm() {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.nameEn.trim()) {
      setError(t('products.nameRequired'));
      return;
    }
    if (form.price === '' || Number(form.price) < 0) {
      setError(t('products.badPrice'));
      return;
    }
    if (form.costPrice !== '' && Number(form.costPrice) < 0) {
      setError(t('products.badCost'));
      return;
    }
    if (!optionsAreValid(form.options)) {
      setError(t('options.errInvalid'));
      return;
    }
    if (!form.isPreorder && (form.stock === '' || Number(form.stock) < 0)) {
      setError(t('products.badStock'));
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (editingId === 'new') {
        const newId = await createProduct(tenant.id, form);
        log({
          action: 'product.create',
          entityType: 'product',
          entityId: newId,
          entityLabel: form.nameEn,
          changes: [
            { field: 'price', to: String(form.price) },
            { field: 'stock', to: String(form.stock === '' ? 0 : form.stock) },
          ],
        });
      } else {
        const original = products.find((p) => p.id === editingId);
        await updateProduct(tenant.id, editingId, form);
        const changes = diffFields(
          {
            name: original?.name?.en,
            price: original?.price,
            cost: costs[editingId] ?? '',
            stock: original?.stock,
            active: original?.isActive,
            preorder: original?.isPreorder === true,
            sku: original?.sku || '',
            shippingExtra: original?.shippingExtra || 0,
            options: (original?.options || []).length,
          },
          {
            name: form.nameEn,
            price: Number(form.price),
            cost: form.costPrice === '' ? '' : Number(form.costPrice),
            stock: form.stock === '' ? 0 : Number(form.stock),
            active: form.isActive,
            preorder: form.isPreorder,
            sku: form.sku || '',
            shippingExtra: Number(form.shippingExtra) || 0,
            options: form.options.length,
          }
        );
        if (changes.length > 0) {
          log({
            action: 'product.update',
            entityType: 'product',
            entityId: editingId,
            entityLabel: form.nameEn,
            changes,
          });
        }
      }
      cancelForm();
      await refresh();
    } catch (err) {
      setError(t('products.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (
      !window.confirm(t('products.confirmDelete'))
    ) {
      return;
    }
    const removed = products.find((p) => p.id === id);
    await deleteProduct(id);
    log({
      action: 'product.delete',
      entityType: 'product',
      entityId: id,
      entityLabel: removed?.name?.en || '',
    });
    await refresh();
  }

  return (
    <div className="min-h-screen px-6 py-10">
      <AdminTopBar />
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">
          {t('admin.products')}
        </h1>
        {editingId === null && (
          <button
            onClick={startAdd}
            className="rounded bg-ink px-4 py-2 text-sm text-paper transition hover:bg-brass"
          >
            {t('products.add')}
          </button>
        )}
      </div>

      {editingId !== null && (
        <form
          onSubmit={handleSave}
          className="mb-8 grid max-w-2xl gap-4 rounded-md border border-ink/10 bg-paper-soft p-6 sm:grid-cols-2"
        >
          <h2 className="col-span-full font-display text-lg font-medium">
            {editingId === 'new' ? t('products.addTitle') : t('products.editTitle')}
          </h2>

          <label className="text-sm text-ink-soft">
            {t('products.nameEn')}
            <input
              type="text"
              value={form.nameEn}
              onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
              className="mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass"
            />
          </label>

          <label className="text-sm text-ink-soft">
            {t('products.nameAr')}
            <input
              type="text"
              dir="rtl"
              value={form.nameAr}
              onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
              className="mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass"
            />
          </label>

          <label className="col-span-full text-sm text-ink-soft">
            {t('products.descEn')}
            <textarea
              rows={2}
              value={form.descriptionEn}
              onChange={(e) =>
                setForm({ ...form, descriptionEn: e.target.value })
              }
              className="mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass"
            />
          </label>

          <label className="col-span-full text-sm text-ink-soft">
            {t('products.descAr')}
            <textarea
              rows={2}
              dir="rtl"
              value={form.descriptionAr}
              onChange={(e) =>
                setForm({ ...form, descriptionAr: e.target.value })
              }
              className="mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass"
            />
          </label>

          <label className="text-sm text-ink-soft">
            {t('products.price')}
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className="mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass"
            />
          </label>

          <label className="text-sm text-ink-soft">
            {t('products.cost')}
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.costPrice}
              onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
              className="mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass"
            />
            <span className="mt-1 block text-xs text-ink-faint">
              {t('products.costHint')}
              {form.price !== '' && form.costPrice !== '' && (
                <>
                  {' '}
                  {t('products.profitPerUnit')}{' '}
                  <strong>
                    {formatPrice(Number(form.price) - Number(form.costPrice), language)}
                  </strong>
                </>
              )}
            </span>
          </label>

          <label className="text-sm text-ink-soft">
            {t('products.stock')}
            <input
              type="number"
              min="0"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
              className="mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass"
            />
          </label>

          <label className="text-sm text-ink-soft">
            {t('products.sku')}
            <input
              type="text"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              className="mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass"
            />
          </label>

          <label className="text-sm text-ink-soft">
            {t('products.shippingExtra')}
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.shippingExtra}
              onChange={(e) => setForm({ ...form, shippingExtra: e.target.value })}
              className="mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass"
            />
            <span className="mt-1 block text-xs text-ink-faint">
              {t('products.shippingExtraHint')}
            </span>
          </label>

          <ImageField
            label={t('products.imageUrl')}
            value={form.imageUrl}
            onChange={(url) => setForm({ ...form, imageUrl: url })}
          />

          {/* more pictures (gallery) */}
          <div className="col-span-full rounded border border-ink/10 bg-white p-3">
            <p className="text-sm font-medium">{t('products.galleryTitle')}</p>
            <p className="mt-1 text-xs text-ink-faint">{t('products.galleryHelp')}</p>
            <div className="mt-3 space-y-3">
              {form.images.map((url, i) => (
                <div key={i} className="flex items-end gap-2">
                  <div className="flex-1">
                    <ImageField
                      label={t('products.galleryN', { n: i + 1 })}
                      value={url}
                      onChange={(u) =>
                        setForm({ ...form, images: form.images.map((x, k) => (k === i ? u : x)) })
                      }
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, images: form.images.filter((_, k) => k !== i) })}
                    className="pb-2 text-xs text-rust hover:underline"
                  >
                    {t('common.remove')}
                  </button>
                </div>
              ))}
            </div>
            {form.images.length < 8 && (
              <button
                type="button"
                onClick={() => setForm({ ...form, images: [...form.images, ''] })}
                className="mt-3 rounded border border-ink/15 px-3 py-1.5 text-sm hover:border-brass"
              >
                {t('products.addPicture')}
              </button>
            )}
          </div>

          {/* related products, e.g. extension plates sold on their own */}
          {products.filter((p) => p.id !== editingId).length > 0 && (
            <div className="col-span-full rounded border border-ink/10 bg-white p-3">
              <p className="text-sm font-medium">{t('products.relatedTitle')}</p>
              <p className="mt-1 text-xs text-ink-faint">{t('products.relatedHelp')}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {products
                  .filter((p) => p.id !== editingId)
                  .map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm text-ink-soft">
                      <input
                        type="checkbox"
                        checked={form.relatedIds.includes(p.id)}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            relatedIds: e.target.checked
                              ? [...form.relatedIds, p.id].slice(0, 6)
                              : form.relatedIds.filter((x) => x !== p.id),
                          })
                        }
                      />
                      {p.name?.[language] || p.name?.en}
                    </label>
                  ))}
              </div>
            </div>
          )}

          <OptionsEditor
            options={form.options}
            onChange={(options) => setForm({ ...form, options })}
          />

          <div className="col-span-full rounded border border-ink/10 bg-white p-3">
            <label className="flex items-center gap-2 text-sm text-ink-soft">
              <input
                type="checkbox"
                checked={form.isPreorder}
                onChange={(e) =>
                  setForm({ ...form, isPreorder: e.target.checked })
                }
              />
              {t('products.preorderCheck')}
            </label>
            {form.isPreorder && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-sm text-ink-soft">
                  {t('products.preorderMsgEn')}
                  <input
                    type="text"
                    placeholder={t('products.preorderPhEn')}
                    value={form.preorderMessageEn}
                    onChange={(e) =>
                      setForm({ ...form, preorderMessageEn: e.target.value })
                    }
                    className="mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass"
                  />
                </label>
                <label className="text-sm text-ink-soft">
                  {t('products.preorderMsgAr')}
                  <input
                    type="text"
                    dir="rtl"
                    placeholder={t('products.preorderPhAr')}
                    value={form.preorderMessageAr}
                    onChange={(e) =>
                      setForm({ ...form, preorderMessageAr: e.target.value })
                    }
                    className="mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass"
                  />
                </label>
              </div>
            )}
          </div>

          {editingId !== 'new' && (
            <label className="col-span-full flex items-center gap-2 text-sm text-ink-soft">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm({ ...form, isActive: e.target.checked })
                }
              />
              {t('products.visible')}
            </label>
          )}

          {error && <p className="col-span-full text-sm text-rust">{error}</p>}

          <div className="col-span-full flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-ink px-4 py-2 text-sm text-paper transition hover:bg-brass disabled:opacity-60"
            >
              {saving ? t('common.saving') : t('common.save')}
            </button>
            <button
              type="button"
              onClick={cancelForm}
              className="rounded border border-ink/15 px-4 py-2 text-sm text-ink-soft hover:border-rust hover:text-rust"
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      )}

      {!loading && products.some((p) => !p.isPreorder && p.stock <= LOW_STOCK_THRESHOLD) && (
        <p className="mb-4 rounded border border-brass/30 bg-brass/10 px-3 py-2 text-sm text-brass-dark">
          {t('products.lowBanner', {
            n: products.filter((p) => !p.isPreorder && p.stock <= LOW_STOCK_THRESHOLD)
              .length,
          })}
        </p>
      )}

      {loading ? (
        <p className="text-ink-soft">{t('common.loading')}</p>
      ) : products.length === 0 ? (
        <p className="text-ink-soft">
          {t('products.none')}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <div
              key={p.id}
              className="rounded-md border border-ink/10 bg-white p-4"
            >
              {p.imageUrl ? (
                <img
                  src={p.imageUrl}
                  alt={p.name?.[language] || p.name?.en}
                  className="mb-3 h-40 w-full rounded object-cover"
                />
              ) : (
                <div className="mb-3 flex h-40 w-full items-center justify-center rounded bg-paper-dim text-sm text-ink-faint">
                  {t('products.noImage')}
                </div>
              )}
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{p.name?.[language] || p.name?.en}</p>
                  <p className="text-sm text-ink-soft">
                    {t('products.priceStock', {
                      price: formatPrice(p.price, language),
                      stock: p.stock,
                    })}
                  </p>
                  <p className="text-xs text-ink-faint">
                    {costs[p.id] !== null && costs[p.id] !== undefined
                      ? t('products.costLine', {
                          cost: formatPrice(costs[p.id], language),
                          profit: formatPrice(p.price - costs[p.id], language),
                        })
                      : t('products.noCost')}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {!p.isActive && (
                    <span className="rounded bg-paper-dim px-2 py-0.5 text-xs text-ink-faint">
                      {t('products.hidden')}
                    </span>
                  )}
                  {p.isPreorder && (
                    <span className="rounded bg-ink/10 px-2 py-0.5 text-xs text-ink-soft">
                      {t('storefront.preorder')}
                    </span>
                  )}
                  {!p.isPreorder && p.stock <= 0 && (
                    <span className="rounded bg-rust/15 px-2 py-0.5 text-xs text-rust">
                      {t('storefront.outOfStock')}
                    </span>
                  )}
                  {!p.isPreorder && p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD && (
                    <span className="rounded bg-brass/15 px-2 py-0.5 text-xs text-brass-dark">
                      {t('products.lowStockBadge')}
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-3 flex gap-3 text-sm">
                <button
                  onClick={() => startEdit(p)}
                  className="text-brass hover:underline"
                >
                  {t('common.edit')}
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  className="text-rust hover:underline"
                >
                  {t('common.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
