import { APP_NAME, type PublicAuthUser, type SchoolModuleName } from '@edutrack/shared';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DesktopDeploymentStatus } from '../../desktopStatus';
import { useLogoutAction, type LogoutClient } from '../auth';
import type { SetupStateResponse } from '@edutrack/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MainAppShellProps {
  apiBaseUrl: string | null;
  capabilityToken?: string;
  desktopStatus?: DesktopDeploymentStatus | null;
  logoutClient?: LogoutClient;
  onLoggedOut: () => void;
  setupState: SetupStateResponse;
  user: PublicAuthUser;
}

/** Structural slice of useLogoutAction's return value used by AccountChip. */
interface LogoutActionState {
  isSubmitting: boolean;
  errorKey: string | null | undefined;
  submit: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Icons — 2px stroke, round caps/joins, 24×24 viewBox
// ---------------------------------------------------------------------------

/**
 * Gear / settings icon for SCHOOL_SETUP.
 * Replaces the old house icon which conventionally signals "home/dashboard".
 */
function GearIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function AcademicIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <rect height="7" rx="1" width="7" x="3" y="3" />
      <rect height="7" rx="1" width="7" x="14" y="3" />
      <rect height="7" rx="1" width="7" x="14" y="14" />
      <rect height="7" rx="1" width="7" x="3" y="14" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-[18px] w-[18px] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function LogOutIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Module nav config (only implemented modules appear; ordered by priority)
// ---------------------------------------------------------------------------

interface NavItem {
  moduleName: SchoolModuleName;
  /** i18n key used in setup.modules.* */
  labelKey: string;
  icon: React.ReactNode;
}

const MODULE_NAV_CONFIG: Partial<Record<SchoolModuleName, Omit<NavItem, 'moduleName'>>> = {
  // Gear icon — configuration/settings, not "home"
  SCHOOL_SETUP: { labelKey: 'setup.modules.SCHOOL_SETUP', icon: <GearIcon /> },
  ACADEMIC_STRUCTURE: { labelKey: 'setup.modules.ACADEMIC_STRUCTURE', icon: <AcademicIcon /> },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derives 1–2 uppercase initials from a username. */
function getInitials(username: string): string {
  const parts = username.split(/[\s._-]/).filter(Boolean);
  if (parts.length >= 2) {
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  }
  return username.slice(0, 2).toUpperCase();
}

// ---------------------------------------------------------------------------
// MainAppShell
// ---------------------------------------------------------------------------

export function MainAppShell({
  apiBaseUrl,
  capabilityToken,
  desktopStatus,
  logoutClient,
  onLoggedOut,
  setupState,
  user,
}: MainAppShellProps) {
  const { t } = useTranslation();
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [activeModule, setActiveModule] = useState<SchoolModuleName | null>(null);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);

  const logoutAction = useLogoutAction({
    apiBaseUrl,
    ...(capabilityToken ? { capabilityToken } : {}),
    ...(logoutClient ? { logoutClient } : {}),
    onLoggedOut,
  });

  const enabledModuleNames = setupState.enabledModules.map((m) => m.moduleName);
  const currentTerm = setupState.terms.find((term) => term.isCurrent);
  const serviceOnline = Boolean(apiBaseUrl && desktopStatus?.sidecarStatus !== 'failed');
  const initials = getInitials(user.username);

  return (
    <div className="fixed inset-0 flex bg-slate-100 font-sans text-slate-950 overflow-hidden">
      {/* ------------------------------------------------------------------ */}
      {/* Sidebar                                                              */}
      {/* ------------------------------------------------------------------ */}
      <aside
        aria-label={t('app.shell.navigation')}
        className={`relative flex flex-col border-r border-slate-800/60 text-white shadow-2xl overflow-visible z-30 transition-all duration-300 group/sidebar ${
          isSidebarExpanded ? 'w-[240px]' : 'w-[64px]'
        }`}
      >
        {/* Layer 1 — Base gradient: user-preferred deep navy (the old values read better). */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f172a] via-[#0a1628] to-[#061020] pointer-events-none" />
        {/*
         * Layer 2 — Teal radial glow: anchored at the top-left corner,
         * INSIDE the sidebar (no negative offsets that push it off-screen).
         * Opacity 0.22 so it's visible on dark backgrounds.
         */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-teal-400/[0.22] rounded-full blur-[80px] pointer-events-none" />
        {/* Layer 3 — Faint teal glow at bottom for colour continuity */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-teal-600/[0.09] blur-[40px] pointer-events-none" />
        {/* Layer 4 — Left-edge highlight strip: 1px gradient line gives a "lit" edge */}
        <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-teal-400/30 via-teal-500/15 to-transparent pointer-events-none" />
        {/* Layer 5 — Grain/noise texture at a just-perceptible opacity */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSIvPjwvc3ZnPg==')]"
        />

        <div className="relative z-10 flex flex-col h-full">
          {/*
           * Brand header.
           * Expanded: logo + name + CollapseTab (← chevron) all in one row.
           * Collapsed: logo centred alone. CollapseTab rendered as a small
           * pill underneath so it never competes with the logo for space
           * in a 64px-wide rail (36 + 8 + 28 = 72px would overflow).
           */}
          {isSidebarExpanded ? (
            <div className="flex items-center gap-2 px-3 py-4 border-b border-white/[0.08]">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-500 text-sm font-black shadow-lg shadow-teal-950/40">
                E
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-black leading-tight tracking-tight truncate">
                  {APP_NAME}
                </p>
                <p className="text-[10px] font-bold text-teal-400/80 tracking-[0.12em] uppercase mt-0.5">
                  {setupState.school.shortName ?? setupState.school.name}
                </p>
              </div>
              <CollapseTab
                isExpanded={isSidebarExpanded}
                onToggle={() => {
                  setIsSidebarExpanded((prev) => !prev);
                }}
              />
            </div>
          ) : (
            /* Collapsed: logo + expand-button stacked, centred in the 64px rail */
            <div className="flex flex-col items-center gap-1.5 py-3 border-b border-white/[0.08]">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500 text-sm font-black shadow-lg shadow-teal-950/40">
                E
              </div>
              <CollapseTab
                isExpanded={isSidebarExpanded}
                onToggle={() => {
                  setIsSidebarExpanded((prev) => !prev);
                }}
              />
            </div>
          )}

          {/* Navigation */}
          <nav
            aria-label={t('app.shell.navigation')}
            className="flex-1 overflow-y-auto px-2 py-4 space-y-0.5"
          >
            {/* Dashboard — always shown above the module group */}
            <NavButton
              icon={<DashboardIcon />}
              isActive={activeModule === null}
              isExpanded={isSidebarExpanded}
              label={t('app.shell.dashboard')}
              onClick={() => {
                setActiveModule(null);
              }}
            />

            {/* Module group label */}
            {isSidebarExpanded && enabledModuleNames.length > 0 && (
              <p className="px-3 pt-5 pb-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 select-none">
                {t('app.shell.modulesLabel')}
              </p>
            )}

            {enabledModuleNames.map((moduleName) => {
              const config = MODULE_NAV_CONFIG[moduleName];
              if (!config) return null;
              return (
                <NavButton
                  key={moduleName}
                  icon={config.icon}
                  isActive={activeModule === moduleName}
                  isExpanded={isSidebarExpanded}
                  label={t(config.labelKey)}
                  onClick={() => {
                    setActiveModule(moduleName);
                  }}
                />
              );
            })}

            {/* ── "Bientôt disponible" section ──────────────────────────────────── */}
            {/* Previews the app's full scope so the nav doesn't look sparse       */}
            {/* while modules are still shipping. Remove entries as they go live.  */}
            {isSidebarExpanded && (
              <p className="px-3 pt-5 pb-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-600/60 select-none">
                Bientôt {/* TODO: i18n — app.shell.comingSoonLabel */}
              </p>
            )}
            {COMING_SOON_NAV_ITEMS.map(({ label, icon }) => (
              <ComingSoonNavButton
                key={label}
                icon={icon}
                isExpanded={isSidebarExpanded}
                label={label}
              />
            ))}
          </nav>

          {/* Account chip — menu works in both expanded and collapsed states */}
          <div className="border-t border-white/[0.14] px-2 py-3">
            <AccountChip
              apiBaseUrl={apiBaseUrl}
              initials={initials}
              isExpanded={isSidebarExpanded}
              isMenuOpen={isAccountMenuOpen}
              logoutAction={logoutAction}
              role={t(`auth.roles.${user.role}`)}
              username={user.username}
              onCloseMenu={() => {
                setIsAccountMenuOpen(false);
              }}
              onToggleMenu={() => {
                setIsAccountMenuOpen((prev) => !prev);
              }}
            />
          </div>
        </div>

        {/* CollapseTab is now inside the brand header row (anchored top) */}
      </aside>

      {/* ------------------------------------------------------------------ */}
      {/* Main content column                                                  */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-1 flex-col min-w-0 min-h-0">
        {/* Top header — 1px slate-300 border + explicit shadow make it unambiguously chrome */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b-2 border-slate-100 bg-white px-5 z-20 gap-4 shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
          {/* Left: school name + term */}
          <div className="flex flex-col justify-center min-w-0 shrink-0">
            <p className="text-[13px] font-black leading-tight truncate text-slate-900">
              {setupState.school.name}
            </p>
            <p className="text-[11px] font-semibold text-slate-400 leading-tight">
              {setupState.academicYear?.label ?? ''}
              {currentTerm ? ` · ${currentTerm.label}` : ''}
            </p>
          </div>

          {/* Center: search / command-bar placeholder */}
          {/* TODO: wire up real search / ⌘K command palette (future roadmap item) */}
          <button
            aria-label="Rechercher" // TODO: i18n key — app.shell.header.search
            className="hidden md:flex flex-1 max-w-xs items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-[13px] text-slate-400 hover:border-slate-300 hover:bg-white transition-colors cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
            tabIndex={-1}
            type="button"
          >
            <SearchIcon />
            <span className="flex-1 text-left">Rechercher…</span>
            {/* TODO: i18n */}
            <kbd className="hidden sm:inline-flex items-center rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-400 leading-none">
              ⌘K
            </kbd>
          </button>

          {/* Right cluster — two distinct sub-groups separated by a hairline divider */}
          <div className="flex items-center gap-3 shrink-0">
            {/* ── System status ── */}
            <AppStatusPill
              label={serviceOnline ? t('app.shell.header.online') : t('app.shell.header.offline')}
              tone={serviceOnline ? 'green' : 'red'}
            />

            {/* Visual separator between "system" and "personal" clusters */}
            <div aria-hidden="true" className="h-5 w-px bg-slate-200" />

            {/* ── Personal cluster ── */}
            {/* Notification bell — placeholder; wire up when notifications module lands */}
            {/* TODO: connect to notifications module (future roadmap item) */}
            <button
              aria-label="Notifications" // TODO: i18n key — app.shell.header.notifications
              className="relative flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
              type="button"
            >
              <BellIcon />
              {/* Unread dot — teal with glow, consistent with brand accent */}
              <span
                aria-hidden="true"
                className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-teal-500 shadow-[0_0_6px_rgba(20,184,166,0.8)]"
              />
            </button>

            {/* Header avatar — always visible regardless of sidebar collapse state */}
            <button
              aria-label={user.username}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-500 text-[11px] font-black text-white shadow-sm hover:bg-teal-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
              type="button"
            >
              {initials}
            </button>
          </div>
        </header>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <WelcomePlaceholder />
        </main>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NavButton — left-edge active bar + visible hover/focus states
// ---------------------------------------------------------------------------

interface NavButtonProps {
  icon: React.ReactNode;
  isActive: boolean;
  isExpanded: boolean;
  label: string;
  onClick: () => void;
}

function NavButton({ icon, isActive, isExpanded, label, onClick }: NavButtonProps) {
  return (
    <button
      /*
       * Active state diverges between expanded and collapsed:
       * - Expanded: left-edge bar + teal fill (reads as a selected row).
       * - Collapsed: rounded-xl teal fill only, no left bar
       *   (reads as a "selected icon pill", not a leftover row artifact).
       * Native `title` provides the tooltip in collapsed mode.
       */
      className={`relative flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${
        isExpanded ? '' : 'justify-center'
      } ${
        isActive && isExpanded
          ? 'bg-teal-500/15 text-white before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-r-full before:bg-teal-400'
          : isActive && !isExpanded
            ? 'bg-teal-500/20 text-white'
            : 'text-slate-400 hover:bg-white/10 hover:text-slate-100'
      }`}
      onClick={onClick}
      title={isExpanded ? undefined : label}
      type="button"
    >
      <span
        className={`shrink-0 transition-colors ${isActive ? 'text-teal-400' : 'text-slate-500'}`}
      >
        {icon}
      </span>
      {isExpanded && <span className="truncate">{label}</span>}
    </button>
  );
}

// ---------------------------------------------------------------------------
// AccountChip + AccountMenu
// Consolidates: session card, standalone logout button, "Réduire le menu" row.
// ---------------------------------------------------------------------------

interface AccountChipProps {
  apiBaseUrl: string | null;
  initials: string;
  isExpanded: boolean;
  isMenuOpen: boolean;
  logoutAction: LogoutActionState;
  role: string;
  username: string;
  onCloseMenu: () => void;
  onToggleMenu: () => void;
}

function AccountChip({
  apiBaseUrl,
  initials,
  isExpanded,
  isMenuOpen,
  logoutAction,
  role,
  username,
  onCloseMenu,
  onToggleMenu,
}: AccountChipProps) {
  const { t } = useTranslation();
  const chipRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isMenuOpen) return;
    function handleOutsideClick(e: MouseEvent) {
      if (chipRef.current && !chipRef.current.contains(e.target as Node)) {
        onCloseMenu();
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isMenuOpen, onCloseMenu]);

  // Close on Escape
  useEffect(() => {
    if (!isMenuOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCloseMenu();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen, onCloseMenu]);

  return (
    <div ref={chipRef} className="relative">
      {/* Floating account menu — above chip when expanded, right of chip when collapsed */}
      {isMenuOpen && (
        <div
          className={`absolute z-50 w-52 rounded-2xl border border-white/10 bg-slate-800 shadow-xl shadow-black/50 overflow-hidden ${
            isExpanded ? 'bottom-full left-0 mb-2' : 'left-full bottom-0 ml-3'
          }`}
          role="menu"
        >
          {/* Identity header */}
          <div className="px-4 py-3 border-b border-white/10">
            <p className="text-[13px] font-black text-white truncate leading-tight">{username}</p>
            <p className="text-[11px] font-semibold text-teal-300/80 leading-tight">{role}</p>
          </div>

          {logoutAction.errorKey ? (
            <p className="mx-3 mt-2 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-[11px] font-bold text-red-200">
              {t(logoutAction.errorKey)}
            </p>
          ) : null}

          <div className="p-1.5">
            <button
              className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-bold text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!apiBaseUrl || logoutAction.isSubmitting}
              onClick={() => {
                void logoutAction.submit();
              }}
              role="menuitem"
              type="button"
            >
              <LogOutIcon />
              {logoutAction.isSubmitting ? t('auth.logout.submitting') : t('auth.logout.submit')}
            </button>
          </div>
        </div>
      )}

      {/* Chip trigger */}
      <button
        aria-expanded={isMenuOpen}
        aria-haspopup="menu"
        className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${
          isExpanded ? '' : 'justify-center'
        }`}
        onClick={onToggleMenu}
        type="button"
      >
        {/* Circular avatar — teal background, white initials */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-500 text-[11px] font-black text-white shadow-sm">
          {initials}
        </div>

        {isExpanded && (
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-black text-white truncate leading-tight">{username}</p>
            <p className="text-[11px] font-semibold text-teal-300/70 leading-tight">{role}</p>
          </div>
        )}

        {isExpanded && (
          <svg
            aria-hidden="true"
            className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform duration-200 ${
              isMenuOpen ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            viewBox="0 0 24 24"
          >
            <path d="M18 15l-6-6-6 6" />
          </svg>
        )}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CollapseTab — compact icon button sitting inside the brand header row.
// Anchored to the top of the sidebar, always visible, clearly purposeful.
// ---------------------------------------------------------------------------

interface CollapseTabProps {
  isExpanded: boolean;
  onToggle: () => void;
}

function CollapseTab({ isExpanded, onToggle }: CollapseTabProps) {
  const { t } = useTranslation();
  return (
    <button
      aria-label={isExpanded ? t('app.shell.collapse') : t('app.shell.expand')}
      className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/10 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
      onClick={onToggle}
      title={isExpanded ? t('app.shell.collapse') : t('app.shell.expand')}
      type="button"
    >
      <svg
        aria-hidden="true"
        className={`h-3.5 w-3.5 transition-transform duration-300 ${isExpanded ? '' : 'rotate-180'}`}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.5}
        viewBox="0 0 24 24"
      >
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
  );
}

// ---------------------------------------------------------------------------
// AppStatusPill
// ---------------------------------------------------------------------------

function AppStatusPill({ label, tone }: { label: string; tone: 'green' | 'red' }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold shadow-sm ${
        tone === 'green'
          ? 'border-teal-200/50 bg-teal-50 text-teal-800'
          : 'border-red-200/50 bg-red-50 text-red-700'
      }`}
    >
      <span
        className={`inline-flex h-1.5 w-1.5 rounded-full ${
          tone === 'green' ? 'bg-teal-500 shadow-[0_0_6px_rgba(20,184,166,0.8)]' : 'bg-red-500'
        }`}
      />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// WelcomePlaceholder — setup-complete entry moment.
// Teal left-border accent + check icon + fade-slide-in animation communicate success.
// ---------------------------------------------------------------------------

function WelcomePlaceholder() {
  const { t } = useTranslation();

  return (
    <div
      className="mx-auto max-w-2xl"
      style={{ animation: 'mash-fade-slide-in 0.45s cubic-bezier(0.16, 1, 0.3, 1) both' }}
    >
      {/* Scoped keyframe — avoids polluting global styles */}
      <style>{`
        @keyframes mash-fade-slide-in {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
      `}</style>

      <div className="rounded-3xl border border-white bg-white p-8 shadow-sm [border-left:4px_solid_theme(colors.teal.500)]">
        {/* Check icon — signals the successful setup completion */}
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-teal-100 bg-teal-50">
          <svg
            aria-hidden="true"
            className="h-6 w-6 text-teal-600"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            viewBox="0 0 24 24"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>

        <p className="text-xs font-black uppercase tracking-[0.22em] text-teal-700">
          {t('app.shell.welcome.eyebrow')}
        </p>
        <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
          {t('app.shell.welcome.title')}
        </h1>
        <p className="mt-3 text-sm font-medium leading-6 text-slate-500 max-w-lg">
          {t('app.shell.welcome.body')}
        </p>

        {/* Visual "coming soon" module grid placeholder */}
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {COMING_SOON_MODULES.map((label) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-3.5 opacity-55"
            >
              <span className="inline-flex h-2 w-2 rounded-full bg-slate-300" />
              <span className="text-[13px] font-bold text-slate-400">{label}</span>
              <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-slate-300">
                {/* no t() needed — this never shows a key; it's always the same short string */}
                bientôt
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Future module labels shown as "coming soon" placeholders in the content area.
 * These are hardcoded French strings deliberately — they are purely decorative
 * placeholder content that will be removed when real modules land.
 * They must NOT use i18n keys because no real SchoolModuleName exists for them yet.
 */
const COMING_SOON_MODULES = [
  'Élèves',
  'Enseignants',
  'Classes',
  'Notes et bulletins',
  'Finances',
  'Emploi du temps',
  'Rapports',
  'Sauvegarde',
] as const;

// ---------------------------------------------------------------------------
// ComingSoonNavButton — greyed-out nav item previewing upcoming modules.
// Deliberately non-interactive (aria-disabled) so it reads as "placeholder".
// Remove each entry from COMING_SOON_NAV_ITEMS as the real module ships.
// ---------------------------------------------------------------------------

function ComingSoonNavButton({
  icon,
  isExpanded,
  label,
}: {
  icon: React.ReactNode;
  isExpanded: boolean;
  label: string;
}) {
  return (
    <div
      aria-disabled="true"
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-bold text-slate-600/50 select-none cursor-default ${
        isExpanded ? '' : 'justify-center'
      }`}
      title={isExpanded ? undefined : label}
    >
      <span className="shrink-0 opacity-40">{icon}</span>
      {isExpanded && <span className="truncate flex-1">{label}</span>}
      {isExpanded && (
        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-600/40 shrink-0">
          bientôt
        </span>
      )}
    </div>
  );
}

/**
 * Sidebar preview of upcoming modules.
 * Icons reuse the same 24×24 / 2px-stroke pattern as active nav items.
 * Labels are hardcoded French — same rationale as COMING_SOON_MODULES above.
 * Remove an entry here when the matching module ships.
 */
const COMING_SOON_NAV_ITEMS: { label: string; icon: React.ReactNode }[] = [
  {
    label: 'Élèves',
    icon: (
      <svg
        aria-hidden="true"
        className="h-5 w-5 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    label: 'Enseignants',
    icon: (
      <svg
        aria-hidden="true"
        className="h-5 w-5 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <rect height="16" rx="2" width="20" x="2" y="4" />
        <path d="M10 4v4" />
        <path d="M2 8h20" />
        <path d="M6 12h.01M10 12h.01M14 12h.01M18 12h.01M6 16h.01M10 16h.01M14 16h.01M18 16h.01" />
      </svg>
    ),
  },
  {
    label: 'Notes & bulletins',
    icon: (
      <svg
        aria-hidden="true"
        className="h-5 w-5 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" x2="8" y1="13" y2="13" />
        <line x1="16" x2="8" y1="17" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    label: 'Finances',
    icon: (
      <svg
        aria-hidden="true"
        className="h-5 w-5 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <line x1="12" x2="12" y1="1" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    label: 'Rapports',
    icon: (
      <svg
        aria-hidden="true"
        className="h-5 w-5 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <line x1="18" x2="18" y1="20" y2="10" />
        <line x1="12" x2="12" y1="20" y2="4" />
        <line x1="6" x2="6" y1="20" y2="14" />
      </svg>
    ),
  },
];
