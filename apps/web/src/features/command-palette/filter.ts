export interface PaletteItem {
  id: string;
  label: string;
  /** Extra text that should match but is not shown as the title (e.g. a task's key). */
  hint?: string;
  group: string;
  href: string;
}

/** Lower-cases and strips Vietnamese diacritics so "dang nhap" finds "Đăng nhập". */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase();
}

/** Every word of the query must appear (in any order) in the label or hint; earlier and label matches rank first. */
export function filterItems(items: PaletteItem[], query: string, limit = 30): PaletteItem[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return items.slice(0, limit);
  const scored: { item: PaletteItem; score: number }[] = [];
  for (const item of items) {
    const label = fold(item.label);
    const haystack = `${label} ${fold(item.hint ?? '')}`;
    if (!words.every((w) => haystack.includes(w))) continue;
    const starts = label.startsWith(words[0]!) ? 0 : 1;
    const inLabel = words.every((w) => label.includes(w)) ? 0 : 1;
    scored.push({ item, score: starts * 2 + inLabel });
  }
  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((s) => s.item);
}
