import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Last-resort render guard (audit F1): a crash anywhere in the tree shows a
 * recoverable French message instead of a white screen. Kept dependency-free
 * on purpose - the boundary must survive even if i18n itself fails.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('EduTrack render error:', error, info.componentStack);
  }

  override render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className="fixed inset-0 w-full h-full bg-slate-50 font-sans flex items-center justify-center px-6">
        <section
          className="w-full max-w-md bg-white rounded-[28px] shadow-[0_20px_80px_-10px_rgba(0,0,0,0.15)] border border-slate-200 p-8 text-center"
          role="alert"
          aria-live="assertive"
        >
          <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mb-5">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-7 h-7 text-amber-600"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </div>

          <h1 className="text-lg font-bold text-slate-900">Une erreur inattendue est survenue</h1>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            L&apos;affichage a été interrompu. Vos données sont en sécurité dans la base locale.
          </p>

          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false });
            }}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-5 py-2.5 transition-colors"
          >
            Recharger l&apos;affichage
          </button>

          <button
            type="button"
            onClick={() => {
              window.location.reload();
            }}
            className="mt-2 w-full text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors"
          >
            Redémarrer l&apos;application
          </button>
        </section>
      </main>
    );
  }
}
