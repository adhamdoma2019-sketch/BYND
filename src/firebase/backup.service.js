import { listProducts, listProductCostDetails } from './products.service';
import { listOrders } from './orders.service';
import { listExpenses } from './expenses.service';
import { listPromoCodes } from './promos.service';
import { listAudit } from './audit.service';
import { getTenantPrivate } from './private.service';

export { backupToJson } from '../utils/backup';

// Gathers everything the shop owns into one object, to be saved as a backup file.
// (The free Firebase plan has no automatic backups, so the owner downloads one now
// and then. Only the owner can read all of this, so only the owner can make it.)
export async function buildBackup(tenant) {
  const id = tenant.id;
  const [products, productCosts, orders, expenses, promoCodes, activityLog, alertSettings] =
    await Promise.all([
      listProducts(id),
      listProductCostDetails(id),
      listOrders(id),
      listExpenses(id),
      listPromoCodes(id),
      listAudit(id, 1000).catch(() => []),
      getTenantPrivate(id).catch(() => ({})),
    ]);

  return {
    format: 'shop-backup-1',
    exportedAt: new Date().toISOString(),
    shop: tenant, // name, look, shipping zones, checkout form...
    alertSettings,
    products,
    productCosts, // private cost of each product and choice
    orders,
    expenses,
    promoCodes,
    activityLog,
  };
}
