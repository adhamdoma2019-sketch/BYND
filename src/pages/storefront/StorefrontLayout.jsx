import { useParams, Outlet } from 'react-router-dom';
import { CartProvider } from '../../context/CartContext';

export default function StorefrontLayout() {
  const { slug } = useParams();
  return (
    <CartProvider slug={slug}>
      <Outlet />
    </CartProvider>
  );
}