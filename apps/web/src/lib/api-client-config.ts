import { configureApiClient } from '@pmtool/api-client';

configureApiClient({ baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001' });
