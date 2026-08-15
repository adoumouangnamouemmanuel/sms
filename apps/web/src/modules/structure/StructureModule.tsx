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
  const [draft, setDraft] = useState<SetupClassLevelInput[]>(() =>
    setupState.classLevels.map((level) => ({
      code: level.code,
      name: level.name,
      displayOrder: level.displayOrder,
      isExamYear: level.isExamYear,
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

  const updateLevel = (displayOrder: number, patch: Partial<SetupClassLevelInput>) => {
    setDraft((current) =>
      current.map((level) => (level.displayOrder === displayOrder ? { ...level, ...patch } : level))
    );
  };

  const removeLevel = (displayOrder: number) => {
    setDraft((current) =>
      current
        .filter((level) => level.displayOrder !== displayOrder)
        .map((level, index) => ({ ...level, displayOrder: index + 1 }))
    );
  };

  const addLevel = () => {
    setDraft((current) => [
      ...current,
      {
        code: `LVL-${String(current.length + 1).padStart(2, '0')}`,
        name: '',
        displayOrder: current.length + 1,
        isExamYear: false,
      },
    ]);
  };
  const handleSave = async () => {
    if (!apiBaseUrl && !client) {
      setErrorKey('structure.errors.localService');
      return;
    }

    const valid = draft.filter((level) => level.name.trim().length >= 2);
    if (valid.length === 0) {
      setErrorKey('structure.errors.empty');
      return;
    }

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
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-950">
          {t('structure.title')}
        </h1>
        <p className="mt-1 text-[13px] font-semibold text-slate-500">{t('structure.subtitle')}</p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-bold text-red-700">
          {t(errorKey)}
        </p>
      ) : null}

      {/* Niveaux editor — real data, editable */}
      <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-[13px] font-black uppercase tracking-wide text-slate-800">
            {t('structure.levels.title')}
          </h2>
          {!isEditing && (
            <button
              className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[12px] font-bold text-slate-600 transition hover:border-teal-300 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
              onClick={() => {
                setErrorKey(null);
                setIsEditing(true);
              }}
              type="button"
            >
              {t('structure.levels.edit')}
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-3">
            {draft.map((level, index) => (
              <div
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-3"
                key={level.displayOrder}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-[12px] font-black text-slate-400 ring-1 ring-slate-200">
                  {level.displayOrder}
                </span>
                <input
                  aria-label={`${t('structure.levels.name')} ${String(level.displayOrder)}`}
                  className={`${formInputClassName} h-11 flex-1 min-w-[160px]`}
                  onChange={(event) => {
                    updateLevel(level.displayOrder, { name: event.target.value });
                  }}
                  placeholder={t('structure.levels.namePlaceholder')}
                  value={level.name}
                />
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    checked={level.isExamYear}
                    className="h-4 w-4 accent-teal-600"
                    onChange={(event) => {
                      updateLevel(level.displayOrder, { isExamYear: event.target.checked });
                    }}
                    type="checkbox"
                  />
                  <span className="text-[12px] font-bold text-slate-600">
                    {t('structure.levels.examYear')}
                  </span>
                </label>
                <button
                  aria-label={`${t('structure.levels.remove')} ${String(level.displayOrder)}`}
                  className="cursor-pointer rounded-lg px-2 py-1 text-[12px] font-bold text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                  onClick={() => {
                    removeLevel(level.displayOrder);
                  }}
                  type="button"
                >
                  ✕
                </button>
                {index === 0 ? null : null}
              </div>
            ))}

            <button
              className="cursor-pointer rounded-xl border border-dashed border-teal-300 bg-teal-50/50 px-3.5 py-2 text-[12px] font-bold text-teal-700 transition hover:bg-teal-50"
              onClick={addLevel}
              type="button"
            >
              + {t('structure.levels.add')}
            </button>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2 text-[13px] font-bold text-slate-500 hover:bg-slate-50"
                disabled={isSaving}
                onClick={() => {
                  setDraft(
                    setupState.classLevels.map((level) => ({
                      code: level.code,
                      name: level.name,
                      displayOrder: level.displayOrder,
                      isExamYear: level.isExamYear,
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
                className="cursor-pointer rounded-xl bg-teal-500 px-4 py-2 text-[13px] font-bold text-white transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-50"
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
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {realLevels.map((level) => (
              <li
                className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3"
                key={level.id}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[11px] font-black ${
                    level.isExamYear
                      ? 'bg-teal-100 text-teal-700'
                      : 'bg-white text-slate-400 ring-1 ring-slate-200'
                  }`}
                >
                  {level.displayOrder}
                </span>
                <span className="flex-1 text-[13px] font-bold text-slate-700">{level.name}</span>
                {level.isExamYear ? (
                  <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-teal-600 ring-1 ring-teal-200">
                    {t('structure.levels.examBadge')}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Classes preview — simulated */}
      <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-[13px] font-black uppercase tracking-wide text-slate-800">
            {t('structure.classes.title')}
          </h2>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-700">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            {t('structure.simulation')}
          </span>
        </div>
        <p className="mb-4 text-[12px] font-semibold text-slate-400">
          {t('structure.classes.hint')}
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {mockClasses.map((mockClass) => (
            <div
              className="rounded-2xl border border-slate-100 bg-gradient-to-b from-slate-50 to-white p-3.5"
              key={mockClass.id}
            >
              <p className="text-[13px] font-black text-slate-800">{mockClass.label}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-400">
                {t('structure.classes.effectif', { count: mockClass.students })}
              </p>
            </div>
          ))}
        </div>
      </section>

      {saved && (
        <p className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-[13px] font-bold text-teal-700">
          {t('structure.saved')}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

const SUMMARY_TONES = {
  teal: 'from-teal-500 to-teal-600',
  indigo: 'from-indigo-500 to-indigo-600',
  sky: 'from-sky-500 to-sky-600',
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
  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${SUMMARY_TONES[tone]}`} />
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
        {label}
        {simulated ? ` · ${t('structure.simulation')}` : ''}
      </p>
      <p className="mt-2 text-3xl font-black tabular-nums tracking-tight text-slate-950">{value}</p>
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
