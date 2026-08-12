import { APP_NAME } from '@edutrack/shared';
import { StatusBadge } from '@edutrack/ui';
import { useTranslation } from 'react-i18next';

export function App() {
  const { t } = useTranslation();

  return (
    <main className="min-h-screen bg-stone-50 text-slate-950">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-between px-6 py-8 sm:px-10 lg:px-12">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-normal">{APP_NAME}</h1>
          <StatusBadge tone="success">{t('shell.status')}</StatusBadge>
        </header>

        <div className="grid gap-8 py-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-normal text-emerald-800">
              {t('shell.phase')}
            </p>
            <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-normal text-slate-950 sm:text-5xl">
              {t('shell.heading')}
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-700">{t('shell.summary')}</p>
          </div>

          <div className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <StatusBadge>{t('shell.quality')}</StatusBadge>
            <StatusBadge>{t('shell.sqlite')}</StatusBadge>
            <StatusBadge tone="warning">{t('shell.offline')}</StatusBadge>
          </div>
        </div>

        <footer className="border-t border-slate-200 pt-5 text-sm text-slate-600">
          {t('shell.footer')}
        </footer>
      </section>
    </main>
  );
}
