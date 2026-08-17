import { useTranslation } from 'react-i18next';
import {
  GradingPolicySection,
  type GradingPolicyClient,
} from '../configuration/GradingPolicySection';
import { WizardPrimaryButton, WizardSecondaryButton } from './SetupProfileStep';

export interface SetupGradingStepProps {
  apiBaseUrl: string | null;
  capabilityToken?: string;
  /** Test seam: replaces the network client for the embedded section. */
  gradingClient?: GradingPolicyClient;
  isSaving: boolean;
  onBack: () => void;
  onSubmit: () => void;
  onSessionExpired?: () => void;
}

/** Politique de notation (roadmap §9.11) - reuses the permanent configuration section. */
export function SetupGradingStep({
  apiBaseUrl,
  capabilityToken,
  gradingClient,
  isSaving,
  onBack,
  onSubmit,
  onSessionExpired,
}: SetupGradingStepProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-5">
      <GradingPolicySection
        apiBaseUrl={apiBaseUrl}
        {...(capabilityToken !== undefined ? { capabilityToken } : {})}
        {...(gradingClient !== undefined ? { client: gradingClient } : {})}
        {...(onSessionExpired !== undefined ? { onSessionExpired } : {})}
      />

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
