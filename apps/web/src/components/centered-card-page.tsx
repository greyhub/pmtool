import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@pmtool/ui';

export function CenteredCardPage({
  title,
  subtitle,
  maxWidth = 'max-w-sm',
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  maxWidth?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <Card className={`w-full ${maxWidth}`}>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {subtitle && <CardDescription>{subtitle}</CardDescription>}
        </CardHeader>
        <CardContent>
          {children}
          {footer && <div className="mt-6 text-center text-sm text-ink-secondary">{footer}</div>}
        </CardContent>
      </Card>
    </main>
  );
}
