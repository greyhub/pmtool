'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useProject, useProjects, useTasks } from '@pmtool/api-client';
import { useRouter, usePathname } from '../../i18n/navigation';
import { filterItems, type PaletteItem } from './filter';

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

export function CommandPalette({ orgSlug }: { orgSlug: string }) {
  const t = useTranslations('palette');
  const tNav = useTranslations('nav');
  const tTabs = useTranslations('projects.tabs');
  const tGroups = useTranslations('projects.groups');
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const projectKey = /^\/[^/]+\/projects\/([^/]+)/.exec(pathname)?.[1];
  const { data: projects } = useProjects(open ? orgSlug : undefined);
  const { data: project } = useProject(open ? orgSlug : undefined, projectKey);
  const { data: tasks } = useTasks(open ? orgSlug : undefined, projectKey);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const items = useMemo<PaletteItem[]>(() => {
    const go = t('groups.go');
    const list: PaletteItem[] = [
      { id: 'n-dash', label: 'Dashboard', group: go, href: `/${orgSlug}/dashboard` },
      { id: 'n-my', label: tNav('myTasks'), group: go, href: `/${orgSlug}/my-tasks` },
      { id: 'n-projects', label: tNav('projects'), group: go, href: `/${orgSlug}/projects` },
      { id: 'n-board', label: tNav('leaderboard'), group: go, href: `/${orgSlug}/leaderboard` },
      { id: 'n-settings', label: tNav('orgSettings'), group: go, href: `/${orgSlug}/settings` },
    ];
    if (projectKey) {
      const base = `/${orgSlug}/projects/${projectKey}`;
      const views: [string, string][] = [
        ['dashboard', tGroups('overview')],
        ['reports', tGroups('report')],
        ['tasks', tGroups('list')],
        ['board', tTabs('board')],
        ...(project?.sprintsEnabled ? ([['sprints', tTabs('sprints')]] as [string, string][]) : []),
        ['gantt', tTabs('gantt')],
        ['milestones', tTabs('milestones')],
        ['scope', tTabs('scope')],
        ['wbs', tTabs('wbs')],
        ['charter', tTabs('charter')],
        ['deliverables', tTabs('deliverables')],
        ['risks', tTabs('risks')],
        ['stakeholders', tTabs('stakeholders')],
        ['documents', tTabs('documents')],
        ['artifacts', tTabs('artifacts')],
        ['settings', tTabs('settings')],
      ];
      for (const [path, label] of views) {
        list.push({ id: `v-${path}`, label, hint: projectKey, group: t('groups.views', { key: projectKey }), href: `${base}/${path}` });
      }
      for (const task of tasks ?? []) {
        list.push({ id: `t-${task.id}`, label: task.title, hint: task.humanKey, group: t('groups.tasks'), href: `${base}/tasks/${task.id}` });
      }
    }
    for (const p of projects ?? []) {
      list.push({ id: `p-${p.id}`, label: p.name, hint: p.key, group: t('groups.projects'), href: `/${orgSlug}/projects/${p.key}/dashboard` });
    }
    return list;
  }, [orgSlug, projectKey, project?.sprintsEnabled, projects, tasks, t, tNav, tTabs, tGroups]);

  const results = useMemo(() => filterItems(items, query), [items, query]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  function choose(item: PaletteItem | undefined) {
    if (!item) return;
    setOpen(false);
    setQuery('');
    router.push(item.href);
  }

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('open')}
        className="glass-field flex h-9 items-center gap-2 rounded-md border border-line-glass px-2.5 text-sm text-ink-muted transition-colors hover:text-ink-primary"
      >
        <SearchIcon />
        <span className="hidden lg:inline">{t('placeholderShort')}</span>
        <kbd className="hidden rounded border border-line-glass px-1 font-mono text-[10px] lg:inline">Ctrl K</kbd>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('title')}
            className="glass-strong relative z-10 flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-xl"
          >
            <div className="flex items-center gap-2 border-b border-line-glass px-4">
              <SearchIcon />
              <input
                ref={inputRef}
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKey}
                placeholder={t('placeholder')}
                aria-label={t('placeholder')}
                role="combobox"
                aria-expanded="true"
                aria-controls="palette-list"
                aria-activedescendant={results[active] ? `palette-${results[active]!.id}` : undefined}
                className="h-12 w-full bg-transparent text-sm text-ink-primary outline-none placeholder:text-ink-muted"
              />
            </div>
            <ul id="palette-list" role="listbox" ref={listRef} className="overflow-y-auto p-2">
              {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-ink-secondary">{t('empty')}</li>}
              {results.map((item, i) => (
                <li key={item.id} role="presentation">
                  {(i === 0 || results[i - 1]!.group !== item.group) && (
                    <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-ink-muted">{item.group}</p>
                  )}
                  <div
                    id={`palette-${item.id}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseMove={() => setActive(i)}
                    onClick={() => choose(item)}
                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-sm ${
                      i === active ? 'bg-warning-bg font-medium text-ink-primary' : 'text-ink-secondary'
                    }`}
                  >
                    <span className="truncate">{item.label}</span>
                    {item.hint && <span className="shrink-0 font-mono text-xs text-ink-muted">{item.hint}</span>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
