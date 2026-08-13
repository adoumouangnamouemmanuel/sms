import { APP_NAME, type PublicAuthUser } from '@edutrack/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { readDesktopDeploymentStatus, type DesktopDeploymentStatus } from './desktopStatus';
import { LoginScreen, resolveAuthApiBaseUrl } from './modules/auth';

export function App() {
  const { t } = useTranslation();
  const [desktopStatus, setDesktopStatus] = useState<DesktopDeploymentStatus | null>(null);
  const [authenticatedUser, setAuthenticatedUser] = useState<PublicAuthUser | null>(null);

  useEffect(() => {
    let isMounted = true;

    void readDesktopDeploymentStatus()
      .then((status) => {
        if (isMounted) {
          setDesktopStatus(status);
        }
      })
      .catch(() => {
        if (isMounted) {
          setDesktopStatus({
            runtime: 'tauri',
            sidecarStatus: 'failed',
            databaseReady: false,
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const authApiBaseUrl = resolveAuthApiBaseUrl(desktopStatus);

  return (
    <main className="app-shell auth-app-shell">
      <section className="auth-layout">
        <aside className="auth-hero" aria-label={t('shell.brandPanelLabel')}>
          <header className="brand-lockup">
            <span className="brand-mark" aria-hidden="true">
              EA
            </span>
            <div>
              <h1>{APP_NAME}</h1>
              <p>{t('shell.brandSubtitle')}</p>
            </div>
          </header>

          <div className="hero-copy">
            <p className="eyebrow">{t('shell.eyebrow')}</p>
            <h2>{t('shell.heading')}</h2>
            <p>{t('shell.summary')}</p>
          </div>

          <div className="hero-accent" aria-hidden="true">
            <span />
            <span />
          </div>
        </aside>

        <section className="auth-form-area" aria-label={t('auth.loginPanelLabel')}>
          <LoginScreen
            apiBaseUrl={authApiBaseUrl}
            onAuthenticated={setAuthenticatedUser}
            user={authenticatedUser}
          />
          <p className="auth-footnote">{t('shell.footer')}</p>
        </section>
      </section>
    </main>
  );
}
