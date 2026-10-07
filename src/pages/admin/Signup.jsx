import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { createTenant, isSlugAvailable } from '../../firebase/tenants.service';
import { slugify } from '../../utils/slugify';
import { useTenant } from '../../context/TenantContext';
import LanguageSwitch from '../../components/shared/LanguageSwitch';
import { SIGNUP_OPEN } from '../../config/features';

export default function Signup() {
  const { t } = useTranslation();
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
      setError(t('signup.noName'));
      return;
    }

    setSubmitting(true);
    try {
      const available = await isSlugAvailable(slug);
      if (!available) {
        setError(t('signup.taken', { name: shopName }));
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
        setError(t('signup.emailInUse'));
      } else if (err.code === 'auth/weak-password') {
        setError(t('signup.weakPassword'));
      } else if (err.code === 'auth/invalid-email') {
        setError(t('signup.invalidEmail'));
      } else if (err.code === 'auth/network-request-failed') {
        setError(t('signup.network'));
      } else {
        setError(t('signup.generic'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const previewSlug = slugify(shopName) || 'your-shop-name';

  // Signup is switched off while a single shop uses the site (see config/features.js).
  if (!SIGNUP_OPEN) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <p className="max-w-sm text-ink-soft">{t('signup.closed')}</p>
        <Link to="/admin/login" className="mt-4 text-brass hover:underline">
          {t('admin.login')}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="mb-4 w-full max-w-sm text-end">
        <LanguageSwitch />
      </div>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-md border border-ink/10 bg-paper-soft p-8"
      >
        <h1 className="font-display text-2xl font-semibold">
          {t('signup.title')}
        </h1>
        <p className="mt-1 text-sm text-ink-soft">{t('signup.intro')}</p>

        <label className="mt-6 block text-sm text-ink-soft">
          {t('signup.shopName')}
          <input
            type="text"
            required
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            placeholder={t('signup.shopPlaceholder')}
            className="mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass"
          />
          <span className="mt-1 block text-xs text-ink-faint" dir="ltr">
            {t('signup.address', {
              host: window.location.host,
              slug: previewSlug,
            })}
          </span>
        </label>

        <label className="mt-4 block text-sm text-ink-soft">
          {t('signup.yourEmail')}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-ink/15 bg-white px-3 py-2 text-ink outline-none focus-visible:border-brass"
          />
        </label>

        <label className="mt-4 block text-sm text-ink-soft">
          {t('admin.password')}
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
          {submitting ? t('signup.creating') : t('signup.create')}
        </button>
      </form>
    </div>
  );
}
