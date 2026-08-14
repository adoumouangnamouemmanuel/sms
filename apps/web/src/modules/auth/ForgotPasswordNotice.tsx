import { useTranslation } from 'react-i18next';

export interface ForgotPasswordNoticeProps {
  onClose: () => void;
}

/** Explains the safe offline recovery path without offering unauthenticated resets. */
export function ForgotPasswordNotice({ onClose }: ForgotPasswordNoticeProps) {
  const { t } = useTranslation();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="forgot-password-title"
    >
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.28)]">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </div>

        <h2 id="forgot-password-title" className="text-xl font-bold text-slate-950">
          {t('auth.forgotPassword.title')}
        </h2>
        <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
          {t('auth.forgotPassword.body')}
        </p>
        <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
          {t('auth.forgotPassword.action')}
        </p>

        <button
          className="mt-6 flex h-11 w-full items-center justify-center rounded-2xl bg-teal-700 font-bold text-white shadow-[0_4px_14px_rgba(15,118,110,0.28)] transition-all hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 active:scale-[0.98]"
          onClick={onClose}
          type="button"
        >
          {t('auth.forgotPassword.close')}
        </button>
      </div>
    </div>
  );
}
