import { APP_NAME } from '@edutrack/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import './i18n';
import { App } from './App';

describe('App', () => {
  it('renders the localized Version 1 shell', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: APP_NAME })).toBeInTheDocument();
    expect(screen.getByText('Accès sécurisé')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Connexion du personnel' })
    ).toBeInTheDocument();
    expect(screen.queryByText('SQLite local uniquement')).not.toBeInTheDocument();
  });
});
