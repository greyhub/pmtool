import { useEffect, useState, type RefObject } from 'react';

/**
 * Cell index (0-8) in a character's 3x3 `-directions` sprite sheet: up-left, up,
 * up-right / left, center, right / down-left, down, down-right. `dx`/`dy` point
 * from the icon to the cursor; inside the dead zone the character looks straight
 * ahead. Shared by every place a mascot "looks toward the cursor" (Gantt assignee
 * icons, animated Avatars) so the mapping never drifts between them.
 */
const CLOCKWISE_CELLS = [5, 8, 7, 6, 3, 0, 1, 2]; // right, down-right, down, down-left, left, up-left, up, up-right
export function aimCell(dx: number, dy: number, deadZone = 14): number {
  if (Math.hypot(dx, dy) < deadZone) return 4;
  const sector = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  return CLOCKWISE_CELLS[(sector + 8) % 8] ?? 4;
}

// One window listener shared by every subscribed icon (a page can hold dozens), coalesced to one update per frame.
const pointerSubscribers = new Set<(x: number, y: number) => void>();
let lastPointer: { x: number; y: number } | null = null;
let pointerFrame = 0;
function onPointerMove(e: PointerEvent) {
  lastPointer = { x: e.clientX, y: e.clientY };
  schedulePointerNotify();
}
function schedulePointerNotify() {
  if (pointerFrame || !lastPointer) return;
  pointerFrame = requestAnimationFrame(() => {
    pointerFrame = 0;
    const p = lastPointer;
    if (p) pointerSubscribers.forEach((fn) => fn(p.x, p.y));
  });
}
export function subscribePointer(fn: (x: number, y: number) => void): () => void {
  if (pointerSubscribers.size === 0) {
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    // Capture: the page/chart scrolls inside its own containers, which don't bubble to window.
    window.addEventListener('scroll', schedulePointerNotify, { passive: true, capture: true });
  }
  pointerSubscribers.add(fn);
  return () => {
    pointerSubscribers.delete(fn);
    if (pointerSubscribers.size === 0) {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('scroll', schedulePointerNotify, { capture: true });
    }
  };
}

/**
 * Which sprite cell an element should show given the live pointer position, updated at most once
 * per animation frame. Stays at the centre cell (4) on touch-only devices, which have no cursor.
 */
export function useAimCell(ref: RefObject<HTMLElement | null>): number {
  const [cell, setCell] = useState(4);
  useEffect(() => {
    if (
      typeof window.matchMedia !== 'function' ||
      !window.matchMedia('(hover: hover) and (pointer: fine)').matches
    ) {
      return;
    }
    return subscribePointer((x, y) => {
      const box = ref.current?.getBoundingClientRect();
      if (!box) return;
      setCell(aimCell(x - (box.left + box.width / 2), y - (box.top + box.height / 2)));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ref is a stable object identity
  }, []);
  return cell;
}
