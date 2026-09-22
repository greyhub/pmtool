'use client';

import { useEffect, useState, type RefObject } from 'react';

export interface AnchoredPos {
  left: number;
  top: number;
}

/**
 * Screen position for a `position: fixed` menu/dropdown portaled to document.body and anchored to a
 * trigger element. Two earlier, simpler attempts both failed live:
 *  1. No scroll handling at all — the menu stayed put while the page scrolled, visibly detaching from
 *     its anchor (the trigger moves, the fixed-position menu doesn't).
 *  2. Closing on any "scroll" event — the browser's own scroll-anchoring correction (nudging scrollTop a
 *     few px to avoid jank when content reflows above the fold) fires an identical event and closed the
 *     menu the instant it opened, before a real interaction ever happened.
 * The fix neither guessed at: recompute the position on every scroll/resize instead of closing on it.
 * Only closes if the anchor scrolls fully out of the viewport, since there's nothing left to point at.
 */
export function useAnchoredMenu(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  place: (box: DOMRect) => AnchoredPos,
  onClose: () => void,
): AnchoredPos | null {
  const [pos, setPos] = useState<AnchoredPos | null>(null);

  useEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }

    const update = () => {
      const box = anchorRef.current?.getBoundingClientRect();
      if (!box) return;
      const outOfView =
        box.bottom < 0 ||
        box.top > window.innerHeight ||
        box.right < 0 ||
        box.left > window.innerWidth;
      if (outOfView) {
        onClose();
        return;
      }
      setPos(place(box));
    };
    update();

    // Coalesced to one recompute per frame — scroll fires far more often than the screen repaints.
    let frame = 0;
    const onScrollOrResize = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    // Capture: a scrollable panel nested inside the page doesn't bubble its own scroll event to window.
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    document.addEventListener('keydown', onKey);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
      document.removeEventListener('keydown', onKey);
    };
    // `place`/`onClose` intentionally excluded: both close over stable values (constants, or the setState
    // setter, which React guarantees is stable) for every caller here — re-running this whole effect on
    // every render would re-attach the listeners for no benefit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, anchorRef]);

  return pos;
}
