import { useTranslation } from 'react-i18next';
import {
  AppreciationSection,
  type AppreciationClient,
} from '../configuration/AppreciationSection';
import { WizardPrimaryButton, WizardSecondaryButton } from './SetupProfileStep';

export interface SetupAppreciationStepProps {
  apiBaseUrl: string | null;
  capabilityToken?: string;
  /** Test seam: replaces the network client for the embedded section. */
  appreciationClient?: AppreciationClient;
  isSaving: boolean;
  onBack: () => void;
  onSubmit: () => void;
  onSessionExpired?: () => void;
}

/** Appréciations (roadmap §9.11) - reuses the permanent configuration section. */
export function SetupAppreciationStep({
  apiBaseUrl,
  capabilityToken,
  appreciationClient,
  isSaving,
  onBack,
  onSubmit,
  onSessionExpired,
}: SetupAppreciationStepProps) {
  const { t } = useTranslation();

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <AppreciationSection
        apiBaseUrl={apiBaseUrl}
        {...(capabilityToken !== undefined ? { capabilityToken } : {})}
        {...(appreciationClient !== undefined ? { client: appreciationClient } : {})}
        {...(onSessionExpired !== undefined ? { onSessionExpired } : {})}
      />

      <div className="flex items-center justify-end gap-3 pt-1">
        <WizardSecondaryButton label={t('setup.actions.back')} onClick={onBack} />
        <WizardPrimaryButton isSaving={isSaving} label={t('setup.actions.saveAndContinue')} />
      </div>
    </form>
  );
}
