import { IMPORT_COLUMNS_BY_KIND, type ImportKind } from '@edutrack/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ModalShell } from '../people/ui';
import { useImportState, type ImportsClient } from './useImportState';

export interface ImportModalProps {
  apiBaseUrl: string | null;
  capabilityToken?: string;
  client?: ImportsClient;
  kind: ImportKind;
  onClose: () => void;
}

export function ImportModal({
  apiBaseUrl,
  capabilityToken,
  client,
  kind,
  onClose,
}: ImportModalProps) {
  const { t } = useTranslation();
  const module = useImportState({
    apiBaseUrl,
    ...(capabilityToken ? { capabilityToken } : {}),
    ...(client ? { client } : {}),
  });

  return (
    <ModalShell
      closeLabel={t('imports.close')}
      onClose={() => {
        module.reset();
        onClose();
      }}
      title={t(module.step === 'report' ? 'imports.report.title' : 'imports.title', {
        kind: t(`imports.kind.${kind}`),
      })}
    >
      {module.step === 'choose' ? (
        <ChooseStep
          isBusy={module.isBusy}
          onAnalyze={(file) => {
            void module.analyzeFile(kind, file);
          }}
          onDownloadTemplate={() => {
            void downloadBlobToFile(
              module.downloadTemplate(kind),
              `modele-${kind.toLowerCase()}.xlsx`
            );
          }}
        />
      ) : module.step === 'preview' && module.preview ? (
        <PreviewStep
          errorKey={module.errorKey}
          isBusy={module.isBusy}
          kind={kind}
          onConfirm={(identifier) => {
            void module.confirm(identifier);
          }}
          onDownloadErrors={() => {
            void downloadBlobToFile(module.downloadErrors(), 'lignes-en-erreur.csv');
          }}
          preview={module.preview}
        />
      ) : module.report ? (
        <ReportStep onClose={onClose} report={module.report} />
      ) : null}
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — choose a file
// ---------------------------------------------------------------------------

function ChooseStep({
  isBusy,
  onAnalyze,
  onDownloadTemplate,
}: {
  isBusy: boolean;
  onAnalyze: (file: File) => void;
  onDownloadTemplate: () => void;
}) {
  const { t } = useTranslation();
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  return (
    <div className="space-y-3">
      <p className="text-[13px] font-semibold leading-6 text-slate-500">
        {t('imports.choose.body')}
      </p>

      <button
        className="cursor-pointer rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-[12px] font-bold text-teal-700 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={isBusy}
        onClick={onDownloadTemplate}
        type="button"
      >
        {t('imports.choose.downloadTemplate')}
      </button>

      <label className="flex flex-col gap-2">
        <span className="text-[13px] font-bold text-slate-800">{t('imports.choose.file')}</span>
        <input
          accept=".xlsx"
          className="cursor-pointer rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] font-semibold text-slate-600 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-teal-500 file:px-3 file:py-1.5 file:text-[12px] file:font-bold file:text-white"
          disabled={isBusy}
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            setSelectedFile(file);
            setErrorKey(null);
          }}
          type="file"
        />
      </label>

      {errorKey ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700">
          {t(errorKey)}
        </p>
      ) : null}

      <div className="flex justify-end">
        <button
          className="cursor-pointer rounded-xl bg-teal-500 px-4 py-2 text-[13px] font-bold text-white hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isBusy || !selectedFile}
          onClick={() => {
            if (!selectedFile) {
              setErrorKey('imports.choose.fileRequired');
              return;
            }

            if (!selectedFile.name.toLowerCase().endsWith('.xlsx')) {
              setErrorKey('imports.choose.extensionRequired');
              return;
            }

            setErrorKey(null);
            onAnalyze(selectedFile);
          }}
          type="button"
        >
          {isBusy ? t('imports.choose.analyzing') : t('imports.choose.analyze')}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — preview and confirm
// ---------------------------------------------------------------------------

function PreviewStep({
  errorKey,
  isBusy,
  kind,
  onConfirm,
  onDownloadErrors,
  preview,
}: {
  errorKey: string | null;
  isBusy: boolean;
  kind: ImportKind;
  onConfirm: (importIdentifier: string) => void;
  onDownloadErrors: () => void;
  preview: NonNullable<ReturnType<typeof useImportState>['preview']>;
}) {
  const { t } = useTranslation();
  const [identifier, setIdentifier] = useState('');
  const columns = IMPORT_COLUMNS_BY_KIND[kind];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-700">
          {t('imports.preview.valid', { count: preview.validRows })}
        </span>
        <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-700">
          {t('imports.preview.errors', { count: preview.errorRows })}
        </span>
        <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
          {t('imports.preview.total', { count: preview.totalRows })}
        </span>
      </div>

      <div className="max-h-56 overflow-auto rounded-xl border border-slate-100">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70 text-left">
              <th className="px-2 py-1.5 text-[10px] font-black uppercase tracking-wide text-slate-400">
                {t('imports.preview.row')}
              </th>
              {columns.map((column) => (
                <th
                  className="px-2 py-1.5 text-[10px] font-black uppercase tracking-wide text-slate-400"
                  key={column.key}
                >
                  {column.label}
                </th>
              ))}
              <th className="px-2 py-1.5 text-[10px] font-black uppercase tracking-wide text-slate-400">
                {t('imports.preview.errorsColumn')}
              </th>
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row) => (
              <tr
                className={`border-b border-slate-50 ${row.errors.length > 0 ? 'bg-red-50/50' : ''}`}
                key={row.rowNumber}
              >
                <td className="px-2 py-1.5 text-[11px] font-bold text-slate-400">
                  {row.rowNumber}
                </td>
                {columns.map((column) => (
                  <td
                    className="px-2 py-1.5 text-[12px] font-semibold text-slate-700"
                    key={column.key}
                  >
                    {row.values[column.key] ?? '—'}
                  </td>
                ))}
                <td className="px-2 py-1.5">
                  {row.errors.length > 0 ? (
                    <span className="text-[11px] font-bold leading-snug text-red-600">
                      {row.errors.join(' · ')}
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-teal-600">
                      {t('imports.preview.ok')}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {preview.errorRows > 0 ? (
        <button
          className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-bold text-slate-600 hover:border-teal-300 hover:text-teal-700"
          onClick={onDownloadErrors}
          type="button"
        >
          {t('imports.preview.downloadErrors')}
        </button>
      ) : null}

      <label className="flex flex-col gap-2">
        <span className="text-[13px] font-bold text-slate-800">
          {t('imports.confirm.identifier')}
        </span>
        <input
          className="h-[50px] w-full cursor-text rounded-2xl border border-slate-200 bg-slate-50 px-4 text-[14px] font-medium text-slate-900 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] outline-none transition-all placeholder:font-medium placeholder:text-slate-400 hover:border-slate-300 focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-600/10"
          onChange={(event) => {
            setIdentifier(event.target.value);
          }}
          placeholder={t('imports.confirm.identifierPlaceholder')}
          type="text"
          value={identifier}
        />
        <p className="text-[11px] font-semibold text-slate-400">
          {t('imports.confirm.identifierHint')}
        </p>
      </label>

      {errorKey ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700">
          {t(errorKey)}
        </p>
      ) : null}

      <div className="flex justify-end">
        <button
          className="cursor-pointer rounded-xl bg-teal-500 px-4 py-2 text-[13px] font-bold text-white hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isBusy || !identifier.trim()}
          onClick={() => {
            onConfirm(identifier);
          }}
          type="button"
        >
          {isBusy ? t('imports.confirm.confirming') : t('imports.confirm.submit')}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — report
// ---------------------------------------------------------------------------

function ReportStep({
  onClose,
  report,
}: {
  onClose: () => void;
  report: NonNullable<ReturnType<typeof useImportState>['report']>;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      {report.alreadyConfirmed ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-bold text-amber-700">
          {t('imports.report.alreadyConfirmed')}
        </p>
      ) : null}

      <div className="grid grid-cols-3 gap-2">
        <ReportCount label={t('imports.report.imported')} tone="teal" value={report.imported} />
        <ReportCount
          label={t('imports.report.skipped')}
          tone="slate"
          value={report.skippedExisting}
        />
        <ReportCount label={t('imports.report.errors')} tone="red" value={report.errorRows} />
      </div>

      <p className="font-mono text-[12px] font-bold text-slate-400">
        {t('imports.report.identifier', { identifier: report.importIdentifier })}
      </p>

      <div className="flex justify-end">
        <button
          className="cursor-pointer rounded-xl bg-teal-500 px-4 py-2 text-[13px] font-bold text-white hover:bg-teal-400"
          onClick={onClose}
          type="button"
        >
          {t('imports.close')}
        </button>
      </div>
    </div>
  );
}

function ReportCount({
  label,
  tone,
  value,
}: {
  label: string;
  tone: 'teal' | 'slate' | 'red';
  value: number;
}) {
  const toneClasses =
    tone === 'teal'
      ? 'border-teal-200 bg-teal-50 text-teal-700'
      : tone === 'red'
        ? 'border-red-200 bg-red-50 text-red-700'
        : 'border-slate-200 bg-slate-50 text-slate-600';

  return (
    <div className={`rounded-xl border px-3 py-2 text-center ${toneClasses}`}>
      <p className="text-lg font-black leading-tight">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wide">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function downloadBlobToFile(blobPromise: Promise<Blob | null>, filename: string) {
  const blob = await blobPromise;

  if (!blob) {
    return;
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
