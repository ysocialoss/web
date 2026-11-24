import { useContext, type ElementType } from "react";
import { NamePaintPreferencesContext, observeNamePaint } from "@/features/profile/paint-visibility";
import type { Paint } from "@/lib/api";
import { paintClassName, paintStyle } from "@/lib/paint";
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
  const { namePaintsDisabled, namePaintAnimationsDisabled } = useContext(NamePaintPreferencesContext);
  const paint = user.paint;
  if (!paint || namePaintsDisabled) {
    return <Component className={className}>{name}</Component>;
  }
  return (
    <Component
      ref={namePaintAnimationsDisabled ? undefined : observeNamePaint}
      className={cn(className, paintClassName)}
      style={paintStyle(paint.definition)}
      data-paint-static={namePaintAnimationsDisabled || undefined}
      data-paint-interpolation={paint.definition.kind === "linear" ? paint.definition.interpolation : undefined}
    >
      {name}
    </Component>
  );
}
