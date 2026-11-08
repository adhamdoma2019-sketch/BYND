// Duplicate-order protection, browser side (update 38).
// Every order attempt carries a random one-time code. While the cart and the details stay exactly the same, a second
// press of "Place order" (after a lost answer, a timeout, a double tap) re-uses the SAME code, so the server gives
// back the order it already saved. If anything changed (another item, another address...), a NEW code is made,
// so a changed order is never mistaken for the earlier one.

export function randomToken(cryptoObj = globalThis.crypto) {
  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(18);
    cryptoObj.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(''); // 36 letters/digits
  }
  // very old browsers: weaker, but still different every time
  let s = '';
  while (s.length < 36) s += Math.random().toString(16).slice(2);
  return s.slice(0, 36);
}

// keeper.get(payload) -> the code for this exact order content.   keeper.reset() -> forget (after a finished order).
export function makeTokenKeeper(random = randomToken) {
  let lastKey = null;
  let token = '';
  return {
    get(payload) {
      const key = JSON.stringify(payload);
      if (key !== lastKey || !token) {
        lastKey = key;
        token = random();
      }
      return token;
    },
    reset() {
      lastKey = null;
      token = '';
    },
  };
}
