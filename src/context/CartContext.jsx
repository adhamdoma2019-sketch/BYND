import { createContext, useContext, useEffect, useState } from 'react';
import { MAX_ORDER_QTY } from '../utils/constants';
import { itemKey } from '../utils/productOptions';

// Older carts saved before options existed have no `key`; the product id works for them.
export const keyOf = (item) => item.key || item.productId;

const CartContext = createContext(null);

function storageKey(slug) {
  return `cart:${slug}`;
}

export function CartProvider({ slug, children }) {
  const [items, setItems] = useState([]);

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
      localStorage.setItem(storageKey(slug), JSON.stringify(items));
    } catch {
      // Ignore storage errors — not critical.
    }
  }, [slug, items]);

  // choice = { selections, labels, unitPrice } from the product page
  // (color, extension...). Same product with different choices = separate lines.
  function addItem(product, quantity = 1, choice = {}) {
    // Most we allow in the cart: the stock (preorders have no stock limit),
    // and never more than the server accepts per order.
    const max = product.isPreorder
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
          quantity: Math.min(quantity, max),
          maxStock: max,
          isPreorder: product.isPreorder === true,
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
    setItems((prev) => prev.map((i) => (keyOf(i) === key ? { ...i, quantity } : i)));
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
