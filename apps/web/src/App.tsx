import { APP_NAME } from '@edutrack/shared';
import { StatusBadge } from '@edutrack/ui';
import { useTranslation } from 'react-i18next';

export function App() {
  const { t } = useTranslation();

  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="shell-header">
          <div>
            <p className="eyebrow">{t('shell.phase')}</p>
            <h1>{APP_NAME}</h1>
          </div>
          <StatusBadge tone="success">{t('shell.status')}</StatusBadge>
        </header>

        <div className="shell-grid">
          <div className="intro-panel">
            <h2>{t('shell.heading')}</h2>
            <p>{t('shell.summary')}</p>
          </div>

          <div className="status-panel" aria-label={t('shell.statusPanelLabel')}>
            <div className="status-row">
              <span>{t('shell.qualityLabel')}</span>
              <StatusBadge tone="success">{t('shell.quality')}</StatusBadge>
            </div>
            <div className="status-row">
              <span>{t('shell.storageLabel')}</span>
              <StatusBadge>{t('shell.sqlite')}</StatusBadge>
            </div>
            <div className="status-row">
              <span>{t('shell.networkLabel')}</span>
              <StatusBadge tone="warning">{t('shell.offline')}</StatusBadge>
            </div>
          </div>
        </div>

        <footer>{t('shell.footer')}</footer>
      </section>
    </main>
  );
}
