import { OrgShell } from '../../../features/organizations/org-shell';

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  return <OrgShell orgSlug={orgSlug}>{children}</OrgShell>;
}
