import { APP_NAME, type PublicAuthUser } from '@edutrack/shared';
import { StatusBadge } from '@edutrack/ui';
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

  const isDesktopReady = desktopStatus?.sidecarStatus === 'ready' && desktopStatus.databaseReady;
  const authApiBaseUrl = resolveAuthApiBaseUrl(desktopStatus);

  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="shell-header">
          <div>
            <p className="eyebrow">{t('shell.phase')}</p>
            <h1>{APP_NAME}</h1>
          </div>
          <StatusBadge tone={authenticatedUser ? 'success' : 'warning'}>
            {authenticatedUser ? t('auth.sessionActive') : t('shell.status')}
          </StatusBadge>
        </header>

        <div className="shell-grid shell-grid--auth">
          <div className="intro-panel">
            <h2>{t('shell.heading')}</h2>
            <p>{t('shell.summary')}</p>
          </div>

          <div className="auth-stack">
            <LoginScreen
              apiBaseUrl={authApiBaseUrl}
              onAuthenticated={setAuthenticatedUser}
              user={authenticatedUser}
            />

            <div className="status-panel" aria-label={t('shell.statusPanelLabel')}>
              <div className="status-row">
                <span>{t('shell.storageLabel')}</span>
                <StatusBadge>{t('shell.sqlite')}</StatusBadge>
              </div>
              <div className="status-row">
                <span>{t('shell.desktopLabel')}</span>
                <StatusBadge tone={isDesktopReady ? 'success' : 'warning'}>
                  {desktopStatus
                    ? t(`shell.desktop.${desktopStatus.sidecarStatus}`)
                    : t('shell.browser')}
                </StatusBadge>
              </div>
              <div className="status-row">
                <span>{t('shell.networkLabel')}</span>
                <StatusBadge tone="warning">{t('shell.offline')}</StatusBadge>
              </div>
            </div>
          </div>
        </div>

        <footer>{t('shell.footer')}</footer>
      </section>
    </main>
  );
}
