// Design step 3: the small "trust strip" under the buy button. Rule 10 of the project: nothing is
// invented for a shop. An item exists only because the shop really has the fact:
//   cash   cash on delivery (the platform only takes cash on delivery today)
//   fee    the cheapest delivery fee among the shop's switched-on delivery areas ("from X")
//   returns the shop wrote a Returns page
//   whatsapp the shop gave a WhatsApp number
// Pure function: returns a list of { id, ... } (empty list = no strip).
export function trustItems(tenant, { hasReturns = false, hasWhatsapp = false } = {}) {
  const items = [{ id: 'cash' }];
  const zones = (tenant?.shipping?.zones || []).filter((z) => z && z.active !== false);
  if (zones.length > 0) {
    const fees = zones.map((z) => Math.max(0, Number(z.price) || 0));
    const min = Math.min(...fees);
    const max = Math.max(...fees);
    if (max === 0) items.push({ id: 'feeFree' });
    else if (min === 0) items.push({ id: 'feeSome' });
    else items.push({ id: 'feeFrom', price: min });
  }
  if (hasReturns) items.push({ id: 'returns' });
  if (hasWhatsapp) items.push({ id: 'whatsapp' });
  return items;
}
