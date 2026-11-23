import { useParams } from 'react-router-dom';
import { singleShop } from '../utils/shopPaths';

// The shop this page belongs to: from the address (/store/<slug>) or, in single-shop mode, the one shop.
export function useShopSlug() {
  const { slug } = useParams();
  return slug || singleShop();
}
