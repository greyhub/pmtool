'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ApiError,
  useArtifact,
  useCreateArtifact,
  useDeleteArtifact,
  useUpdateArtifact,
} from '@pmtool/api-client';
import { Button, FormField, Input } from '@pmtool/ui';
import { useRouter } from '../../i18n/navigation';

const DEFAULT_CONTENT = '<!doctype html>\n<title>Untitled</title>\n<body>\n  <h1>Xin chào</h1>\n</body>\n';

export function ArtifactEditor({
  orgSlug,
  projectKey,
  artifactId,
}: {
  orgSlug: string;
  projectKey: string;
  artifactId?: string;
}) {
  const t = useTranslations('artifacts.editor');
  const router = useRouter();
  const isEditing = Boolean(artifactId);

  const { data: artifact, isLoading } = useArtifact(orgSlug, projectKey, artifactId);
  const createArtifact = useCreateArtifact(orgSlug, projectKey);
  const updateArtifact = useUpdateArtifact(orgSlug, projectKey);
  const deleteArtifact = useDeleteArtifact(orgSlug, projectKey);

  const [title, setTitle] = useState('');
  const [htmlContent, setHtmlContent] = useState(DEFAULT_CONTENT);

  useEffect(() => {
    if (!artifact) return;
    setTitle(artifact.title);
    setHtmlContent(artifact.htmlContent);
  }, [artifact]);

  const mutation = isEditing ? updateArtifact : createArtifact;

  function handleSave() {
    if (isEditing && artifactId) {
      updateArtifact.mutate({ artifactId, input: { title, htmlContent } });
    } else {
      createArtifact.mutate(
        { title, htmlContent },
        {
          onSuccess: (created) => {
            router.replace(`/${orgSlug}/projects/${projectKey}/artifacts/${created.id}`);
          },
        },
      );
    }
  }

  function handleDelete() {
    if (!artifactId) return;
    deleteArtifact.mutate(artifactId, {
      onSuccess: () => router.push(`/${orgSlug}/projects/${projectKey}/artifacts`),
    });
  }

  if (isEditing && isLoading) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <FormField label={t('titleLabel')} htmlFor="artifact-title" className="flex-1">
          <Input
            id="artifact-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('titlePlaceholder')}
          />
        </FormField>
        <div className="mt-6 flex shrink-0 gap-2">
          {isEditing && (
            <Button variant="outline" onClick={handleDelete} disabled={deleteArtifact.isPending}>
              {t('delete')}
            </Button>
          )}
          <Button onClick={handleSave} disabled={mutation.isPending}>
            {t('save')}
          </Button>
        </div>
      </div>

      {mutation.isError && (
        <p role="alert" className="text-sm text-danger">
          {mutation.error instanceof ApiError ? mutation.error.message : 'Có lỗi xảy ra'}
        </p>
      )}

      <div className="grid min-h-[540px] flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="artifact-html" className="text-sm font-medium text-ink-secondary">
            {t('htmlLabel')}
          </label>
          <textarea
            id="artifact-html"
            value={htmlContent}
            onChange={(e) => setHtmlContent(e.target.value)}
            spellCheck={false}
            className="h-full min-h-[500px] w-full flex-1 glass-field rounded-md border border-line-glass p-3 font-mono text-xs text-ink-primary outline-none focus-visible:ring-2 focus-visible:ring-focus"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-ink-secondary">{t('previewLabel')}</span>
          {/*
            SECURITY: never add allow-same-origin alongside allow-scripts.
            Without allow-same-origin the iframe gets a unique opaque
            origin: no access to the parent page's DOM or JS state, no
            cookies/localStorage for any real origin (including its own),
            and any fetch() it issues carries no credentials — the API's
            CORS config also pins a single fixed origin, so an
            Origin: null request from this iframe is rejected regardless.
            Do not add a postMessage listener on this page without
            validating event.origin and treating event.data as untrusted.
          */}
          <iframe
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            srcDoc={htmlContent}
            title={t('previewLabel')}
            className="h-full min-h-[500px] w-full flex-1 rounded-md border border-line bg-white"
          />
        </div>
      </div>
    </div>
  );
}
