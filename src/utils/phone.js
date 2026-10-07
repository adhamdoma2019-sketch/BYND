// Turns a customer's phone number into a WhatsApp chat link (wa.me).
// Local numbers like 01026409664 get the shop's country code (Egypt = 20).
export function whatsappLink(phone, countryCode = '20') {
  const raw = String(phone || '').replace(/[^\d+]/g, '');
  if (!raw) return '';
  let digits;
  if (raw.startsWith('+')) digits = raw.slice(1);
  else if (raw.startsWith('00')) digits = raw.slice(2);
  else if (raw.startsWith('0')) digits = countryCode + raw.slice(1);
  else digits = raw.startsWith(countryCode) ? raw : countryCode + raw;
  digits = digits.replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : '';
}
