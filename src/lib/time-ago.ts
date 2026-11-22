const units = [
  { ms: 86_400_000, one: "a day", many: "days" },
  { ms: 3_600_000, one: "an hour", many: "hours" },
  { ms: 60_000, one: "a minute", many: "minutes" },
];

export function timeAgo(date: Date | string | number, now: number = Date.now()) {
  const elapsed = Math.max(0, now - new Date(date).getTime());
  for (const unit of units) {
    if (elapsed < unit.ms) continue;
    const count = Math.floor(elapsed / unit.ms);
    return count === 1 ? `${unit.one} ago` : `${count} ${unit.many} ago`;
  }
  return "now";
}
