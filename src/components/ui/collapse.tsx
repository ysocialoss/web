import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const DURATION = 220;

export function Collapse({ open, children, className }: { open: boolean; children: ReactNode; className?: string }) {
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);
  const [settled, setSettled] = useState(open);
  if (open && !mounted) setMounted(true);
  if (!open && entered) setEntered(false);
  if (!open && settled) setSettled(false);

  useEffect(() => {
    if (!open) return;
    let second = 0;
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => setEntered(true)); });
    const done = setTimeout(() => setSettled(true), DURATION + 80);
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); clearTimeout(done); };
  }, [open]);
  useEffect(() => {
    if (open || !mounted) return;
    const gone = setTimeout(() => setMounted(false), DURATION + 40);
    return () => clearTimeout(gone);
  }, [open, mounted]);

  if (!mounted) return null;
  const visible = open && entered;
  return (
    <div
      inert={!open}
      className={cn(
        "grid shrink-0 transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none",
        visible ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        className,
      )}
    >
      <div className={cn("min-h-0", !(open && settled) && "overflow-hidden")}>{children}</div>
    </div>
  );
}
