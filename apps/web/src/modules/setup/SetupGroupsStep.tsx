import { useTranslation } from 'react-i18next';
import { SubjectGroupsView } from '../classes/SubjectGroupsView';
import type { ClassesClient } from '../classes/useClassesState';
import { WizardPrimaryButton, WizardSecondaryButton } from './SetupProfileStep';

export interface SetupGroupsStepProps {
  apiBaseUrl: string | null;
  capabilityToken?: string;
  /** Test seam: replaces the network client for the embedded views. */
  classesClient?: ClassesClient;
  isSaving: boolean;
  onBack: () => void;
  onSubmit: () => void;
  onSessionExpired?: () => void;
}

/** Groupes de matières (roadmap §9.11) - reuses the permanent module view. */
export function SetupGroupsStep({
  apiBaseUrl,
  capabilityToken,
  classesClient,
  isSaving,
  onBack,
  onSubmit,
  onSessionExpired,
}: SetupGroupsStepProps) {
  const { t } = useTranslation();

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <SubjectGroupsView
        apiBaseUrl={apiBaseUrl}
        {...(capabilityToken !== undefined ? { capabilityToken } : {})}
        {...(classesClient !== undefined ? { client: classesClient } : {})}
        {...(onSessionExpired !== undefined ? { onSessionExpired } : {})}
      />

      <div className="flex items-center justify-end gap-3 pt-1">
        <WizardSecondaryButton label={t('setup.actions.back')} onClick={onBack} />
        <WizardPrimaryButton isSaving={isSaving} label={t('setup.actions.saveAndContinue')} />
      </div>
    </form>
  );
}
