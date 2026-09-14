/**
 * Primitive color scales — raw values only. Never reference these directly
 * from components; consume the semantic tokens in `theme/light.css` /
 * `theme/dark.css` (exposed as Tailwind classes like `bg-surface`,
 * `text-primary`, `bg-action-primary`) instead.
 */
export const yellow = {
  50: '#fffbeb',
  100: '#fef3c7',
  200: '#fde68a',
  300: '#fcd34d',
  400: '#fbbf24',
  500: '#f59e0b',
  600: '#d97706',
  700: '#b45309',
  800: '#92400e',
  900: '#78350f',
  950: '#451a03',
} as const;

export const gray = {
  50: '#f9fafb',
  100: '#f3f4f6',
  200: '#e5e7eb',
  300: '#d1d5db',
  400: '#9ca3af',
  500: '#6b7280',
  600: '#4b5563',
  700: '#374151',
  800: '#1f2937',
  900: '#111827',
  950: '#0a0e14',
} as const;

export const red = {
  50: '#fef2f2',
  400: '#f87171',
  600: '#dc2626',
  900: '#450a0a',
} as const;

export const green = {
  50: '#f0fdf4',
  400: '#4ade80',
  600: '#16a34a',
  900: '#052e16',
} as const;

export const blue = {
  50: '#eff6ff',
  400: '#60a5fa',
  600: '#2563eb',
  900: '#1e3a8a',
} as const;
