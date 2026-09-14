import { OrgShell } from '../../../features/organizations/org-shell';

export default function OrgLayout({
  children,
  params: { orgSlug },
}: {
  children: React.ReactNode;
  params: { orgSlug: string };
}) {
  return <OrgShell orgSlug={orgSlug}>{children}</OrgShell>;
}
