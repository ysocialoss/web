import { ANNIVERSARY_MESSAGE } from "@/lib/branding";
import { cn } from "@/lib/utils";
import { useCelebrations } from "@/lib/celebrations";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

export function SantaHat() {
  const { anniversary, christmasSeason, hatSide } = useCelebrations();
  if (anniversary)
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <img
              src="/party-hat.svg"
              alt=""
              draggable={false}
              className={cn(
                "absolute top-[-72%] z-10 w-[63%] max-w-none select-none",
                hatSide === "left" ? "left-[-31%] rotate-[-28deg]" : "left-[68%] rotate-[28deg]",
              )}
            />
          }
        />
        <TooltipContent>{ANNIVERSARY_MESSAGE}</TooltipContent>
      </Tooltip>
    );
  if (!christmasSeason) return null;
  return (
    <img
      src="/santa-hat.svg"
      alt=""
      aria-hidden="true"
      draggable={false}
      className="pointer-events-none absolute top-[-44%] left-[50%] z-10 w-[85%] max-w-none rotate-[10deg] select-none"
    />
  );
}
