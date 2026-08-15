import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SetupCalendarRequest } from '@edutrack/shared';
import { describe, expect, it, vi } from 'vitest';
import '../i18n';
import { SetupCalendarStep } from '../modules/setup/SetupCalendarStep';

describe('SetupCalendarStep', () => {
  it('disables the primary action while any required date is empty', async () => {
    const userSession = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <SetupCalendarStep
        draft={draftWithMissingDate()}
        isSaving={false}
        onBack={vi.fn()}
        onChange={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    const submitButton = screen.getByRole('button', { name: 'Enregistrer et continuer' });
    expect(submitButton).toBeDisabled();

    await userSession.click(submitButton);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('runs onSubmit once all required dates are filled', async () => {
    const userSession = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <SetupCalendarStep
        draft={completeDraft()}
        isSaving={false}
        onBack={vi.fn()}
        onChange={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    const submitButton = screen.getByRole('button', { name: 'Enregistrer et continuer' });
    expect(submitButton).toBeEnabled();

    await userSession.click(submitButton);

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

/** Same as completeDraft() but the academic-year start date is empty. */
function draftWithMissingDate(): SetupCalendarRequest {
  return {
    ...completeDraft(),
    academicYear: { ...completeDraft().academicYear, startDate: '' },
  };
}

function completeDraft(): SetupCalendarRequest {
  return {
    academicYear: {
      label: '2026-2027',
      startDate: '2026-09-01',
      endDate: '2027-06-30',
    },
    termSystem: 'TRIMESTER',
    terms: [
      {
        label: 'Trimestre 1',
        termNumber: 1,
        startDate: '2026-09-01',
        endDate: '2026-12-20',
        isCurrent: true,
      },
      {
        label: 'Trimestre 2',
        termNumber: 2,
        startDate: '2027-01-05',
        endDate: '2027-03-27',
        isCurrent: false,
      },
    ],
  };
}
