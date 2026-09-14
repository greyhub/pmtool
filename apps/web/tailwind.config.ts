import type { Config } from 'tailwindcss';
import uiPreset from '@pmtool/ui/tailwind-preset';

const config: Config = {
  presets: [uiPreset],
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
    '../../packages/ui/dist/**/*.js',
  ],
  plugins: [],
};
export default config;
