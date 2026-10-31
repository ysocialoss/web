const units = [
  { name: "decade", seconds: 315_360_000 },
  { name: "year", seconds: 31_536_000 },
  { name: "month", seconds: 2_592_000 },
  { name: "day", seconds: 86_400 },
  { name: "hour", seconds: 3_600 },
  { name: "minute", seconds: 60 },
  { name: "second", seconds: 1 },
];

export function relativeTime(timestamp: number, now: number) {
  const elapsed = Math.max(0, Math.floor((now - timestamp) / 1_000));
  const unit = units.find(unit => elapsed >= unit.seconds) ?? units[units.length - 1];
  const count = Math.floor(elapsed / unit.seconds);
  return `${count} ${unit.name}${count === 1 ? "" : "s"} ago`;
}
