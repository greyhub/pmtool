import type { Config } from 'tailwindcss';
import { fontFamily, fontSize, fontWeight } from '../tokens/typography';

/**
 * Tailwind preset built from the semantic CSS variables in `light.css` /
 * `dark.css`. Components must only ever use the classes this generates
 * (`bg-surface`, `text-ink-primary`, `bg-action-primary`, ...) — never a raw
 * `bg-yellow-500` or hex value — so theming and contrast fixes happen in one
 * place (the two CSS files), not scattered across component code.
 */
const preset: Config = {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: [],
  theme: {
    extend: {
      fontFamily: { sans: fontFamily.sans.split(', ') },
      fontSize,
      fontWeight,
      colors: {
        canvas: 'var(--color-bg)',
        surface: {
          DEFAULT: 'var(--color-surface)',
          subtle: 'var(--color-surface-subtle)',
          glass: 'var(--color-surface-glass)',
          'glass-strong': 'var(--color-surface-glass-strong)',
        },
        line: {
          DEFAULT: 'var(--color-border-default)',
          strong: 'var(--color-border-strong)',
          glass: 'var(--color-border-glass)',
        },
        ink: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
          'on-primary': 'var(--color-text-on-primary)',
        },
        action: {
          primary: {
            // A function so opacity modifiers work (`bg-action-primary/15`); a bare var() colour silently ignores them.
            // Tailwind passes either a number or a CSS variable, so the percentage is computed in CSS.
            DEFAULT: (({ opacityValue }: { opacityValue?: string }) =>
              opacityValue === undefined
                ? 'var(--color-action-primary-bg)'
                : `color-mix(in srgb, var(--color-action-primary-bg) calc((${opacityValue}) * 100%), transparent)`) as unknown as string,
            hover: 'var(--color-action-primary-bg-hover)',
          },
          secondary: {
            DEFAULT: 'var(--color-action-secondary-bg)',
            hover: 'var(--color-action-secondary-bg-hover)',
          },
        },
        danger: { DEFAULT: 'var(--color-danger)', bg: 'var(--color-danger-bg)' },
        warning: { DEFAULT: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
        success: { DEFAULT: 'var(--color-success)', bg: 'var(--color-success-bg)' },
        info: { DEFAULT: 'var(--color-info)', bg: 'var(--color-info-bg)' },
        focus: 'var(--color-focus-ring)',
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      backgroundImage: {
        canvas: 'var(--gradient-canvas)',
      },
    },
  },
};

export default preset;
