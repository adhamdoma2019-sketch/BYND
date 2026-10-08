import { Routes, Route } from 'react-router-dom';
import Landing from '../pages/Landing';
import StorefrontLayout from '../pages/storefront/StorefrontLayout';
import StorefrontHome from '../pages/storefront/StorefrontHome';
import ProductPage from '../pages/storefront/ProductPage';
import Checkout from '../pages/storefront/Checkout';
import OrderConfirmation from '../pages/storefront/OrderConfirmation';
import Signup from '../pages/admin/Signup';
import Login from '../pages/admin/Login';
import Dashboard from '../pages/admin/Dashboard';
import Products from '../pages/admin/Products';
import Orders from '../pages/admin/Orders';
import Expenses from '../pages/admin/Expenses';
import PnL from '../pages/admin/PnL';
import Settings from '../pages/admin/Settings';
import PromoCodes from '../pages/admin/PromoCodes';
import Team from '../pages/admin/Team';
import Activity from '../pages/admin/Activity';
import ProtectedRoute from './ProtectedRoute';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />

      <Route path="/store/:slug" element={<StorefrontLayout />}>
        <Route index element={<StorefrontHome />} />
        <Route path="product/:productId" element={<ProductPage />} />
        <Route path="checkout" element={<Checkout />} />
        <Route path="thank-you" element={<OrderConfirmation />} />
      </Route>

      <Route path="/admin/signup" element={<Signup />} />
      <Route path="/admin/login" element={<Login />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/products"
        element={
          <ProtectedRoute area="products">
            <Products />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/orders"
        element={
          <ProtectedRoute area="orders">
            <Orders />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/expenses"
        element={
          <ProtectedRoute area="expenses">
            <Expenses />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/promos"
        element={
          <ProtectedRoute area="promos">
            <PromoCodes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/settings"
        element={
          <ProtectedRoute area="settings">
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/pnl"
        element={
          <ProtectedRoute area="pnl">
            <PnL />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/team"
        element={
          <ProtectedRoute area="team">
            <Team />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/activity"
        element={
          <ProtectedRoute area="activity">
            <Activity />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
