'use client';

import { useEffect, useState } from 'react';
import { Gantt, Willow, WillowDark } from '@svar-ui/react-gantt';
import type { IApi } from '@svar-ui/react-gantt';
import { useTheme } from 'next-themes';
import '@svar-ui/react-gantt/style.css';
import './gantt-theme.css';

export type GanttLinkType = 's2s' | 's2e' | 'e2s' | 'e2e';

export interface GanttTaskInput {
  id: string;
  text: string;
  start: Date;
  end: Date;
  duration?: number;
  progress?: number;
  parent?: string;
  type?: 'task' | 'summary' | 'milestone';
}

export interface GanttLinkInput {
  id: string;
  source: string;
  target: string;
  type: GanttLinkType;
}

export interface GanttTaskUpdate {
  id: string;
  start?: Date;
  end?: Date;
  progress?: number;
}

export interface GanttChartProps {
  tasks: GanttTaskInput[];
  links: GanttLinkInput[];
  onTaskUpdate?: (update: GanttTaskUpdate) => void;
}

const scales = [
  { unit: 'month' as const, step: 1, format: '%F %Y' },
  { unit: 'day' as const, step: 1, format: '%j' },
];

/**
 * Thin wrapper around @svar-ui/react-gantt (MIT) so app code never imports
 * the library directly — swapping the underlying Gantt implementation later
 * stays a one-file change. Only syncs a change back via onTaskUpdate once a
 * drag/resize settles (`inProgress: false`), not on every intermediate frame.
 */
export function GanttChart({ tasks, links, onTaskUpdate }: GanttChartProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="h-96 rounded-lg border border-line bg-surface" />;
  }

  function handleInit(api: IApi) {
    api.on('update-task', (ev) => {
      if (ev.inProgress) return;
      onTaskUpdate?.({
        id: String(ev.id),
        start: ev.task.start,
        end: ev.task.end,
        progress: ev.task.progress,
      });
    });
  }

  const Skin = resolvedTheme === 'dark' ? WillowDark : Willow;

  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <Skin>
        <Gantt tasks={tasks} links={links} scales={scales} init={handleInit} />
      </Skin>
    </div>
  );
}
