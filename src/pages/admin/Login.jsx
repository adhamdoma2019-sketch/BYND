import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import LanguageSwitch from '../../components/shared/LanguageSwitch';

export default function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/admin');
    } catch (err) {
      setError(t('login.invalid'));
    } finally {
      setSubmitting(false);
    }
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
        <h1 className="font-display text-2xl font-semibold">{t('admin.login')}</h1>

        <label className="mt-6 block text-sm text-ink-soft">
          {t('admin.email')}
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
          {t('admin.signIn')}
        </button>
      </form>
    </div>
  );
}
