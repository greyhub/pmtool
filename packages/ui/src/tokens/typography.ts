/**
 * "Inter" covers Latin/English; "Be Vietnam Pro" is included as a fallback
 * with well-tested Vietnamese diacritic support (Inter's own diacritic
 * rendering is inconsistent across platforms) before the system stack.
 */
export const fontFamily = {
  sans: [
    'Inter',
    'Be Vietnam Pro',
    '-apple-system',
    'BlinkMacSystemFont',
    'Segoe UI',
    'Roboto',
    'Helvetica Neue',
    'Arial',
    'sans-serif',
  ].join(', '),
};

type FontSizeEntry = [string, { lineHeight: string }];

// Not `as const`: Tailwind's own `fontSize` config type wants mutable tuples.
export const fontSize: Record<'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl', FontSizeEntry> = {
  xs: ['12px', { lineHeight: '16px' }],
  sm: ['14px', { lineHeight: '20px' }],
  base: ['16px', { lineHeight: '24px' }],
  lg: ['18px', { lineHeight: '28px' }],
  xl: ['20px', { lineHeight: '28px' }],
  '2xl': ['24px', { lineHeight: '32px' }],
  '3xl': ['30px', { lineHeight: '36px' }],
};

export const fontWeight = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;
