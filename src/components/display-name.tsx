import { useContext, type ElementType } from "react";
import { type EveStar, EveStarBadge, useEveStar } from "@/features/advent/eve-star";
import { NamePaintPreferencesContext, observeNamePaint } from "@/features/profile/paint-visibility";
import type { Paint } from "@/lib/api";
import { paintClassName, paintStyle } from "@/lib/paint";
import { cn } from "@/lib/utils";

type DisplayNameProps = {
  user: { id?: string; displayName: string; paint?: Paint | null; eveStar?: EveStar | null };
  /** handle fallback */
  name?: string;
  className?: string;
  as?: ElementType;
  star?: boolean;
};

export function DisplayName({
  user,
  name = user.displayName,
  className,
  as: Component = "span",
  star: withStar = true,
}: DisplayNameProps) {
  const { namePaintsDisabled, namePaintAnimationsDisabled } = useContext(NamePaintPreferencesContext);
  const star = useEveStar(user);
  const paint = namePaintsDisabled ? null : user.paint;
  const shown = withStar ? star : null;
  const nameClassName = cn(className, paint && paintClassName, shown && "min-w-0 overflow-hidden text-ellipsis");
  const text = paint ? (
    <Component
      ref={namePaintAnimationsDisabled ? undefined : observeNamePaint}
      className={nameClassName}
      style={paintStyle(paint.definition)}
      data-paint-static={namePaintAnimationsDisabled || undefined}
      data-paint-interpolation={paint.definition.kind === "linear" ? paint.definition.interpolation : undefined}
    >
      {name}
    </Component>
  ) : (
    <Component className={nameClassName || undefined}>{name}</Component>
  );
  if (!shown) return text;
  return (
    <span className="inline-flex max-w-full min-w-0 items-center">
      {text}
      <EveStarBadge star={shown} className="ml-[0.3em]" />
    </span>
  );
}
