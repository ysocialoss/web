import type { ElementType } from "react";
import type { Paint } from "@/lib/api";
import { paintStyle } from "@/lib/paint";
import { cn } from "@/lib/utils";

type DisplayNameProps = {
  user: { displayName: string; paint?: Paint | null };
  /** handle fallback */
  name?: string;
  className?: string;
  as?: ElementType;
};

export function DisplayName({
  user,
  name = user.displayName,
  className,
  as: Component = "span",
}: DisplayNameProps) {
  const paint = user.paint;
  if (!paint) return <Component className={className}>{name}</Component>;
  return (
    <Component
      className={cn("[-webkit-box-decoration-break:clone] [box-decoration-break:clone]", className)}
      style={paintStyle(paint.definition)}
      title={paint.name}
    >
      {name}
    </Component>
  );
}
