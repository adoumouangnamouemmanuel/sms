import type {
  SetupClassLevelInput,
  SetupClassLevelsRequest,
  SetupStateResponse,
} from '@edutrack/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formInputClassName } from '../people/ui';
import { saveSetupClassLevels } from '../setup/setupApi';
import { resolveSetupErrorMessageKey } from '../setup/setupErrors';
import { buildMockClasses } from './structureMock';

export interface StructureClient {
  saveClassLevels: (input: SetupClassLevelsRequest) => Promise<SetupStateResponse>;
}

export interface StructureModuleProps {
  apiBaseUrl: string | null;
  capabilityToken?: string;
  client?: StructureClient;
  setupState: SetupStateResponse;
  onSetupStateChange?: (state: SetupStateResponse) => void;
  onSessionExpired?: () => void;
}

export function StructureModule({
  apiBaseUrl,
  capabilityToken,
  client,
  setupState,
  onSetupStateChange,
  onSessionExpired,
}: StructureModuleProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<(SetupClassLevelInput & { rowId: string })[]>(() =>
    setupState.classLevels.map((level) => ({
      code: level.code,
      name: level.name,
      displayOrder: level.displayOrder,
      isExamYear: level.isExamYear,
      rowId: level.id, // safe to use DB id for existing rows
    }))
  );
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const realLevels = setupState.classLevels;
  const mockClasses = realLevels.flatMap((level) =>
    buildMockClasses(level.id, level.name).map((mockClass) => ({
      ...mockClass,
      levelName: level.name,
    }))
  );

  const updateLevel = (rowId: string, patch: Partial<SetupClassLevelInput>) => {
    setDraft((current) =>
      current.map((level) => (level.rowId === rowId ? { ...level, ...patch } : level))
    );
  };

  const removeLevel = (rowId: string) => {
    setDraft((current) => current.filter((level) => level.rowId !== rowId));
  };

  const addLevel = () => {
    setDraft((current) => [
      ...current,
      {
        code: `LVL-${String(current.length + 1).padStart(2, '0')}`,
        name: '',
        displayOrder: 0, // Ignored; derived on save
        isExamYear: false,
        rowId: crypto.randomUUID(),
      },
    ]);
  };
  const handleSave = async () => {
    if (!apiBaseUrl && !client) {
      setErrorKey('structure.errors.localService');
      return;
    }

    const hasInvalid = draft.some((level) => level.name.trim().length < 2);
    if (hasInvalid || draft.length === 0) {
      setErrorKey('structure.errors.invalidRows');
      return;
    }

    const valid = draft.map((level, index) => ({
      code: level.code,
      name: level.name.trim(),
      displayOrder: index + 1,
      isExamYear: level.isExamYear,
    }));

    setIsSaving(true);
    setErrorKey(null);
    setSaved(false);

    try {
      const nextState = client
        ? await client.saveClassLevels({ classLevels: valid })
        : await saveSetupClassLevels(
            apiBaseUrl ?? '',
            { classLevels: valid },
            {
              ...(capabilityToken ? { capabilityToken } : {}),
            }
          );

      onSetupStateChange?.(nextState);
      setDraft(
        nextState.classLevels.map((level) => ({
          code: level.code,
          name: level.name,
          displayOrder: level.displayOrder,
          isExamYear: level.isExamYear,
          rowId: level.id,
        }))
      );
      setIsEditing(false);
      setSaved(true);
    } catch (error) {
      if (isInvalidAccessToken(error)) {
        onSessionExpired?.();
        return;
      }

      setErrorKey(resolveSetupErrorMessageKey(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
          {t('structure.title')}
        </h1>
        <p className="text-sm font-semibold leading-relaxed text-slate-500">
          {t('structure.subtitle')}
        </p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <SummaryCard label={t('structure.summary.levels')} tone="teal" value={realLevels.length} />
        <SummaryCard
          label={t('structure.summary.classes')}
          tone="indigo"
          value={mockClasses.length}
          simulated
        />
        <SummaryCard
          label={t('structure.summary.students')}
          tone="sky"
          value={mockClasses.reduce((sum, mockClass) => sum + mockClass.students, 0)}
          simulated
        />
      </div>

      {errorKey ? (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700 shadow-sm">
          <svg
            className="h-5 w-5 shrink-0 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          {t(errorKey)}
        </div>
      ) : null}

      {/* Niveaux editor — real data, editable */}
      <section className="flex flex-col rounded-[32px] border border-slate-200/60 bg-white p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] lg:p-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-base font-black tracking-tight text-slate-900">
            {t('structure.levels.title')}
          </h2>
          {!isEditing && (
            <button
              className="group relative inline-flex cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-slate-200/80 bg-white px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-teal-300 hover:text-teal-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
              onClick={() => {
                setErrorKey(null);
                setIsEditing(true);
              }}
              type="button"
            >
              <span className="relative z-10">{t('structure.levels.edit')}</span>
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-4">
            {draft.map((level, index) => (
              <div
                className="group flex flex-wrap items-center gap-4 rounded-3xl border border-slate-200/60 bg-slate-50/50 p-4 transition-all hover:border-slate-300/80 hover:bg-slate-50"
                key={level.rowId}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[13px] font-black text-slate-400 shadow-sm ring-1 ring-slate-200/80">
                  {index + 1}
                </div>
                <input
                  aria-label={`${t('structure.levels.name')} ${String(index + 1)}`}
                  className={`${formInputClassName} h-12 flex-1 min-w-[160px] rounded-2xl border-slate-200/80 bg-white text-sm font-bold placeholder:text-slate-400 focus:border-teal-500 focus:ring-teal-500`}
                  onChange={(event) => {
                    updateLevel(level.rowId, { name: event.target.value });
                  }}
                  placeholder={t('structure.levels.namePlaceholder')}
                  value={level.name}
                />
                <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200/60 bg-white px-4 py-2.5 shadow-sm transition-colors hover:bg-slate-50">
                  <input
                    checked={level.isExamYear}
                    className="h-4 w-4 cursor-pointer rounded text-teal-600 focus:ring-teal-500"
                    onChange={(event) => {
                      updateLevel(level.rowId, { isExamYear: event.target.checked });
                    }}
                    type="checkbox"
                  />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    {t('structure.levels.examYear')}
                  </span>
                </label>
                <button
                  aria-label={`${t('structure.levels.remove')} ${String(index + 1)}`}
                  className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  onClick={() => {
                    removeLevel(level.rowId);
                  }}
                  type="button"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                {index === 0 ? null : null}
              </div>
            ))}

            <div className="pt-2">
              <button
                className="group flex w-full cursor-pointer items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-teal-200 bg-teal-50/50 py-5 text-sm font-bold text-teal-700 transition-all hover:border-teal-300 hover:bg-teal-50"
                onClick={addLevel}
                type="button"
              >
                <svg
                  className="h-5 w-5 transition-transform group-hover:scale-110"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                {t('structure.levels.add')}
              </button>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-6">
              <button
                className="cursor-pointer rounded-2xl border border-slate-200/80 bg-white px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-50"
                disabled={isSaving}
                onClick={() => {
                  setDraft(
                    setupState.classLevels.map((level) => ({
                      code: level.code,
                      name: level.name,
                      displayOrder: level.displayOrder,
                      isExamYear: level.isExamYear,
                      rowId: level.id,
                    }))
                  );
                  setIsEditing(false);
                  setErrorKey(null);
                }}
                type="button"
              >
                {t('structure.cancel')}
              </button>
              <button
                className="cursor-pointer rounded-2xl bg-teal-500 px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-[0_0_20px_-5px_rgba(20,184,166,0.5)] transition-all hover:scale-105 hover:bg-teal-400 hover:shadow-[0_0_30px_-5px_rgba(20,184,166,0.6)] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSaving}
                onClick={() => {
                  void handleSave();
                }}
                type="button"
              >
                {isSaving ? t('structure.saving') : t('structure.save')}
              </button>
            </div>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {realLevels.map((level) => (
              <li
                className="group flex items-center gap-4 rounded-3xl border border-slate-200/60 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                key={level.id}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-[13px] font-black transition-colors ${
                    level.isExamYear
                      ? 'bg-teal-100 text-teal-700'
                      : 'bg-slate-50 text-slate-400 ring-1 ring-slate-200/80 group-hover:bg-slate-100'
                  }`}
                >
                  {level.displayOrder}
                </div>
                <span className="flex-1 text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">
                  {level.name}
                </span>
                {level.isExamYear ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-teal-600 ring-1 ring-inset ring-teal-200/60">
                    <svg
                      className="h-3 w-3"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {t('structure.levels.examBadge')}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Classes preview — simulated */}
      <section className="flex flex-col rounded-[32px] border border-slate-200/60 bg-white p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] lg:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-base font-black tracking-tight text-slate-900">
            {t('structure.classes.title')}
          </h2>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/50 bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500"></span>
            </span>
            {t('structure.simulation')}
          </span>
        </div>
        <p className="mb-6 text-[13px] font-semibold leading-relaxed text-slate-400">
          {t('structure.classes.hint')}
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {mockClasses.map((mockClass) => (
            <div
              className="group relative overflow-hidden rounded-[24px] border border-slate-200/60 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_20px_-4px_rgba(0,0,0,0.08)]"
              key={mockClass.id}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-slate-50/80 to-white opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <p className="relative text-[15px] font-black tracking-tight text-slate-900">
                {mockClass.label}
              </p>
              <p className="relative mt-2 text-[12px] font-bold text-slate-400">
                {t('structure.classes.effectif', { count: mockClass.students })}
              </p>
            </div>
          ))}
        </div>
      </section>

      {saved && (
        <div className="flex items-center gap-3 rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm font-bold text-teal-700 shadow-sm">
          <svg
            className="h-5 w-5 shrink-0 text-teal-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {t('structure.saved')}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

const SUMMARY_TONES = {
  teal: {
    wrapper: 'hover:border-teal-200',
    glow: 'bg-teal-400',
    number: 'text-slate-900',
  },
  indigo: {
    wrapper: 'hover:border-indigo-200',
    glow: 'bg-indigo-400',
    number: 'text-slate-900',
  },
  sky: {
    wrapper: 'hover:border-sky-200',
    glow: 'bg-sky-400',
    number: 'text-slate-900',
  },
} as const;

function SummaryCard({
  label,
  simulated = false,
  tone,
  value,
}: {
  label: string;
  simulated?: boolean;
  tone: keyof typeof SUMMARY_TONES;
  value: number;
}) {
  const { t } = useTranslation();
  const palette = SUMMARY_TONES[tone];

  return (
    <div
      className={`group relative flex flex-col justify-between overflow-hidden rounded-[32px] border border-slate-200/60 bg-white p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)] ${palette.wrapper}`}
    >
      <div
        className={`absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-10 ${palette.glow}`}
      />

      <p className="relative flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400">
        {label}
        {simulated ? (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-600">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            {t('structure.simulation')}
          </span>
        ) : null}
      </p>

      <p
        className={`relative mt-8 text-[40px] font-black tabular-nums leading-none tracking-tighter ${palette.number}`}
      >
        {value}
      </p>
    </div>
  );
}

function isInvalidAccessToken(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'INVALID_ACCESS_TOKEN'
  );
}
