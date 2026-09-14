import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Workspace packages must go through Next's own webpack build (not be
  // treated as external `require()`s) so React context providers (e.g.
  // QueryClientProvider) share a single module instance with the app.
  transpilePackages: ['@pmtool/shared-types', '@pmtool/api-client'],
};

export default withNextIntl(nextConfig);
