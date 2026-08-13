import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AuthTokenResponse, PublicAuthUser } from '@edutrack/shared';
import { describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { AuthApiError } from './authErrors';
import { LoginScreen } from './LoginScreen';
import type { LoginClient } from './useLoginForm';

const authUser: PublicAuthUser = {
  id: '00000000-0000-4000-8000-000000000201',
  schoolId: '00000000-0000-4000-8000-000000000101',
  username: 'directeur',
  role: 'SCHOOL_MASTER',
};

const session: AuthTokenResponse = {
  accessToken: 'access-token-1',
  accessTokenExpiresAt: '2026-08-13T10:15:00.000Z',
  refreshTokenExpiresAt: '2026-08-20T10:00:00.000Z',
  user: authUser,
};

describe('LoginScreen', () => {
  it('validates required local login fields before calling the API', async () => {
    const user = userEvent.setup();
    const loginClient = vi.fn<LoginClient>();

    renderLoginScreen({ loginClient });

    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(screen.getByText('Le code école est requis.')).toBeInTheDocument();
    expect(screen.getByText("Le nom d'utilisateur est requis.")).toBeInTheDocument();
    expect(screen.getByText('Le mot de passe est requis.')).toBeInTheDocument();
    expect(loginClient).not.toHaveBeenCalled();
  });

  it('submits normalized credentials to the auth API', async () => {
    const user = userEvent.setup();
    const onAuthenticated = vi.fn();
    const loginClient = vi.fn<LoginClient>().mockResolvedValue(session);

    renderLoginScreen({ loginClient, onAuthenticated });

    await user.type(screen.getByLabelText('Code école'), ' NDS-DEMO ');
    await user.type(screen.getByLabelText("Nom d'utilisateur"), ' directeur ');
    await user.type(screen.getByLabelText('Mot de passe'), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(loginClient).toHaveBeenCalledWith('http://127.0.0.1:49152', {
      schoolCode: 'NDS-DEMO',
      username: 'directeur',
      password: 'correct-password',
    });
    expect(onAuthenticated).toHaveBeenCalledWith(authUser);
  });

  it('shows a localized message for invalid credentials', async () => {
    const user = userEvent.setup();
    const loginClient = vi
      .fn<LoginClient>()
      .mockRejectedValue(new AuthApiError('INVALID_CREDENTIALS', 'Invalid credentials', 401));

    renderLoginScreen({ loginClient });

    await user.type(screen.getByLabelText('Code école'), 'NDS-DEMO');
    await user.type(screen.getByLabelText("Nom d'utilisateur"), 'directeur');
    await user.type(screen.getByLabelText('Mot de passe'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(
      await screen.findByText("L'identifiant ou le mot de passe est incorrect.")
    ).toBeInTheDocument();
  });

  it('renders the authenticated session summary', () => {
    renderLoginScreen({ user: authUser });

    expect(screen.getByText('Session locale active')).toBeInTheDocument();
    expect(screen.getByText('directeur')).toBeInTheDocument();
    expect(screen.getByText('Direction')).toBeInTheDocument();
  });
});

function renderLoginScreen(
  options: {
    loginClient?: LoginClient;
    onAuthenticated?: (user: PublicAuthUser) => void;
    user?: PublicAuthUser | null;
  } = {}
) {
  return render(
    <LoginScreen
      apiBaseUrl="http://127.0.0.1:49152"
      loginClient={options.loginClient ?? vi.fn<LoginClient>().mockResolvedValue(session)}
      onAuthenticated={options.onAuthenticated ?? vi.fn()}
      user={options.user ?? null}
    />
  );
}
