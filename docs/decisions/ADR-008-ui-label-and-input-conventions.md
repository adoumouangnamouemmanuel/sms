# ADR-008: UI Label and Input Conventions

## Status

Accepted

## Context

The Phase 3 §9.2 people module introduced form labels in uppercase small-caps while the setup wizard used bold normal-case labels. Review feedback asked for one explicit rule instead of ad-hoc choices per screen, and for inputs to match the established wizard styling.

## Decision

Two label styles exist and are both intentional. The deciding factor is whether the label is attached to an editable form control:

1. **Editable form field labels** (inputs, selects, textareas inside forms and modals): bold, normal-case, dark slate — `text-[13px] font-bold text-slate-800`, with a ` *` suffix for required fields. This matches the setup wizard's `SetupField` and `CalendarField`. Required markers use ` *`; optional fields carry no marker (the wizard sets this precedent).

2. **Display/data labels and section headers** (read-only info grids such as SEXE / DATE DE NAISSANCE, table column headers, and section headers such as RESPONSABLES LIÉS): uppercase small-caps micro labels — `text-[10px]/[11px]/[13px] font-black uppercase tracking-wide text-slate-400/500`. These are never attached to editable controls.

Input fields follow the wizard recipe: `h-[50px]` (48px in modal grids), `rounded-2xl`, `border-slate-200 bg-slate-50`, inset shadow, hover border, and the teal focus treatment (`focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-600/10`).

Date inputs in editable forms use the native `<input type="date">` so the browser renders the field in the user's locale format. The shared calendar picker (`apps/web/src/components/DatePicker.tsx`) remains available for the setup-wizard calendar step where a month-grid picker is part of the established flow. Read-only date displays format ISO values as DD/MM/YYYY via `formatISODate` from `apps/web/src/components/dateFormat.ts`.

List search inputs stay bound to the active query: the input value reflects the query state and is cleared only by an explicit clear control (an ✕ inside the field) or manual deletion — never as a side effect of submitting a search. This keeps the user oriented (filtered vs. full list) and supports refining an existing query.

Nationality is a curated dropdown of African countries (French names, Tchad as default), defined once in `apps/web/src/modules/students/countries.ts`. Country names are treated as data proper nouns kept in the product's primary locale rather than translated per i18n locale.

## Consequences

New forms and modules apply the label distinction: bold normal-case for editable field labels, uppercase small-caps only for display/descriptive labels. New forms use the native date input unless a calendar-grid picker is explicitly required. All visible strings stay behind i18n keys with French complete first (ADR-003).
