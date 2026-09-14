import { useTranslations } from 'next-intl';
import { CreateOrganizationForm } from '../../../../features/organizations/create-organization-form';
import { CenteredCardPage } from '../../../../components/centered-card-page';

export default function CreateOrganizationPage() {
  const t = useTranslations('onboarding.createOrganization');

  return (
    <CenteredCardPage title={t('title')} subtitle={t('subtitle')} maxWidth="max-w-md">
      <CreateOrganizationForm />
    </CenteredCardPage>
  );
}
