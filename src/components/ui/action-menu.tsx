import type { ReactElement, ReactNode } from "react";
import { Link } from "react-router";
import type { LucideIcon } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ActionMenuItem = {
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  destructive?: boolean;
} & (
  | { kind: "link"; to: string; reloadDocument?: boolean }
  | { kind: "action"; onClick: () => void }
);

export function ActionMenu({
  trigger,
  title,
  items,
  hideTitle = false,
  large = false,
}: {
  trigger: ReactElement;
  title?: ReactNode;
  items: ActionMenuItem[];
  /** Keep the title for screen readers only, without a visible heading. */
  hideTitle?: boolean;
  large?: boolean;
}) {
  const mobile = useIsMobile();
  if (mobile) {
    return (
      <Drawer showSwipeHandle>
        <DrawerTrigger render={trigger} />
        <DrawerContent aria-describedby={undefined}>
          {hideTitle ? (
            <DrawerTitle className="sr-only">{title ?? "Menu"}</DrawerTitle>
          ) : (
            <DrawerHeader>
              <DrawerTitle>{title ?? "Menu"}</DrawerTitle>
            </DrawerHeader>
          )}
          <div className="overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {items.map(({ icon: Icon, ...item }) => (
              <DrawerClose
                key={item.label}
                nativeButton={item.kind !== "link"}
                role={item.kind === "link" ? "link" : undefined}
                disabled={item.disabled}
                onClick={item.kind === "action" ? item.onClick : undefined}
                render={
                  <Button
                    variant="ghost"
                    className={`${large ? "min-h-12 gap-3.5 text-base [&_svg:not([class*='size-'])]:size-5" : "min-h-12 gap-3 text-base"} w-full justify-start ${item.destructive ? "mt-2 border-t text-destructive hover:text-destructive" : ""}`}
                    nativeButton={item.kind !== "link"}
                    render={
                      item.kind === "link" ? (
                        <Link
                          to={item.to}
                          reloadDocument={item.reloadDocument}
                        />
                      ) : undefined
                    }
                  />
                }
              >
                <Icon aria-hidden="true" />
                {item.label}
              </DrawerClose>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger} />
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-52"
      >
        <DropdownMenuGroup aria-label={typeof title === "string" ? title : undefined}>
          {title && !hideTitle && <DropdownMenuLabel>{title}</DropdownMenuLabel>}
          {items.map(({ icon: Icon, ...item }) => (
            <div key={item.label}>
              {item.destructive && <DropdownMenuSeparator />}
              <DropdownMenuItem
                disabled={item.disabled}
                variant={item.destructive ? "destructive" : "default"}
                render={
                  item.kind === "link" ? (
                    <Link to={item.to} reloadDocument={item.reloadDocument} />
                  ) : undefined
                }
                onClick={item.kind === "action" ? item.onClick : undefined}
              >
                <Icon />
                {item.label}
              </DropdownMenuItem>
            </div>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
