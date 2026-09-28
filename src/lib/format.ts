const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const isToday = (t: number, now = Date.now()) => new Date(t).toDateString() === new Date(now).toDateString();

/** "Sep 24" */
export function formatShortDate(t: number) {
  const d = new Date(t);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** "4:12 PM" */
export function formatTime(t: number) {
  const d = new Date(t);
  const h = d.getHours() % 12 || 12;
  return `${h}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

/** "Sep 28, 2026 · 9:41 PM" — the take naming rule (handoff §3.4). */
export function formatTakeStamp(t: number) {
  return `${formatShortDate(t)}, ${new Date(t).getFullYear()} · ${formatTime(t)}`;
}

/** "01:24" */
export function formatClock(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** "5:02" for durations in lists. */
export function formatDuration(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "week 4" since the song was added. */
export function weeksSince(t: number, now = Date.now()) {
  return Math.max(1, Math.ceil((now - t) / (7 * 86_400_000)));
}
