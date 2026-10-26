import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Landing from '../pages/Landing';
import StorefrontLayout from '../pages/storefront/StorefrontLayout';
import StorefrontHome from '../pages/storefront/StorefrontHome';
import ProductPage from '../pages/storefront/ProductPage';
import Checkout from '../pages/storefront/Checkout';
import OrderConfirmation from '../pages/storefront/OrderConfirmation';
import PolicyPage from '../pages/storefront/PolicyPage';
import ProtectedRoute from './ProtectedRoute';

// The admin screens are loaded only when someone opens them, so customers visiting
// the shop (often on a phone) don't download any admin code.
// Loaded only when a customer opens "Track my order" (keeps the main shop file small).
const TrackOrder = lazy(() => import('../pages/storefront/TrackOrder'));
const Signup = lazy(() => import('../pages/admin/Signup'));
const Login = lazy(() => import('../pages/admin/Login'));
const Dashboard = lazy(() => import('../pages/admin/Dashboard'));
const Products = lazy(() => import('../pages/admin/Products'));
const Orders = lazy(() => import('../pages/admin/Orders'));
const Expenses = lazy(() => import('../pages/admin/Expenses'));
const PnL = lazy(() => import('../pages/admin/PnL'));
const Settings = lazy(() => import('../pages/admin/Settings'));
const PromoCodes = lazy(() => import('../pages/admin/PromoCodes'));
const Team = lazy(() => import('../pages/admin/Team'));
const Activity = lazy(() => import('../pages/admin/Activity'));
const StockHistory = lazy(() => import('../pages/admin/StockHistory'));

export default function AppRoutes() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-ink-soft">…</div>}>
    <Routes>
      <Route path="/" element={<Landing />} />

      <Route path="/store/:slug" element={<StorefrontLayout />}>
        <Route index element={<StorefrontHome />} />
        <Route path="product/:productId" element={<ProductPage />} />
        <Route path="checkout" element={<Checkout />} />
        <Route path="thank-you" element={<OrderConfirmation />} />
        <Route path="page/:pageId" element={<PolicyPage />} />
        <Route path="track" element={<TrackOrder />} />
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
        path="/admin/stock"
        element={
          <ProtectedRoute area="stock">
            <StockHistory />
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
    </Suspense>
  );
}
