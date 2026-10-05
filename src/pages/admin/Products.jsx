import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTenant } from '../../context/TenantContext';
import { LOW_STOCK_THRESHOLD } from '../../utils/constants';
import {
  listProducts,
  listProductCosts,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../../firebase/products.service';


const emptyForm = {
  nameEn: '',
  nameAr: '',
  descriptionEn: '',
  descriptionAr: '',
  price: '',
  costPrice: '',
  stock: '',
  sku: '',
  imageUrl: '',
  isActive: true,
  isPreorder: false,
  preorderMessageEn: '',
  preorderMessageAr: '',
};

export default function Products() {
  const { t } = useTranslation();
  const { tenant } = useTenant();

  const [products, setProducts] = useState([]);
  const [costs, setCosts] = useState({}); // private cost prices by product id
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
      listProductCosts(tenant.id),
    ]);
    setCosts(costMap);
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
      stock: p.stock,
      sku: p.sku || '',
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
      setError('Product name (English) is required.');
      return;
    }
    if (form.price === '' || Number(form.price) < 0) {
      setError('Enter a valid price.');
      return;
    }
    if (form.costPrice !== '' && Number(form.costPrice) < 0) {
      setError('Enter a valid cost price (or leave it empty).');
      return;
    }
    if (!form.isPreorder && (form.stock === '' || Number(form.stock) < 0)) {
      setError('Enter a valid stock quantity.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (editingId === 'new') {
        await createProduct(tenant.id, form);
      } else {
        await updateProduct(tenant.id, editingId, form);
      }
      cancelForm();
      await refresh();
    } catch (err) {
      setError('Could not save the product. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (
      !window.confirm(
        'Remove this product? It will disappear from the storefront but past orders stay intact.'
      )
    ) {
      return;
    }
    await deleteProduct(id);
    await refresh();
  }

  return (
    <div className="min-h-screen px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">
          {t('admin.products')}
        </h1>
        {editingId === null && (
          <button
            onClick={startAdd}
            className="rounded bg-ink px-4 py-2 text-sm text-paper transition hover:bg-brass"
          >
            + Add product
          </button>
        )}
      </div>

      {editingId !== null && (
        <form
          onSubmit={handleSave}
          className="mb-8 grid max-w-2xl gap-4 rounded-md border border-ink/10 bg-paper-soft p-6 sm:grid-cols-2"
        >
          <h2 className="col-span-full font-display text-lg font-medium">
            {editingId === 'new' ? 'Add product' : 'Edit product'}
          </h2>

          <label className="text-sm text-ink-soft">
            Name (English)
            <input
              type="text"
              value={form.nameEn}
              onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
              className="mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass"
            />
          </label>

          <label className="text-sm text-ink-soft">
            الاسم (Arabic)
            <input
              type="text"
              dir="rtl"
              value={form.nameAr}
              onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
              className="mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass"
            />
          </label>

          <label className="col-span-full text-sm text-ink-soft">
            Description (English)
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
            الوصف (Arabic)
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
            Price (EGP)
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
            Cost price (EGP)
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.costPrice}
              onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
              className="mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass"
            />
            <span className="mt-1 block text-xs text-ink-faint">
              Private: what one unit costs you. Customers never see this.
              {form.price !== '' && form.costPrice !== '' && (
                <>
                  {' '}
                  Profit per unit:{' '}
                  <strong>
                    {Number(form.price) - Number(form.costPrice)} EGP
                  </strong>
                </>
              )}
            </span>
          </label>

          <label className="text-sm text-ink-soft">
            Stock quantity
            <input
              type="number"
              min="0"
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: e.target.value })}
              className="mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass"
            />
          </label>

          <label className="text-sm text-ink-soft">
            SKU (optional)
            <input
              type="text"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              className="mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass"
            />
          </label>

          <label className="text-sm text-ink-soft">
            Image URL
            <input
              type="url"
              placeholder="https://..."
              value={form.imageUrl}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              className="mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass"
            />
          </label>

          <div className="col-span-full rounded border border-ink/10 bg-white p-3">
            <label className="flex items-center gap-2 text-sm text-ink-soft">
              <input
                type="checkbox"
                checked={form.isPreorder}
                onChange={(e) =>
                  setForm({ ...form, isPreorder: e.target.checked })
                }
              />
              This is a preorder product (customers can order it even when
              stock is 0)
            </label>
            {form.isPreorder && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-sm text-ink-soft">
                  Preorder message (English)
                  <input
                    type="text"
                    placeholder="Preorder now. Shipping starts from..."
                    value={form.preorderMessageEn}
                    onChange={(e) =>
                      setForm({ ...form, preorderMessageEn: e.target.value })
                    }
                    className="mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass"
                  />
                </label>
                <label className="text-sm text-ink-soft">
                  رسالة الحجز المسبق (Arabic)
                  <input
                    type="text"
                    dir="rtl"
                    placeholder="احجز الآن. يبدأ الشحن من..."
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
              Visible on storefront
            </label>
          )}

          {error && <p className="col-span-full text-sm text-rust">{error}</p>}

          <div className="col-span-full flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-ink px-4 py-2 text-sm text-paper transition hover:bg-brass disabled:opacity-60"
            >
              {saving ? 'Saving...' : t('common.save')}
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
          {products.filter((p) => !p.isPreorder && p.stock <= LOW_STOCK_THRESHOLD).length}{' '}
          product(s) low or out of stock — check the badges below.
        </p>
      )}

      {loading ? (
        <p className="text-ink-soft">{t('common.loading')}</p>
      ) : products.length === 0 ? (
        <p className="text-ink-soft">
          No products yet. Add your first one above.
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
                  alt={p.name?.en}
                  className="mb-3 h-40 w-full rounded object-cover"
                />
              ) : (
                <div className="mb-3 flex h-40 w-full items-center justify-center rounded bg-paper-dim text-sm text-ink-faint">
                  No image
                </div>
              )}
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{p.name?.en}</p>
                  <p className="text-sm text-ink-soft">
                    {p.price} EGP · stock: {p.stock}
                  </p>
                  <p className="text-xs text-ink-faint">
                    {costs[p.id] !== null && costs[p.id] !== undefined
                      ? `Cost: ${costs[p.id]} EGP · profit/unit: ${
                          p.price - costs[p.id]
                        } EGP`
                      : 'No cost set yet'}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {!p.isActive && (
                    <span className="rounded bg-paper-dim px-2 py-0.5 text-xs text-ink-faint">
                      Hidden
                    </span>
                  )}
                  {p.isPreorder && (
                    <span className="rounded bg-ink/10 px-2 py-0.5 text-xs text-ink-soft">
                      Preorder
                    </span>
                  )}
                  {!p.isPreorder && p.stock <= 0 && (
                    <span className="rounded bg-rust/15 px-2 py-0.5 text-xs text-rust">
                      Out of stock
                    </span>
                  )}
                  {!p.isPreorder && p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD && (
                    <span className="rounded bg-brass/15 px-2 py-0.5 text-xs text-brass-dark">
                      Low stock
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
