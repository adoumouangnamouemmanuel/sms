import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AuthTokenResponse, PublicAuthUser } from '@edutrack/shared';
import { describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { AuthApiError } from './authErrors';
import { LoginScreen } from './LoginScreen';
import type { LoginClient } from './useLoginForm';
import type { LogoutClient } from './useLogoutAction';

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

  it('passes the sidecar capability token to the login client', async () => {
    const user = userEvent.setup();
    const loginClient = vi.fn<LoginClient>().mockResolvedValue(session);

    renderLoginScreen({ capabilityToken: 'local-capability-token', loginClient });

    await user.type(screen.getByLabelText('Code école'), 'NDS-DEMO');
    await user.type(screen.getByLabelText("Nom d'utilisateur"), 'directeur');
    await user.type(screen.getByLabelText('Mot de passe'), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(loginClient).toHaveBeenCalledWith(
      'http://127.0.0.1:49152',
      {
        schoolCode: 'NDS-DEMO',
        username: 'directeur',
        password: 'correct-password',
      },
      { capabilityToken: 'local-capability-token' }
    );
  });

  it('shows the service as ready when browser dev has an API URL', () => {
    renderLoginScreen({ desktopStatus: null });

    expect(screen.getByText('Service local prêt')).toBeInTheDocument();
  });

  it('opens and closes the safe forgot-password notice', async () => {
    const user = userEvent.setup();

    renderLoginScreen();

    await user.click(screen.getByRole('button', { name: 'Mot de passe oublié ?' }));

    expect(screen.getByRole('dialog', { name: 'Mot de passe oublié' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Pour protéger les dossiers scolaires, EduTrack ne réinitialise pas un mot de passe sans validation locale.'
      )
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Compris' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: 'Se déconnecter' })).toBeInTheDocument();
  });

  it('logs out through the auth API and returns to the login screen', async () => {
    const user = userEvent.setup();
    const logoutClient = vi.fn<LogoutClient>().mockResolvedValue(undefined);
    const onLoggedOut = vi.fn();

    renderLoginScreen({
      capabilityToken: 'local-capability-token',
      logoutClient,
      onLoggedOut,
      user: authUser,
    });

    await user.click(screen.getByRole('button', { name: 'Se déconnecter' }));

    expect(logoutClient).toHaveBeenCalledWith('http://127.0.0.1:49152', {
      capabilityToken: 'local-capability-token',
    });
    expect(onLoggedOut).toHaveBeenCalledOnce();
  });

  it('shows a localized message when logout fails', async () => {
    const user = userEvent.setup();
    const logoutClient = vi
      .fn<LogoutClient>()
      .mockRejectedValue(new AuthApiError('UNKNOWN_LOGOUT_ERROR', 'Logout failed', 500));

    renderLoginScreen({ logoutClient, user: authUser });

    await user.click(screen.getByRole('button', { name: 'Se déconnecter' }));

    expect(await screen.findByText('La déconnexion locale a échoué. Réessayez.')).toBeInTheDocument();
  });
});

function renderLoginScreen(
  options: {
    capabilityToken?: string;
    desktopStatus?: null;
    loginClient?: LoginClient;
    logoutClient?: LogoutClient;
    onAuthenticated?: (user: PublicAuthUser) => void;
    onLoggedOut?: () => void;
    user?: PublicAuthUser | null;
  } = {}
) {
  return render(
    <LoginScreen
      apiBaseUrl="http://127.0.0.1:49152"
      {...(options.capabilityToken ? { capabilityToken: options.capabilityToken } : {})}
      {...(options.desktopStatus !== undefined ? { desktopStatus: options.desktopStatus } : {})}
      loginClient={options.loginClient ?? vi.fn<LoginClient>().mockResolvedValue(session)}
      {...(options.logoutClient ? { logoutClient: options.logoutClient } : {})}
      onAuthenticated={options.onAuthenticated ?? vi.fn()}
      onLoggedOut={options.onLoggedOut ?? vi.fn()}
      user={options.user ?? null}
    />
  );
}
