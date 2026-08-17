import { useTranslation } from 'react-i18next';
import { LevelCurriculumView } from '../classes/LevelCurriculumView';
import { SubjectsView } from '../classes/SubjectsView';
import type { ClassesClient } from '../classes/useClassesState';
import { WizardPrimaryButton, WizardSecondaryButton } from './SetupProfileStep';

export interface SetupSubjectsStepProps {
  apiBaseUrl: string | null;
  capabilityToken?: string;
  /** Test seam: replaces the network client for the embedded views. */
  classesClient?: ClassesClient;
  isSaving: boolean;
  onBack: () => void;
  onSubmit: () => void;
  onSessionExpired?: () => void;
}

/** Matières & coefficients (roadmap §9.11) - reuses the permanent module views. */
export function SetupSubjectsStep({
  apiBaseUrl,
  capabilityToken,
  classesClient,
  isSaving,
  onBack,
  onSubmit,
  onSessionExpired,
}: SetupSubjectsStepProps) {
  const { t } = useTranslation();
  const sharedViewProps = {
    apiBaseUrl,
    ...(capabilityToken !== undefined ? { capabilityToken } : {}),
    ...(classesClient !== undefined ? { client: classesClient } : {}),
    ...(onSessionExpired !== undefined ? { onSessionExpired } : {}),
  };

  return (
    <div className="space-y-5">
      <SubjectsView {...sharedViewProps} />
      <LevelCurriculumView {...sharedViewProps} />

      <div className="flex items-center justify-end gap-3 pt-1">
        <WizardSecondaryButton label={t('setup.actions.back')} onClick={onBack} />
        <WizardPrimaryButton
          isSaving={isSaving}
          label={t('setup.actions.saveAndContinue')}
          onClick={onSubmit}
        />
      </div>
    </div>
  );
}
