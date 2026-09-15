import { Card, CardContent, CardHeader, CardTitle } from '@pmtool/ui';

export function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'danger';
}) {
  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-medium text-ink-secondary">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={tone === 'danger' && value > 0 ? 'text-3xl font-semibold text-danger' : 'text-3xl font-semibold text-ink-primary'}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
