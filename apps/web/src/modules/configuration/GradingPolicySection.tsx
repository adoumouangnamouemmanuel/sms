import { evaluatePolicy } from '@edutrack/domain';
import {
  GRADING_POLICY_TEMPLATES,
  type AssessmentTypeInput,
  type DerivedResultInput,
  type GradingPoliciesResponse,
  type GradingPolicyConfig,
  type GradingPolicyDetailResponse,
  type PolicyScopeAssignment,
  type PolicyScopeType,
  type RoundingMode,
} from '@edutrack/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formInputClassName, formSelectClassName, ModalShell } from '../people/ui';
import { DecimalField } from './DecimalField';
import { ConfigurationApiError, resolveConfigurationErrorMessageKey } from './configurationApi';
import {
  formatHundredths,
  parseDecimalToHundredths,
  parseWeightToHundredths,
} from './gradingFormat';

/** Test seam: replaces the network client for component tests. */
export interface GradingPolicyClient {
  list?: () => Promise<GradingPoliciesResponse>;
  /** Full document fetch for one policy (the real API has this endpoint). */
  get?: (policyId: string) => Promise<GradingPolicyDetailResponse>;
  create?: (config: GradingPolicyConfig) => Promise<GradingPolicyDetailResponse>;
  update?: (policyId: string, config: GradingPolicyConfig) => Promise<GradingPolicyDetailResponse>;
  publish?: (policyId: string) => Promise<GradingPolicyDetailResponse>;
  duplicate?: (policyId: string) => Promise<GradingPolicyDetailResponse>;
  assignScopes?: (
    policyId: string,
    scopes: PolicyScopeAssignment[]
  ) => Promise<GradingPolicyDetailResponse>;
}

export interface GradingPolicySectionProps {
  apiBaseUrl: string | null;
  capabilityToken?: string;
  client?: GradingPolicyClient;
  /** Read-only mode for teachers (writes hidden, resolution shown). */
  readOnly?: boolean;
  onSessionExpired?: () => void;
}

interface PolicySummary {
  id: string;
  name: string;
  version: number;
  status: 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED';
  scaleMax: number;
  passThreshold: number;
}

export function GradingPolicySection({
  apiBaseUrl,
  capabilityToken,
  client,
  readOnly = false,
  onSessionExpired,
}: GradingPolicySectionProps) {
  const { t } = useTranslation();
  const [policies, setPolicies] = useState<GradingPoliciesResponse | null>(null);
  const [selected, setSelected] = useState<GradingPolicyDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);

  const onSessionExpiredRef = useRef(onSessionExpired);
  useEffect(() => {
    onSessionExpiredRef.current = onSessionExpired;
  }, [onSessionExpired]);

  const requestOptions = useCallback(
    () => ({ ...(capabilityToken ? { capabilityToken } : {}) }),
    [capabilityToken]
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    setErrorKey(null);

    try {
      const list = client?.list
        ? await client.list()
        : await fetchList(apiBaseUrl ?? '', requestOptions());
      setPolicies(list);

      // Keep the selection in sync after a refresh.
      setSelected((current) => {
        if (!current) {
          return null;
        }
        const stillThere = list.policies.find((policy) => policy.id === current.policy.id);
        return stillThere ? current : null;
      });
    } catch (error) {
      if (isInvalidAccessToken(error)) {
        onSessionExpiredRef.current?.();
        return;
      }
      setErrorKey(resolveConfigurationErrorMessageKey(error));
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, client, requestOptions]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load();
    }, 0);

    return () => {
      window.clearTimeout(handle);
    };
  }, [load]);

  const openPolicy = async (policyId: string) => {
    setErrorKey(null);
    try {
      const detail = client?.get
        ? await client.get(policyId)
        : await fetchPolicyDetail(apiBaseUrl ?? '', policyId, requestOptions());
      setSelected(detail);
    } catch (error) {
      setErrorKey(resolveConfigurationErrorMessageKey(error));
    }
  };

  const handleCreated = (detail: GradingPolicyDetailResponse) => {
    setSelected(detail);
    setTemplateOpen(false);
    void load();
  };

  const handleUpdated = (detail: GradingPolicyDetailResponse) => {
    setSelected(detail);
    void load();
  };

  const summaries: PolicySummary[] = policies?.policies ?? [];

  return (
    <section
      aria-labelledby="configuration-grading-title"
      className="rounded-[32px] border border-slate-200/70 bg-white p-6 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] lg:p-8"
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 ring-1 ring-inset ring-teal-100/50">
            <GaugeIcon />
          </div>
          <div>
            <h2
              className="text-base font-black tracking-tight text-slate-900"
              id="configuration-grading-title"
            >
              {t('configuration.grading.title')}
            </h2>
            <p className="mt-1 text-[12px] font-semibold text-slate-400">
              {t('configuration.grading.hint')}
            </p>
          </div>
        </div>
        {!readOnly ? (
          <button
            className="cursor-pointer rounded-2xl bg-teal-500 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-[0_0_20px_-5px_rgba(20,184,166,0.5)] transition-all hover:scale-105 hover:bg-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
            onClick={() => {
              setTemplateOpen(true);
            }}
            type="button"
          >
            {t('configuration.grading.new')}
          </button>
        ) : null}
      </div>

      {isLoading ? (
        <div aria-live="polite" className="flex h-32 items-center justify-center" role="status">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-teal-200 border-t-teal-600" />
        </div>
      ) : errorKey ? (
        <div
          aria-live="polite"
          className="flex items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 p-4"
          role="alert"
        >
          <p className="text-sm font-bold text-red-700">{t(errorKey)}</p>
          <button
            className="cursor-pointer rounded-xl bg-red-600 px-4 py-2 text-xs font-black text-white hover:bg-red-700"
            onClick={() => void load()}
            type="button"
          >
            {t('configuration.retry')}
          </button>
        </div>
      ) : summaries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-10 text-center">
          <p className="text-sm font-black text-slate-600">{t('configuration.grading.empty')}</p>
          {!readOnly ? (
            <button
              className="mt-4 cursor-pointer rounded-2xl bg-teal-500 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-teal-400"
              onClick={() => {
                setTemplateOpen(true);
              }}
              type="button"
            >
              {t('configuration.grading.emptyCta')}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
          <PolicyList
            onOpen={(policyId) => void openPolicy(policyId)}
            policies={summaries}
            {...(selected ? { selectedId: selected.policy.id } : {})}
            scopes={policies?.scopes ?? []}
          />
          {selected ? (
            <GradingPolicyEditor
              apiBaseUrl={apiBaseUrl}
              {...(capabilityToken ? { capabilityToken } : {})}
              {...(client ? { client } : {})}
              detail={selected}
              onCreated={handleCreated}
              onSessionExpired={() => onSessionExpiredRef.current?.()}
              onUpdated={handleUpdated}
              readOnly={readOnly}
            />
          ) : (
            <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-slate-200 text-sm font-bold text-slate-400">
              {t('configuration.grading.select')}
            </div>
          )}
        </div>
      )}

      {templateOpen ? (
        <TemplateModal
          apiBaseUrl={apiBaseUrl}
          {...(capabilityToken ? { capabilityToken } : {})}
          {...(client ? { client } : {})}
          onClose={() => {
            setTemplateOpen(false);
          }}
          onCreated={handleCreated}
          onSessionExpired={() => onSessionExpiredRef.current?.()}
        />
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Policy list
// ---------------------------------------------------------------------------

function PolicyList({
  onOpen,
  policies,
  selectedId,
  scopes,
}: {
  onOpen: (policyId: string) => void;
  policies: PolicySummary[];
  selectedId?: string;
  scopes: { policyId: string; scopeType: PolicyScopeType }[];
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      {policies.map((policy) => {
        const scopeCount = scopes.filter((scope) => scope.policyId === policy.id).length;
        const isSelected = policy.id === selectedId;

        return (
          <button
            className={`w-full cursor-pointer rounded-2xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${
              isSelected
                ? 'border-teal-400 bg-teal-50/60 shadow-sm'
                : 'border-slate-200/70 bg-white hover:border-teal-300'
            }`}
            key={policy.id}
            onClick={() => {
              onOpen(policy.id);
            }}
            type="button"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[13px] font-black text-slate-800">{policy.name}</p>
              <StatusPill status={policy.status} />
            </div>
            <p className="mt-1 text-[11px] font-bold text-slate-400">
              {t('configuration.grading.version', { version: String(policy.version) })} ·{' '}
              {t('configuration.grading.scopeCount', { count: String(scopeCount) })}
            </p>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editor (basics, types, derived, subject result, sandbox, scopes)
// ---------------------------------------------------------------------------

function GradingPolicyEditor({
  apiBaseUrl,
  capabilityToken,
  client,
  detail,
  onCreated,
  onSessionExpired,
  onUpdated,
  readOnly,
}: {
  apiBaseUrl: string | null;
  capabilityToken?: string;
  client?: GradingPolicyClient;
  detail: GradingPolicyDetailResponse;
  onCreated: (detail: GradingPolicyDetailResponse) => void;
  onSessionExpired: () => void;
  onUpdated: (detail: GradingPolicyDetailResponse) => void;
  readOnly: boolean;
}) {
  const { t } = useTranslation();
  const [config, setConfig] = useState<GradingPolicyConfig>(() => ({
    ...detail.policy,
    name: detail.policy.name,
    scaleMax: detail.policy.scaleMax,
    passThreshold: detail.policy.passThreshold,
    decimalPrecision: detail.policy.decimalPrecision,
    roundingMode: detail.policy.roundingMode,
    effectiveAcademicYearId: detail.policy.effectiveAcademicYearId,
    assessmentTypes: detail.policy.assessmentTypes,
    derivedResults: detail.policy.derivedResults,
    subjectResult: detail.policy.subjectResult,
  }));
  const [scopes, setScopes] = useState<PolicyScopeAssignment[]>(() =>
    detail.scopes.map((scope) => ({
      scopeType: scope.scopeType,
      levelId: scope.levelId,
      subjectId: scope.subjectId,
    }))
  );
  const [isSaving, setIsSaving] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const isPublished = detail.policy.status !== 'DRAFT';

  const updateConfig = (patch: Partial<GradingPolicyConfig>) => {
    setConfig((current) => ({ ...current, ...patch }));
    setSaved(false);
  };

  const handleSave = async () => {
    if (readOnly || isPublished) {
      return;
    }
    setIsSaving(true);
    setErrorKey(null);
    setFieldErrors({});
    setSaved(false);

    try {
      const result = client?.update
        ? await client.update(detail.policy.id, config)
        : client?.create
          ? await client.create(config)
          : await saveViaApi(
              detail.policy.status === 'DRAFT' ? 'update' : 'create',
              apiBaseUrl,
              detail.policy.id,
              config,
              capabilityToken
            );
      onUpdated(result);
      setSaved(true);
    } catch (error) {
      if (isInvalidAccessToken(error)) {
        onSessionExpired();
        return;
      }
      setErrorKey(resolveConfigurationErrorMessageKey(error));
      setFieldErrors(extractFieldErrors(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (readOnly || isPublished) {
      return;
    }
    setIsSaving(true);
    setErrorKey(null);
    setFieldErrors({});

    try {
      const result = client?.publish
        ? await client.publish(detail.policy.id)
        : await publishViaApi(apiBaseUrl, detail.policy.id, capabilityToken);
      onUpdated(result);
      setSaved(true);
    } catch (error) {
      if (isInvalidAccessToken(error)) {
        onSessionExpired();
        return;
      }
      setErrorKey(resolveConfigurationErrorMessageKey(error));
      setFieldErrors(extractFieldErrors(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDuplicate = async () => {
    if (readOnly) {
      return;
    }
    setIsSaving(true);
    setErrorKey(null);

    try {
      const result = client?.duplicate
        ? await client.duplicate(detail.policy.id)
        : await duplicateViaApi(apiBaseUrl, detail.policy.id, capabilityToken);
      onCreated(result);
    } catch (error) {
      if (isInvalidAccessToken(error)) {
        onSessionExpired();
        return;
      }
      setErrorKey(resolveConfigurationErrorMessageKey(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveScopes = async () => {
    if (readOnly || isPublished) {
      return;
    }
    setIsSaving(true);
    setErrorKey(null);

    try {
      const result = client?.assignScopes
        ? await client.assignScopes(detail.policy.id, scopes)
        : await assignScopesViaApi(apiBaseUrl, detail.policy.id, scopes, capabilityToken);
      onUpdated(result);
      setSaved(true);
    } catch (error) {
      if (isInvalidAccessToken(error)) {
        onSessionExpired();
        return;
      }
      setErrorKey(resolveConfigurationErrorMessageKey(error));
    } finally {
      setIsSaving(false);
    }
  };

  const totalWeight = config.subjectResult.inputs.reduce((sum, input) => sum + input.weight, 0);
  const weightOk = totalWeight === 10000;
  const validationIssues = collectValidationIssues(config);

  return (
    <div className="min-w-0 space-y-5">
      {saved ? (
        <div className="flex items-center gap-3 rounded-2xl border border-teal-200 bg-teal-50 p-4 text-sm font-bold text-teal-700">
          ✓ {t('configuration.grading.saved')}
        </div>
      ) : null}

      {errorKey ? (
        <div
          aria-live="polite"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700"
          role="alert"
        >
          {t(errorKey)}
          {Object.values(fieldErrors).length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs font-semibold">
              {Object.entries(fieldErrors).map(([code, message]) => (
                <li key={code}>• {message}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {isPublished ? (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm font-bold text-indigo-700">
          {t('configuration.grading.publishedNote')}
        </div>
      ) : null}

      {/* Basics */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('configuration.grading.name')}>
          <input
            className={formInputClassName}
            disabled={readOnly || isPublished}
            onChange={(event) => {
              updateConfig({ name: event.target.value });
            }}
            value={config.name}
          />
        </Field>
        <Field label={t('configuration.grading.scaleMax')}>
          <input
            className={formInputClassName}
            disabled={readOnly || isPublished}
            min={1}
            max={100}
            onChange={(event) => {
              const value = Number.parseInt(event.target.value, 10);
              const nextScale = Number.isFinite(value) ? value : 20;
              // One barème for the whole policy: changing it keeps every
              // assessment type on the same scale (design §12).
              updateConfig({
                scaleMax: nextScale,
                assessmentTypes: config.assessmentTypes.map((type) => ({
                  ...type,
                  scaleMax: nextScale,
                })),
              });
            }}
            type="number"
            value={config.scaleMax}
          />
          <span className="text-[11px] font-semibold text-slate-400">
            {t('configuration.grading.scaleMaxHint')}
          </span>
        </Field>
        <Field label={t('configuration.grading.passThreshold')}>
          <DecimalField
            className={formInputClassName}
            disabled={readOnly || isPublished}
            onChange={(hundredths) => {
              updateConfig({ passThreshold: hundredths });
            }}
            scaleMax={config.scaleMax}
            value={config.passThreshold}
          />
        </Field>
        <Field label={t('configuration.grading.rounding')}>
          <select
            className={formSelectClassName}
            disabled={readOnly || isPublished}
            onChange={(event) => {
              updateConfig({ roundingMode: event.target.value as RoundingMode });
            }}
            value={config.roundingMode}
          >
            <option value="HALF_UP">{t('configuration.grading.roundingHalfUp')}</option>
            <option value="TRUNCATE">{t('configuration.grading.roundingTruncate')}</option>
          </select>
          <span className="text-[11px] font-semibold text-slate-400">
            {t(
              config.roundingMode === 'HALF_UP'
                ? 'configuration.grading.roundingHalfUpHint'
                : 'configuration.grading.roundingTruncateHint'
            )}
          </span>
        </Field>
      </div>

      {/* Assessment types */}
      <EditorCard title={t('configuration.grading.typesTitle')}>
        <div className="space-y-3">
          {config.assessmentTypes.map((type, index) => (
            <AssessmentTypeRow
              disabled={readOnly || isPublished}
              key={type.id ?? index}
              onChange={(next) => {
                const assessmentTypes = [...config.assessmentTypes];
                assessmentTypes[index] = next;
                updateConfig({ assessmentTypes });
              }}
              onRemove={() => {
                const assessmentTypes = config.assessmentTypes.filter(
                  (_, itemIndex) => itemIndex !== index
                );
                updateConfig({ assessmentTypes });
              }}
              type={type}
            />
          ))}
          {!readOnly && !isPublished ? (
            <button
              className="cursor-pointer rounded-2xl border border-dashed border-teal-300 px-4 py-2.5 text-xs font-bold text-teal-700 transition-colors hover:bg-teal-50"
              onClick={() => {
                updateConfig({
                  assessmentTypes: [
                    ...config.assessmentTypes,
                    {
                      id: crypto.randomUUID(),
                      name: '',
                      shortName: '',
                      scaleMax: config.scaleMax,
                      occurrenceMode: 'REPEATABLE',
                      minOccurrences: 1,
                      maxOccurrences: 4,
                      required: true,
                      teacherCanCreateInstances: true,
                      displayOrder: config.assessmentTypes.length + 1,
                    },
                  ],
                });
              }}
              type="button"
            >
              + {t('configuration.grading.addType')}
            </button>
          ) : null}
        </div>
      </EditorCard>

      {/* Derived results */}
      <EditorCard title={t('configuration.grading.derivedTitle')}>
        <div className="space-y-3">
          {config.derivedResults.length === 0 ? (
            <p className="text-xs font-bold text-slate-400">
              {t('configuration.grading.derivedEmpty')}
            </p>
          ) : null}
          {config.derivedResults.map((derived, index) => (
            <DerivedResultRow
              disabled={readOnly || isPublished}
              key={derived.id ?? index}
              onChange={(next) => {
                const derivedResults = [...config.derivedResults];
                derivedResults[index] = next;
                updateConfig({ derivedResults });
              }}
              onRemove={() => {
                const derivedResults = config.derivedResults.filter(
                  (_, itemIndex) => itemIndex !== index
                );
                updateConfig({ derivedResults });
              }}
              derived={derived}
              typeIds={config.assessmentTypes
                .map((type) => type.id)
                .filter((id): id is string => Boolean(id))}
              typeNames={config.assessmentTypes}
            />
          ))}
          {!readOnly && !isPublished ? (
            <button
              className="cursor-pointer rounded-2xl border border-dashed border-teal-300 px-4 py-2.5 text-xs font-bold text-teal-700 transition-colors hover:bg-teal-50"
              onClick={() => {
                updateConfig({
                  derivedResults: [
                    ...config.derivedResults,
                    {
                      id: crypto.randomUUID(),
                      name: '',
                      shortName: '',
                      operation: 'MEAN',
                      sourceDefinitionIds: [],
                      precision: config.decimalPrecision,
                      roundingMode: config.roundingMode,
                      displayOrder: config.derivedResults.length + 1,
                    },
                  ],
                });
              }}
              type="button"
            >
              + {t('configuration.grading.addDerived')}
            </button>
          ) : null}
        </div>
      </EditorCard>

      {/* Subject result */}
      <EditorCard title={t('configuration.grading.subjectTitle')}>
        <div className="space-y-3">
          {config.subjectResult.inputs.map((input, index) => (
            <div
              className="flex flex-wrap items-center gap-3"
              key={`${input.sourceDefinitionId}-${String(index)}`}
            >
              <select
                className={`${formSelectClassName} min-w-[200px] flex-1`}
                disabled={readOnly || isPublished}
                onChange={(event) => {
                  const inputs = [...config.subjectResult.inputs];
                  const current = inputs[index];
                  if (current) {
                    inputs[index] = { ...current, sourceDefinitionId: event.target.value };
                  }
                  updateConfig({
                    subjectResult: { ...config.subjectResult, inputs },
                  });
                }}
                value={input.sourceDefinitionId}
              >
                <option value="">{t('configuration.grading.selectSource')}</option>
                {config.assessmentTypes.map((type) => (
                  <option key={type.id} value={type.id ?? ''}>
                    {type.name || type.shortName}
                  </option>
                ))}
                {config.derivedResults.map((derived) => (
                  <option key={derived.id} value={derived.id ?? ''}>
                    {derived.name || derived.shortName}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <input
                  aria-label={t('configuration.grading.weight')}
                  className={`${formInputClassName} w-24`}
                  disabled={readOnly || isPublished}
                  min={0}
                  max={100}
                  onChange={(event) => {
                    const weight = parseWeightToHundredths(event.target.value);
                    const inputs = [...config.subjectResult.inputs];
                    const current = inputs[index];
                    if (current) {
                      inputs[index] = { ...current, weight };
                    }
                    updateConfig({ subjectResult: { ...config.subjectResult, inputs } });
                  }}
                  type="number"
                  value={(input.weight / 100).toString()}
                />
                <span className="text-xs font-bold text-slate-400">%</span>
              </div>
              {!readOnly && !isPublished ? (
                <button
                  aria-label={t('configuration.grading.removeInput')}
                  className="cursor-pointer rounded-xl px-2 py-1 text-sm font-black text-red-400 hover:bg-red-50"
                  onClick={() => {
                    const inputs = config.subjectResult.inputs.filter(
                      (_, itemIndex) => itemIndex !== index
                    );
                    updateConfig({ subjectResult: { ...config.subjectResult, inputs } });
                  }}
                  type="button"
                >
                  ✕
                </button>
              ) : null}
            </div>
          ))}
          {!readOnly && !isPublished ? (
            <button
              className="cursor-pointer rounded-2xl border border-dashed border-teal-300 px-4 py-2.5 text-xs font-bold text-teal-700 transition-colors hover:bg-teal-50"
              onClick={() => {
                updateConfig({
                  subjectResult: {
                    ...config.subjectResult,
                    inputs: [
                      ...config.subjectResult.inputs,
                      {
                        sourceDefinitionId: '',
                        weight: 0,
                        displayOrder: config.subjectResult.inputs.length + 1,
                      },
                    ],
                  },
                });
              }}
              type="button"
            >
              + {t('configuration.grading.addInput')}
            </button>
          ) : null}
          <div
            className={`flex items-center gap-2 rounded-2xl p-3 text-xs font-black ${
              weightOk ? 'bg-teal-50 text-teal-700' : 'bg-red-50 text-red-700'
            }`}
          >
            {t('configuration.grading.weightsTotal', {
              total: String(totalWeight / 100),
            })}
            {!weightOk ? ` - ${t('configuration.grading.weightsWarning')}` : null}
          </div>
        </div>
      </EditorCard>

      {/* Validation summary */}
      {validationIssues.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-black uppercase tracking-wider text-amber-700">
            {t('configuration.grading.validationTitle')}
          </p>
          <ul className="mt-2 space-y-1 text-xs font-semibold text-amber-800">
            {validationIssues.map((issue, index) => (
              <li key={index}>• {t(issue)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Sandbox */}
      <Sandbox config={config} readOnly={readOnly} />

      {/* Scopes */}
      <EditorCard title={t('configuration.grading.scopesTitle')}>
        <ScopeEditor
          apiBaseUrl={apiBaseUrl}
          {...(capabilityToken ? { capabilityToken } : {})}
          disabled={readOnly || isPublished}
          onSave={handleSaveScopes}
          scopes={scopes}
          setScopes={setScopes}
        />
      </EditorCard>

      {/* Actions */}
      {!readOnly ? (
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-6">
          {isPublished ? (
            <button
              className="cursor-pointer rounded-2xl border border-slate-200/80 bg-white px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-50"
              disabled={isSaving}
              onClick={() => void handleDuplicate()}
              type="button"
            >
              {t('configuration.grading.duplicate')}
            </button>
          ) : (
            <>
              <button
                className="cursor-pointer rounded-2xl border border-slate-200/80 bg-white px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-50"
                disabled={isSaving}
                onClick={() => void handleSave()}
                type="button"
              >
                {t('configuration.grading.saveDraft')}
              </button>
              <button
                className="cursor-pointer rounded-2xl bg-teal-500 px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-[0_0_20px_-5px_rgba(20,184,166,0.5)] transition-all hover:scale-105 hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSaving || validationIssues.length > 0}
                onClick={() => void handlePublish()}
                type="button"
              >
                {t('configuration.grading.publish')}
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Template picker
// ---------------------------------------------------------------------------

function TemplateModal({
  apiBaseUrl,
  capabilityToken,
  client,
  onClose,
  onCreated,
  onSessionExpired,
}: {
  apiBaseUrl: string | null;
  capabilityToken?: string;
  client?: GradingPolicyClient;
  onClose: () => void;
  onCreated: (detail: GradingPolicyDetailResponse) => void;
  onSessionExpired: () => void;
}) {
  const { t } = useTranslation();
  const [templateKey, setTemplateKey] = useState<string>('DEVOIRS_COMPOSITION');
  const [scaleMax, setScaleMax] = useState(20);
  const [passThreshold, setPassThreshold] = useState('10,00');
  const [isCreating, setIsCreating] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const template = GRADING_POLICY_TEMPLATES.find((item) => item.key === templateKey);

  const handleCreate = async () => {
    if (!template) {
      return;
    }
    setIsCreating(true);
    setErrorKey(null);

    try {
      const config = template.build(scaleMax, parseDecimalToHundredths(passThreshold, scaleMax));
      // Resolve graph references: assessment-type and derived ids must be real
      // ids the server can map (the template fills them here).
      const withIds = resolveTemplateIds(config);
      const detail =
        client?.create ?? createGradingPolicyClientFallback(apiBaseUrl, capabilityToken);
      const result = await detail(withIds);
      onCreated(result);
    } catch (error) {
      if (isInvalidAccessToken(error)) {
        onSessionExpired();
        return;
      }
      setErrorKey(resolveConfigurationErrorMessageKey(error));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <ModalShell
      closeLabel={t('configuration.cancel')}
      onClose={onClose}
      resizeLabel={t('configuration.resize')}
      title={t('configuration.grading.new')}
    >
      <div className="space-y-4">
        <p className="text-sm font-semibold text-slate-500">
          {t('configuration.grading.templateHint')}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {GRADING_POLICY_TEMPLATES.map((item) => (
            <button
              className={`cursor-pointer rounded-2xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${
                templateKey === item.key
                  ? 'border-teal-400 bg-teal-50/60 shadow-sm'
                  : 'border-slate-200/70 bg-white hover:border-teal-300'
              }`}
              key={item.key}
              onClick={() => {
                setTemplateKey(item.key);
              }}
              type="button"
            >
              <p className="text-[13px] font-black text-slate-800">{item.labelFr}</p>
              <p className="mt-1 text-[11px] font-semibold text-slate-400">{item.descriptionFr}</p>
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('configuration.grading.scaleMax')}>
            <input
              className={formInputClassName}
              max={100}
              min={1}
              onChange={(event) => {
                const value = Number.parseInt(event.target.value, 10);
                setScaleMax(Number.isFinite(value) ? value : 20);
              }}
              type="number"
              value={scaleMax}
            />
          </Field>
          <Field label={t('configuration.grading.passThreshold')}>
            <input
              className={formInputClassName}
              onChange={(event) => {
                setPassThreshold(event.target.value);
              }}
              value={passThreshold}
            />
          </Field>
        </div>
        {errorKey ? (
          <div
            aria-live="polite"
            className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700"
            role="alert"
          >
            {t(errorKey)}
          </div>
        ) : null}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
          <button
            className="cursor-pointer rounded-2xl border border-slate-200/80 bg-white px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-slate-500 transition-colors hover:bg-slate-50"
            onClick={onClose}
            type="button"
          >
            {t('configuration.cancel')}
          </button>
          <button
            className="cursor-pointer rounded-2xl bg-teal-500 px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-[0_0_20px_-5px_rgba(20,184,166,0.5)] transition-all hover:scale-105 hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isCreating}
            onClick={() => void handleCreate()}
            type="button"
          >
            {isCreating ? t('configuration.saving') : t('configuration.grading.create')}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// Sandbox ("Tester cette politique")
// ---------------------------------------------------------------------------

function Sandbox({ config, readOnly }: { config: GradingPolicyConfig; readOnly: boolean }) {
  const { t } = useTranslation();
  const [marks, setMarks] = useState<Record<string, string>>({});
  const result = evaluateSandbox(config, marks);

  return (
    <EditorCard title={t('configuration.grading.sandboxTitle')}>
      <div className="grid gap-3 sm:grid-cols-2">
        {config.assessmentTypes.map((type) => (
          <label className="flex flex-col gap-2" key={type.id}>
            <span className="text-[13px] font-bold text-slate-800">
              {type.name || type.shortName}
              <span className="ml-1 text-[11px] font-semibold text-slate-400">
                {type.occurrenceMode === 'REPEATABLE'
                  ? `(${String(type.minOccurrences)}-${String(type.maxOccurrences)})`
                  : ''}
              </span>
            </span>
            <input
              className={formInputClassName}
              disabled={readOnly}
              onChange={(event) => {
                setMarks((current) => ({ ...current, [type.id ?? '']: event.target.value }));
              }}
              placeholder="Ex. 12,50"
              value={marks[type.id ?? ''] ?? ''}
            />
          </label>
        ))}
      </div>

      {result ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                {t('configuration.grading.sandboxResult')}
              </p>
              <p className="mt-1 text-3xl font-black tracking-tight text-slate-900">
                {formatHundredths(result.subjectResult)}
                <span className="ml-1 text-sm font-bold text-slate-400">/ {result.scaleMax}</span>
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider ${
                result.subjectResult >= config.passThreshold
                  ? 'bg-teal-50 text-teal-700 ring-1 ring-teal-200'
                  : 'bg-red-50 text-red-700 ring-1 ring-red-200'
              }`}
            >
              {result.subjectResult >= config.passThreshold
                ? t('configuration.grading.sandboxPass')
                : t('configuration.grading.sandboxFail')}
            </span>
          </div>
          {result.derivedValues.size > 0 ? (
            <ul className="mt-3 space-y-1 border-t border-slate-200 pt-3">
              {[...result.derivedValues.entries()].map(([id, value]) => {
                const derived = config.derivedResults.find((item) => item.id === id);
                if (!derived) {
                  return null;
                }
                return (
                  <li
                    className="flex items-center justify-between text-xs font-bold text-slate-500"
                    key={id}
                  >
                    <span>{derived.name || derived.shortName}</span>
                    <span>{formatHundredths(value)}</span>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </EditorCard>
  );
}

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function AssessmentTypeRow({
  disabled,
  onChange,
  onRemove,
  type,
}: {
  disabled: boolean;
  onChange: (next: AssessmentTypeInput) => void;
  onRemove: () => void;
  type: AssessmentTypeInput;
}) {
  const { t } = useTranslation();

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/40 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={t('configuration.grading.name')}>
          <input
            className={formInputClassName}
            disabled={disabled}
            onChange={(event) => {
              onChange({ ...type, name: event.target.value });
            }}
            value={type.name}
          />
        </Field>
        <Field label={t('configuration.grading.shortName')}>
          <input
            className={formInputClassName}
            disabled={disabled}
            onChange={(event) => {
              onChange({ ...type, shortName: event.target.value });
            }}
            value={type.shortName}
          />
        </Field>
        <Field label={t('configuration.grading.occurrence')}>
          <select
            className={formSelectClassName}
            disabled={disabled}
            onChange={(event) => {
              const occurrenceMode = event.target.value as AssessmentTypeInput['occurrenceMode'];
              onChange({
                ...type,
                occurrenceMode,
                minOccurrences: occurrenceMode === 'SINGLE' ? 1 : Math.max(type.minOccurrences, 1),
                maxOccurrences: occurrenceMode === 'SINGLE' ? 1 : Math.max(type.maxOccurrences, 2),
              });
            }}
            value={type.occurrenceMode}
          >
            <option value="REPEATABLE">{t('configuration.grading.repeatable')}</option>
            <option value="SINGLE">{t('configuration.grading.single')}</option>
          </select>
        </Field>
        <Field label={t('configuration.grading.minMax')}>
          <div className="flex items-center gap-2">
            <input
              aria-label={t('configuration.grading.minOccurrences')}
              className={formInputClassName}
              disabled={disabled}
              min={0}
              onChange={(event) => {
                onChange({
                  ...type,
                  minOccurrences: Number.parseInt(event.target.value, 10) || 0,
                });
              }}
              type="number"
              value={type.minOccurrences}
            />
            <span className="text-xs font-bold text-slate-400">→</span>
            <input
              aria-label={t('configuration.grading.maxOccurrences')}
              className={formInputClassName}
              disabled={disabled}
              min={1}
              onChange={(event) => {
                onChange({
                  ...type,
                  maxOccurrences: Number.parseInt(event.target.value, 10) || 1,
                });
              }}
              type="number"
              value={type.maxOccurrences}
            />
          </div>
        </Field>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-600">
          <input
            checked={type.required}
            className="h-4 w-4 accent-teal-500"
            disabled={disabled}
            onChange={(event) => {
              onChange({ ...type, required: event.target.checked });
            }}
            type="checkbox"
          />
          {t('configuration.grading.required')}
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-600">
          <input
            checked={type.teacherCanCreateInstances}
            className="h-4 w-4 accent-teal-500"
            disabled={disabled}
            onChange={(event) => {
              onChange({ ...type, teacherCanCreateInstances: event.target.checked });
            }}
            type="checkbox"
          />
          {t('configuration.grading.teacherCreates')}
        </label>
        {!disabled ? (
          <button
            aria-label={t('configuration.grading.removeType')}
            className="cursor-pointer rounded-xl px-2 py-1 text-sm font-black text-red-400 hover:bg-red-50"
            onClick={onRemove}
            type="button"
          >
            ✕
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DerivedResultRow({
  derived,
  disabled,
  onChange,
  onRemove,
  typeIds,
  typeNames,
}: {
  derived: DerivedResultInput;
  disabled: boolean;
  onChange: (next: DerivedResultInput) => void;
  onRemove: () => void;
  typeIds: string[];
  typeNames: AssessmentTypeInput[];
}) {
  const { t } = useTranslation();

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-slate-50/40 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('configuration.grading.name')}>
          <input
            className={formInputClassName}
            disabled={disabled}
            onChange={(event) => {
              onChange({ ...derived, name: event.target.value });
            }}
            value={derived.name}
          />
        </Field>
        <Field label={t('configuration.grading.shortName')}>
          <input
            className={formInputClassName}
            disabled={disabled}
            onChange={(event) => {
              onChange({ ...derived, shortName: event.target.value });
            }}
            value={derived.shortName}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label={t('configuration.grading.derivedSources')}>
            <div className="flex flex-wrap gap-2">
              {typeIds.map((typeId, index) => {
                const name = typeNames[index]?.name ?? typeNames[index]?.shortName ?? typeId;
                const checked = derived.sourceDefinitionIds.includes(typeId);
                return (
                  <label
                    className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
                      checked
                        ? 'border-teal-400 bg-teal-50 text-teal-700'
                        : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                    }`}
                    key={typeId}
                  >
                    <input
                      checked={checked}
                      className="hidden"
                      disabled={disabled}
                      onChange={() => {
                        const next = checked
                          ? derived.sourceDefinitionIds.filter((id) => id !== typeId)
                          : [...derived.sourceDefinitionIds, typeId];
                        onChange({ ...derived, sourceDefinitionIds: next });
                      }}
                      type="checkbox"
                    />
                    {name}
                  </label>
                );
              })}
              {typeIds.length === 0 ? (
                <p className="text-xs font-bold text-slate-400">
                  {t('configuration.grading.noTypesYet')}
                </p>
              ) : null}
            </div>
          </Field>
        </div>
      </div>
      {!disabled ? (
        <div className="mt-3 flex justify-end">
          <button
            aria-label={t('configuration.grading.removeDerived')}
            className="cursor-pointer rounded-xl px-2 py-1 text-sm font-black text-red-400 hover:bg-red-50"
            onClick={onRemove}
            type="button"
          >
            ✕
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ScopeEditor({
  apiBaseUrl,
  capabilityToken,
  disabled,
  onSave,
  scopes,
  setScopes,
}: {
  apiBaseUrl: string | null;
  capabilityToken?: string;
  disabled: boolean;
  onSave: () => Promise<void>;
  scopes: PolicyScopeAssignment[];
  setScopes: (scopes: PolicyScopeAssignment[]) => void;
}) {
  const { t } = useTranslation();
  const [levels, setLevels] = useState<{ id: string; label: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; label: string }[]>([]);
  // Subject ids per level, from the level curriculum: a LEVEL_SUBJECT scope
  // must pick a subject that is actually taught at the chosen level (roadmap
  // §9.9 resolution is school default -> level -> level + subject).
  const [subjectsByLevel, setSubjectsByLevel] = useState<Map<string, string[]>>(() => new Map());
  const cancelledRef = useRef(false);

  // Load real levels and subjects once so scopes pick from actual records
  // instead of raw UUIDs (roadmap §9.9, policy resolution by level/subject).
  useEffect(() => {
    if (!apiBaseUrl) {
      return;
    }

    cancelledRef.current = false;

    void (async () => {
      try {
        const [{ listLevelCurriculums }, { listSubjects }] = await Promise.all([
          import('../classes/classesApi'),
          import('../classes/classesApi'),
        ]);
        const options = { ...(capabilityToken ? { capabilityToken } : {}) };
        const [curriculum, subjectsPage] = await Promise.all([
          listLevelCurriculums(apiBaseUrl, options),
          listSubjects(apiBaseUrl, { limit: 100, offset: 0 }, options),
        ]);
        if (!cancelledRef.current) {
          setLevels(curriculum.items.map((item) => ({ id: item.levelId, label: item.levelName })));
          setSubjects(
            subjectsPage.items.map((item) => ({
              id: item.id,
              label: item.name,
            }))
          );
          setSubjectsByLevel(
            new Map(
              curriculum.items.map((item) => [
                item.levelId,
                item.entries.map((entry) => entry.subjectId),
              ])
            )
          );
        }
      } catch {
        // The picker stays empty; raw values in existing scopes are preserved
        // via the "keep current" options below.
      }
    })();

    return () => {
      cancelledRef.current = true;
    };
  }, [apiBaseUrl, capabilityToken]);

  const updateScope = (index: number, patch: Partial<PolicyScopeAssignment>) => {
    setScopes(
      scopes.map((scope, scopeIndex) => (scopeIndex === index ? { ...scope, ...patch } : scope))
    );
  };

  const levelOptions = (current: string | null) => {
    const known = levels.find((item) => item.id === current);
    const keep = current && !known ? [{ id: current, label: current }] : [];
    return [...keep, ...levels];
  };

  /** Subjects taught at the scope's level; falls back to every subject when
   *  no curriculum is configured yet (wizard before the Matières step). */
  const subjectOptions = (scope: PolicyScopeAssignment) => {
    const current = scope.subjectId;
    const levelSubjectIds = scope.levelId ? (subjectsByLevel.get(scope.levelId) ?? null) : null;
    const pool =
      levelSubjectIds === null
        ? subjects
        : subjects.filter((subject) => levelSubjectIds.includes(subject.id));
    const known = pool.find((item) => item.id === current);
    const keep = current && !known ? [{ id: current, label: current }] : [];
    return [...keep, ...pool];
  };

  // When the level changes, clear a subject that is no longer taught there so
  // the scope cannot reference a subject the level does not offer.
  const handleLevelChange = (index: number, nextLevelId: string) => {
    const scope = scopes[index];
    if (!scope) {
      return;
    }
    const levelSubjectIds = nextLevelId ? (subjectsByLevel.get(nextLevelId) ?? null) : null;
    const subjectStillValid =
      !scope.subjectId || levelSubjectIds === null || levelSubjectIds.includes(scope.subjectId);
    updateScope(index, {
      levelId: nextLevelId || null,
      ...(subjectStillValid ? {} : { subjectId: null }),
    });
  };

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-slate-400">
        {t('configuration.grading.scopesHint')}
      </p>
      {scopes.length === 0 ? (
        <p className="text-xs font-bold text-slate-400">{t('configuration.grading.noScopes')}</p>
      ) : null}
      {scopes.map((scope, index) => (
        <div className="flex flex-wrap items-center gap-3" key={index}>
          <select
            className={`${formSelectClassName} min-w-[180px] flex-1`}
            disabled={disabled}
            onChange={(event) => {
              updateScope(index, { scopeType: event.target.value as PolicyScopeType });
            }}
            value={scope.scopeType}
          >
            <option value="SCHOOL_DEFAULT">{t('configuration.grading.scopeSchool')}</option>
            <option value="LEVEL">{t('configuration.grading.scopeLevel')}</option>
            <option value="LEVEL_SUBJECT">{t('configuration.grading.scopeSubject')}</option>
          </select>
          {scope.scopeType !== 'SCHOOL_DEFAULT' ? (
            <select
              aria-label={t('configuration.grading.levelId')}
              className={`${formSelectClassName} min-w-[160px] flex-1`}
              disabled={disabled}
              onChange={(event) => {
                handleLevelChange(index, event.target.value);
              }}
              value={scope.levelId ?? ''}
            >
              <option value="">{t('configuration.grading.selectLevel')}</option>
              {levelOptions(scope.levelId).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          ) : null}
          {scope.scopeType === 'LEVEL_SUBJECT' ? (
            <select
              aria-label={t('configuration.grading.subjectId')}
              className={`${formSelectClassName} min-w-[160px] flex-1`}
              disabled={disabled}
              onChange={(event) => {
                updateScope(index, { subjectId: event.target.value || null });
              }}
              value={scope.subjectId ?? ''}
            >
              <option value="">{t('configuration.grading.selectSubject')}</option>
              {subjectOptions(scope).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          ) : null}
          {!disabled ? (
            <button
              aria-label={t('configuration.grading.removeScope')}
              className="cursor-pointer rounded-xl px-2 py-1 text-sm font-black text-red-400 hover:bg-red-50"
              onClick={() => {
                setScopes(scopes.filter((_, scopeIndex) => scopeIndex !== index));
              }}
              type="button"
            >
              ✕
            </button>
          ) : null}
        </div>
      ))}
      {!disabled ? (
        <>
          <button
            className="cursor-pointer rounded-2xl border border-dashed border-teal-300 px-4 py-2.5 text-xs font-bold text-teal-700 transition-colors hover:bg-teal-50"
            onClick={() => {
              setScopes([
                ...scopes,
                { scopeType: 'SCHOOL_DEFAULT', levelId: null, subjectId: null },
              ]);
            }}
            type="button"
          >
            + {t('configuration.grading.addScope')}
          </button>
          <button
            className="ml-2 cursor-pointer rounded-2xl bg-slate-800 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-slate-700"
            onClick={() => void onSave()}
            type="button"
          >
            {t('configuration.grading.saveScopes')}
          </button>
        </>
      ) : null}
    </div>
  );
}

function EditorCard({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-5">
      <h3 className="mb-3 text-[12px] font-black uppercase tracking-widest text-slate-500">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[13px] font-bold text-slate-800">{label}</span>
      {children}
    </label>
  );
}

function StatusPill({ status }: { status: PolicySummary['status'] }) {
  const { t } = useTranslation();

  const styles: Record<PolicySummary['status'], string> = {
    DRAFT: 'bg-slate-100 text-slate-600 ring-slate-200',
    PUBLISHED: 'bg-teal-50 text-teal-700 ring-teal-200',
    SUPERSEDED: 'bg-amber-50 text-amber-700 ring-amber-200',
  };

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ring-1 ${styles[status]}`}
    >
      {t(`configuration.grading.status.${status.toLowerCase()}`)}
    </span>
  );
}

function GaugeIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
      <path d="M12 9V4M12 20a8 8 0 1 1 0-16 8 8 0 0 1 0 16z" />
      <path d="M19.4 15a8 8 0 0 0 0-6" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Pure helpers (display <-> hundredths in gradingFormat.ts, sandbox below)
// ---------------------------------------------------------------------------

/**
 * Template configs carry stable placeholder ids (`tpl-*`) that wire the whole
 * graph: derived results reference their source types and the subject result
 * references its inputs. This remaps every placeholder to a fresh UUID,
 * keeping all references consistent, so the server receives a real graph.
 */
function resolveTemplateIds(config: GradingPolicyConfig): GradingPolicyConfig {
  const idMap = new Map<string, string>();

  for (const type of config.assessmentTypes) {
    if (type.id) {
      idMap.set(type.id, crypto.randomUUID());
    }
  }
  for (const derived of config.derivedResults) {
    if (derived.id) {
      idMap.set(derived.id, crypto.randomUUID());
    }
  }

  const remap = (sourceId: string): string => idMap.get(sourceId) ?? sourceId;

  return {
    ...config,
    assessmentTypes: config.assessmentTypes.map((type) => ({
      ...type,
      ...(type.id ? { id: remap(type.id) } : {}),
    })),
    derivedResults: config.derivedResults.map((derived) => ({
      ...derived,
      ...(derived.id ? { id: remap(derived.id) } : {}),
      sourceDefinitionIds: derived.sourceDefinitionIds.map(remap),
    })),
    subjectResult: {
      ...config.subjectResult,
      inputs: config.subjectResult.inputs.map((input) => ({
        ...input,
        sourceDefinitionId: remap(input.sourceDefinitionId),
      })),
    },
  };
}

function evaluateSandbox(
  config: GradingPolicyConfig,
  marksByTypeId: Record<string, string>
): { subjectResult: number; derivedValues: Map<string, number>; scaleMax: number } | null {
  const converted = new Map<string, number[]>();

  for (const type of config.assessmentTypes) {
    if (!type.id) {
      continue;
    }
    const raw = marksByTypeId[type.id];
    if (!raw || raw.trim().length === 0) {
      return null; // sandbox needs a mark per type
    }
    const hundredths = parseDecimalToHundredths(raw, config.scaleMax);
    converted.set(type.id, [hundredths]);
  }

  // Same deterministic engine as the official calculation (integer hundredths
  // in the pure domain), never float math - previews must match persisted
  // results (AGENTS.md §9.1).
  try {
    const result = evaluatePolicy(config, converted);
    return {
      subjectResult: result.subjectResult,
      derivedValues: result.derivedValues,
      scaleMax: config.scaleMax,
    };
  } catch {
    return null;
  }
}

function collectValidationIssues(config: GradingPolicyConfig): string[] {
  const issues: string[] = [];

  if (config.assessmentTypes.length === 0) {
    issues.push('configuration.grading.issueNoTypes');
  }
  for (const type of config.assessmentTypes) {
    if (type.minOccurrences > type.maxOccurrences) {
      issues.push('configuration.grading.issueOccurrence');
    }
    if (type.occurrenceMode === 'SINGLE' && type.maxOccurrences > 1) {
      issues.push('configuration.grading.issueSingle');
    }
    if (type.scaleMax !== config.scaleMax) {
      issues.push('configuration.grading.issueScale');
    }
  }
  for (const derived of config.derivedResults) {
    if (derived.sourceDefinitionIds.length === 0) {
      issues.push('configuration.grading.issueNoSource');
    }
  }
  const totalWeight = config.subjectResult.inputs.reduce((sum, input) => sum + input.weight, 0);
  if (totalWeight !== 10000) {
    issues.push('configuration.grading.issueWeights');
  }

  return issues;
}

function extractFieldErrors(error: unknown): Record<string, string> {
  if (
    typeof error === 'object' &&
    error !== null &&
    'fields' in error &&
    typeof (error as { fields?: unknown }).fields === 'object' &&
    (error as { fields?: Record<string, string> }).fields
  ) {
    return (error as { fields: Record<string, string> }).fields;
  }
  return {};
}

function isInvalidAccessToken(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'INVALID_ACCESS_TOKEN'
  );
}

async function fetchList(apiBaseUrl: string, options: { capabilityToken?: string }) {
  const { listGradingPolicies } = await import('./configurationApi');
  return listGradingPolicies(apiBaseUrl, options);
}

async function fetchPolicyDetail(
  apiBaseUrl: string,
  policyId: string,
  options: { capabilityToken?: string }
) {
  const { fetchGradingPolicyDetail } = await import('./configurationApi');
  return fetchGradingPolicyDetail(apiBaseUrl, policyId, options);
}

function createGradingPolicyClientFallback(
  apiBaseUrl: string | null,
  capabilityToken?: string
): (config: GradingPolicyConfig) => Promise<GradingPolicyDetailResponse> {
  return async (config) => {
    const { createGradingPolicy } = await import('./configurationApi');
    if (!apiBaseUrl) {
      throw new ConfigurationApiError(
        'LOCAL_SERVICE_UNAVAILABLE',
        'Service local indisponible.',
        0
      );
    }
    return createGradingPolicy(apiBaseUrl, config, {
      ...(capabilityToken ? { capabilityToken } : {}),
    });
  };
}

async function saveViaApi(
  kind: 'create' | 'update',
  apiBaseUrl: string | null,
  policyId: string,
  config: GradingPolicyConfig,
  capabilityToken?: string
) {
  const { createGradingPolicy, updateGradingPolicy } = await import('./configurationApi');
  if (!apiBaseUrl) {
    throw new ConfigurationApiError('LOCAL_SERVICE_UNAVAILABLE', 'Service local indisponible.', 0);
  }
  const options = { ...(capabilityToken ? { capabilityToken } : {}) };
  return kind === 'update'
    ? updateGradingPolicy(apiBaseUrl, policyId, config, options)
    : createGradingPolicy(apiBaseUrl, config, options);
}

async function publishViaApi(
  apiBaseUrl: string | null,
  policyId: string,
  capabilityToken?: string
) {
  const { publishGradingPolicy } = await import('./configurationApi');
  if (!apiBaseUrl) {
    throw new ConfigurationApiError('LOCAL_SERVICE_UNAVAILABLE', 'Service local indisponible.', 0);
  }
  return publishGradingPolicy(apiBaseUrl, policyId, {
    ...(capabilityToken ? { capabilityToken } : {}),
  });
}

async function duplicateViaApi(
  apiBaseUrl: string | null,
  policyId: string,
  capabilityToken?: string
) {
  const { duplicateGradingPolicy } = await import('./configurationApi');
  if (!apiBaseUrl) {
    throw new ConfigurationApiError('LOCAL_SERVICE_UNAVAILABLE', 'Service local indisponible.', 0);
  }
  return duplicateGradingPolicy(apiBaseUrl, policyId, {
    ...(capabilityToken ? { capabilityToken } : {}),
  });
}

async function assignScopesViaApi(
  apiBaseUrl: string | null,
  policyId: string,
  scopes: PolicyScopeAssignment[],
  capabilityToken?: string
) {
  const { assignPolicyScopes } = await import('./configurationApi');
  if (!apiBaseUrl) {
    throw new ConfigurationApiError('LOCAL_SERVICE_UNAVAILABLE', 'Service local indisponible.', 0);
  }
  return assignPolicyScopes(
    apiBaseUrl,
    policyId,
    { scopes },
    {
      ...(capabilityToken ? { capabilityToken } : {}),
    }
  );
}
