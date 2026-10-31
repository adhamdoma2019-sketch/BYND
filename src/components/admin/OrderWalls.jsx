import { useTranslation } from 'react-i18next';
import WallPicture from '../storefront/WallPicture';
import { wallToSvg } from '../../utils/wallExport';

// The walls the customer planned, shown to the team inside an order: picture, number of pieces, the mix of colours,
// and a button to download the picture (an SVG file, opens in any browser and prints well).
export default function OrderWalls({ order, language }) {
  const { t } = useTranslation();
  const walls = order?.walls || [];
  if (walls.length === 0) return null;

  function download(wall, index) {
    const blob = new Blob([wallToSvg(wall)], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${order.orderNumberLabel || 'order'}-wall-${index + 1}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="mt-3 space-y-3" data-order-walls>
      {walls.map((w, i) => (
        <div key={w.id} className="rounded border border-ink/10 bg-white p-3">
          <p className="text-sm font-medium">
            {t('orders.wallTitle')} — {w.productName?.[language] || w.productName?.en}
          </p>
          <p className="text-xs text-ink-soft">{t('wall.cartTitle', { n: w.count })}</p>
          <div className="mt-2 flex flex-wrap items-start gap-4">
            <WallPicture cells={w.cells} className="h-40 w-40 shrink-0" label={t('orders.wallTitle')} />
            <div>
              <ul className="space-y-1 text-sm">
                {(w.colors || []).map((c) => (
                  <li key={c.id} className="flex items-center gap-1.5">
                    <span className="inline-block h-3.5 w-3.5 rounded-sm border border-ink/30" style={{ backgroundColor: c.color }} />
                    {t('wall.legendItem', { n: c.count, name: c.label?.[language] || c.label?.en })}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => download(w, i)}
                className="mt-3 rounded border border-ink/20 px-3 py-1.5 text-xs font-medium hover:border-brass"
              >
                {t('orders.wallDownload')}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
