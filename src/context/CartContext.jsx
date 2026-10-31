import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { MAX_ORDER_QTY } from '../utils/constants';
import { itemKey } from '../utils/productOptions';
import { cleanTiers, orderLimits, tierGroupOption } from '../utils/quantityPrices';
import { priceCartLines } from '../utils/cartPricing';

// Older carts saved before options existed have no `key`; the product id works for them.
export const keyOf = (item) => item.key || item.productId;

const CartContext = createContext(null);

function storageKey(slug) {
  return `cart:${slug}`;
}

export function CartProvider({ slug, children }) {
  const [rawItems, setItems] = useState([]);
  // Quantity prices: the price of a line depends on how many of the product the whole cart holds.
  const items = useMemo(() => priceCartLines(rawItems), [rawItems]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(slug));
      setItems(raw ? JSON.parse(raw) : []);
    } catch {
      setItems([]);
    }
  }, [slug]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(slug), JSON.stringify(rawItems));
    } catch {
      // Ignore storage errors — not critical.
    }
  }, [slug, rawItems]);

  // choice = { selections, labels, unitPrice } from the product page
  // (color, extension...). Same product with different choices = separate lines.
  function addItem(product, quantity = 1, choice = {}) {
    // Most we allow in the cart: the stock (preorders have no stock limit),
    // and never more than the server accepts per order.
    // (the product page works out the limit for the chosen colour / option and passes it in)
    const max =
      choice.maxQty !== undefined
        ? Math.min(Math.max(Number(choice.maxQty) || 0, 1), MAX_ORDER_QTY)
        : product.isPreorder
          ? MAX_ORDER_QTY
          : Math.min(Number(product.stock) || 0, MAX_ORDER_QTY);
    const selections = choice.selections || {};
    const key = itemKey(product.id, selections);

    setItems((prev) => {
      const existing = prev.find((i) => keyOf(i) === key);
      if (existing) {
        return prev.map((i) =>
          keyOf(i) === key ? { ...i, quantity: Math.min(i.quantity + quantity, max) } : i
        );
      }
      return [
        ...prev,
        {
          key,
          productId: product.id,
          name: product.name,
          unitPrice: choice.unitPrice ?? product.price,
          // For quantity prices: the normal price, what the choices add, the price steps.
          basePrice: Number(product.price) || 0,
          priceDelta: Number(choice.priceDelta) || 0,
          tiers: cleanTiers(product.priceTiers, product.price),
          tierGroup: tierGroupOption(product), // '' = all colours together; else the option counted separately
          minQty: orderLimits(product).min,
          quantity: Math.min(quantity, max),
          maxStock: max,
          isPreorder: product.isPreorder === true || choice.madeToOrder === true,
          selections,
          optionLabels: choice.labels || [],
          imageUrl: choice.imageUrl || '',
        },
      ];
    });
  }

  function updateQuantity(key, quantity) {
    if (quantity <= 0) {
      removeItem(key);
      return;
    }
    setItems((prev) => {
      const line = prev.find((i) => keyOf(i) === key);
      // The shop's minimum per order counts all lines of the product: don't go below it
      // (the customer can still remove the product).
      if (line && line.minQty > 1 && quantity < line.quantity) {
        const others = prev
          .filter((i) => i.productId === line.productId && keyOf(i) !== key)
          .reduce((n, i) => n + i.quantity, 0);
        if (others + quantity < line.minQty) return prev;
      }
      return prev.map((i) => (keyOf(i) === key ? { ...i, quantity } : i));
    });
  }

  function removeItem(key) {
    setItems((prev) => prev.filter((i) => keyOf(i) !== key));
  }

  function clearCart() {
    setItems([]);
  }

  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        subtotal,
        itemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
