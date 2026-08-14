import { APP_NAME, type PublicAuthUser } from '@edutrack/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { readDesktopDeploymentStatus, type DesktopDeploymentStatus } from './desktopStatus';
import { LoginScreen, resolveAuthRuntime } from './modules/auth';

const DEPLOYMENT_STATUS_POLL_MS = 500;

export function App() {
  const { t } = useTranslation();
  const [desktopStatus, setDesktopStatus] = useState<DesktopDeploymentStatus | null>(null);
  const [authenticatedUser, setAuthenticatedUser] = useState<PublicAuthUser | null>(null);

  useEffect(() => {
    let isMounted = true;
    let retryHandle: number | undefined;

    async function readStatus() {
      try {
        const status = await readDesktopDeploymentStatus();

        if (!isMounted) {
          return;
        }

        setDesktopStatus(status);

        if (status?.sidecarStatus === 'starting') {
          // Tauri may render before the sidecar has emitted its ready payload.
          retryHandle = window.setTimeout(readStatus, DEPLOYMENT_STATUS_POLL_MS);
        }
      } catch {
        if (!isMounted) {
          return;
        }

        setDesktopStatus({
          runtime: 'tauri',
          sidecarStatus: 'failed',
          databaseReady: false,
        });
      }
    }

    void readStatus();

    return () => {
      isMounted = false;

      if (retryHandle) {
        window.clearTimeout(retryHandle);
      }
    };
  }, []);

  const authRuntime = resolveAuthRuntime(desktopStatus);

  return (
    <main className="fixed inset-0 w-full h-full bg-slate-50 lg:bg-slate-900 font-sans selection:bg-teal-200 selection:text-teal-900 overflow-hidden">
      {/* Full-Screen Immersive Background (Hidden on Mobile) */}
      <div
        className="hidden lg:block absolute inset-0 bg-[url('/hero-bg-4.png')] bg-cover bg-center bg-no-repeat"
        aria-hidden="true"
      />

      {/* Subtle gradient overlay to ensure text contrast at bottom left */}
      <div className="hidden lg:block absolute inset-0 bg-gradient-to-tr from-slate-950/90 via-slate-900/50 to-transparent pointer-events-none" />

      {/* Floating Brand & Typography (Left Side) */}
      <div className="hidden lg:flex absolute left-12 top-12 bottom-12 flex-col w-[45%] pointer-events-none z-10">
        {/* Logo */}
        <header className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-teal-400 to-teal-600 shadow-lg shadow-teal-900/20 border border-white/20">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-6 h-6 text-white drop-shadow-sm"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path>
            </svg>
          </div>
          <h1 className="text-white text-2xl font-bold tracking-tight drop-shadow-md">
            {APP_NAME}
          </h1>
        </header>

        {/* Minimal Typography */}
        <div className="mt-auto mb-32">
          <h2 className="text-white text-3xl xl:text-4xl font-bold leading-[1.15] drop-shadow-md max-w-xl">
            {t('shell.heading')}
          </h2>
          <p className="mt-4 text-slate-200 text-lg font-medium drop-shadow-sm max-w-lg opacity-90 leading-relaxed">
            {t('shell.summary')}
          </p>
        </div>
      </div>

      {/* Right Side Container - handles overflow gracefully and centers the card */}
      <div className="absolute inset-0 lg:left-auto lg:right-0 lg:w-1/2 flex items-center justify-center px-4 py-6 sm:px-8 lg:px-12 lg:py-8 z-20 pointer-events-none overflow-y-auto">
        {/* The Floating Panel Itself */}
        <section
          className="w-full max-w-[460px] h-auto bg-white rounded-[28px] shadow-[0_20px_80px_-10px_rgba(0,0,0,0.3)] flex flex-col pointer-events-auto my-auto"
          aria-label={t('auth.loginPanelLabel')}
        >
          <div className="w-full px-8 py-8 sm:px-10 lg:px-12 flex flex-col h-full">
            {/* Mobile Header */}
            <div className="lg:hidden flex items-center gap-3 mb-6 shrink-0">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-teal-400 to-teal-600 shadow-md">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-6 h-6 text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path>
                </svg>
              </div>
              <h1 className="text-slate-900 text-2xl font-bold tracking-tight">{APP_NAME}</h1>
            </div>

            <LoginScreen
              apiBaseUrl={authRuntime.apiBaseUrl}
              {...(authRuntime.capabilityToken
                ? { capabilityToken: authRuntime.capabilityToken }
                : {})}
              desktopStatus={desktopStatus}
              onAuthenticated={setAuthenticatedUser}
              onLoggedOut={() => {
                setAuthenticatedUser(null);
              }}
              user={authenticatedUser}
            />

            <div className="mt-6 pt-5 flex flex-col items-center justify-center border-t border-slate-100 gap-2 shrink-0">
              <p className="text-[11px] text-slate-500/60 font-medium">EduTrack Africa • v1.0.0</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
