import type { ComponentProps } from "react";
import { Link } from "react-router";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function IconButton({
  label,
  size = "icon",
  variant = "ghost",
  ...props
}: ComponentProps<typeof Button> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button size={size} variant={variant} aria-label={label} {...props} />
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function IconLink({
  label,
  className,
  ...props
}: ComponentProps<typeof Link> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            aria-label={label}
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              className,
            )}
            {...props}
          />
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
