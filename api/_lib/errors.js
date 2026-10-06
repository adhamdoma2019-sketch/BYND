// `code` lets the website show the message in the customer's language;
// `meta` carries numbers/names the message needs (e.g. how many are left).
export class OrderError extends Error {
  constructor(status, code, message, meta) {
    super(message);
    this.status = status;
    this.code = code;
    this.meta = meta;
  }
}
