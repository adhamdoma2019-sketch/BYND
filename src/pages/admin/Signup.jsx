import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { createTenant, isSlugAvailable } from '../../firebase/tenants.service';
import { slugify } from '../../utils/slugify';
import { useTenant } from '../../context/TenantContext';

export default function Signup() {
  const navigate = useNavigate();
  const { reloadTenant } = useTenant();

  const [shopName, setShopName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const slug = slugify(shopName);
    if (!slug) {
      setError('Please enter a shop name.');
      return;
    }

    setSubmitting(true);
    try {
      const available = await isSlugAvailable(slug);
      if (!available) {
        setError(
          `The shop name "${shopName}" is already taken (someone is using yourapp.com/store/${slug}). Try a more specific name.`
        );
        setSubmitting(false);
        return;
      }

      const credential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      await createTenant({ slug, shopName, ownerUid: credential.user.uid });

      // The shop record now exists, so reload it before opening the dashboard.
      reloadTenant();
      navigate('/admin');
    } catch (err) {
      console.error('Signup error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('That email already has an account. Try signing in instead.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Network error — please check your connection and try again.');
      } else {
        setError('Something went wrong creating your shop. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const previewSlug = slugify(shopName) || 'your-shop-name';

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-md border border-ink/10 bg-paper-soft p-8"
      >
        <h1 className="font-display text-2xl font-semibold">
          Create your shop
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          This sets up your storefront and your partner login in one step.
        </p>

        <label className="mt-6 block text-sm text-ink-soft">
          Shop name
          <input
            type="text"
            required
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            placeholder="e.g. Adham's Workshop"
            className="mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass"
          />
          <span className="mt-1 block text-xs text-ink-faint">
            Your storefront address: yourapp.com/store/{previewSlug}
          </span>
        </label>

        <label className="mt-4 block text-sm text-ink-soft">
          Your email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass"
          />
        </label>

        <label className="mt-4 block text-sm text-ink-soft">
          Password
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass"
          />
        </label>

        {error && <p className="mt-3 text-sm text-rust">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded bg-ink py-2.5 text-paper transition hover:bg-brass disabled:opacity-60"
        >
          {submitting ? 'Creating your shop...' : 'Create shop'}
        </button>
      </form>
    </div>
  );
}
