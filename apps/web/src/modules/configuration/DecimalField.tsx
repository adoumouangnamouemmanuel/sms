import { useEffect, useRef, useState } from 'react';
import { formInputClassName } from '../people/ui';
import { formatHundredths, parseDecimalToHundredths } from './gradingFormat';

/**
 * Decimal (hundredths) input with a local draft while typing.
 *
 * The bound editors display values as normalized decimal strings and persist
 * integer hundredths. If the field re-formatted on every keystroke, typing
 * `15,99` would fight the normalization ("15," -> "15,00" -> cursor jump) and
 * multi-keystroke input would be mangled. This field keeps the raw text in
 * local state while focused and commits the parsed hundredths on blur (or
 * Enter), so free typing always works. The external value is re-synced when
 * it changes from outside while the field is not focused.
 */
export function DecimalField({
  ariaLabel,
  className,
  disabled,
  max,
  min,
  onChange,
  placeholder,
  value,
}: {
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  max?: number;
  min?: number;
  onChange: (hundredths: number) => void;
  placeholder?: string;
  value: number;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const focused = useRef(false);

  // Re-sync the draft when the external value changes while not editing.
  useEffect(() => {
    if (!focused.current) {
      setDraft(null);
    }
  }, [value]);

  const commit = (raw: string) => {
    const parsed = parseDecimalToHundredths(raw);

    // Unparseable input (empty or malformed) must not silently become 0 or the
    // scale maximum — revert to the last committed value instead.
    if (parsed === null) {
      setDraft(null);
      return;
    }

    const clamped =
      min !== undefined && max !== undefined
        ? Math.min(max * 100, Math.max(min * 100, parsed))
        : parsed;
    onChange(clamped);
    setDraft(null);
  };

  return (
    <input
      aria-label={ariaLabel}
      className={className ?? formInputClassName}
      disabled={disabled}
      max={max}
      min={min}
      onBlur={() => {
        focused.current = false;
        if (draft !== null) {
          commit(draft);
        }
      }}
      onChange={(event) => {
        setDraft(event.target.value);
      }}
      onFocus={() => {
        focused.current = true;
        setDraft(formatHundredths(value));
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur();
        }
      }}
      placeholder={placeholder}
      value={draft ?? formatHundredths(value)}
    />
  );
}
