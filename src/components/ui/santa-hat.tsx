import { useSantaHats } from "@/lib/branding";
import { cn } from "@/lib/utils";

export function SantaHat({ className }: { className?: string }) {
  const { active } = useSantaHats();
  if (!active) return null;
  return (
    <img
      src="/santa-hat.svg"
      alt=""
      aria-hidden="true"
      draggable={false}
      className={cn(
        "pointer-events-none absolute top-[-44%] left-[50%] z-10 w-[85%] max-w-none rotate-[10deg] select-none",
        className,
      )}
    />
  );
}
