import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Workspace packages must go through Next's own webpack build (not be
  // treated as external `require()`s) so React context providers (e.g.
  // QueryClientProvider) share a single module instance with the app.
  // The app does not use next/image; turning the optimizer endpoint off removes that attack surface.
  images: { unoptimized: true },
  // Do not advertise the framework in every response.
  poweredByHeader: false,
  transpilePackages: ['@pmtool/shared-types', '@pmtool/api-client', '@pmtool/ui'],
};

export default withNextIntl(nextConfig);
