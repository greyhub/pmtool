import { cn } from '../../lib/cn';

export interface LocaleOption {
  code: string;
  label: string;
}

export interface LocaleSwitcherProps {
  value: string;
  options: LocaleOption[];
  onChange: (code: string) => void;
  className?: string;
}

/** Presentational — the host app supplies the current locale and the navigation/routing side effect via onChange. */
export function LocaleSwitcher({ value, options, onChange, className }: LocaleSwitcherProps) {
  return (
    <select
      aria-label="Ngôn ngữ / Language"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'h-9 rounded-md border border-line bg-surface px-2 text-sm text-ink-primary outline-none transition-colors hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-focus',
        className,
      )}
    >
      {options.map((opt) => (
        <option key={opt.code} value={opt.code}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
