/** A member is "online" if they were active within this window. Shared (not DI'd) so mappers can use it too. */
export const ONLINE_WINDOW_MS = 3 * 60 * 1000;

export function isOnline(lastActiveAt: Date | null): boolean {
  return (
    lastActiveAt !== null &&
    Date.now() - lastActiveAt.getTime() < ONLINE_WINDOW_MS
  );
}
