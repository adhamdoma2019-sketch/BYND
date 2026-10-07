import { Component } from 'react';
import i18n from 'i18next';

// If something on a page breaks, show a calm "reload" screen instead of a blank page.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    // Visible in the browser console / Vercel logs for debugging.
    console.error('Page error:', error?.message);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <h1 className="font-display text-2xl font-semibold">{i18n.t('errorPage.title')}</h1>
        <p className="mt-2 max-w-sm text-ink-soft">{i18n.t('errorPage.body')}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 rounded bg-ink px-6 py-2.5 text-sm text-paper transition hover:bg-brass"
        >
          {i18n.t('errorPage.reload')}
        </button>
      </div>
    );
  }
}
