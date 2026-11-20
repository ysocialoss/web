"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { XIcon } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAnimatedPopupHeight } from "@/hooks/use-animated-popup-height";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerOverlay,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

const DialogMobileContext = React.createContext(false);

type DialogProps = Omit<
  DialogPrimitive.Root.Props,
  "handle" | "onOpenChange"
> & {
  onOpenChange?: (
    open: boolean,
    details:
      | DialogPrimitive.Root.ChangeEventDetails
      | Parameters<
          NonNullable<React.ComponentProps<typeof Drawer>["onOpenChange"]>
        >[1],
  ) => void;
};

function Dialog({ ...props }: DialogProps) {
  const mobile = useIsMobile();
  return (
    <DialogMobileContext.Provider value={mobile}>
      {mobile ? (
        <Drawer showSwipeHandle {...props} />
      ) : (
        <DialogPrimitive.Root data-slot="dialog" {...props} />
      )}
    </DialogMobileContext.Provider>
  );
}

function DialogTrigger({
  ...props
}: Omit<DialogPrimitive.Trigger.Props, "handle">) {
  const mobile = React.useContext(DialogMobileContext);
  if (mobile) return <DrawerTrigger {...props} />;
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  const mobile = React.useContext(DialogMobileContext);
  if (mobile) return <DrawerPortal {...props} />;
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  const mobile = React.useContext(DialogMobileContext);
  if (mobile) return <DrawerClose {...props} />;
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  const mobile = React.useContext(DialogMobileContext);
  if (mobile) return <DrawerOverlay className={className} {...props} />;
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className,
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  ref,
  showCloseButton = true,
  ...props
}: Omit<DialogPrimitive.Popup.Props, "render" | "className" | "style"> &
  Pick<React.ComponentProps<"div">, "className" | "style"> & {
    showCloseButton?: boolean;
  }) {
  const mobile = React.useContext(DialogMobileContext);
  const animatedRef = useAnimatedPopupHeight(ref);
  if (mobile) {
    return (
      <DrawerContent ref={ref} {...props}>
        <div
          className={cn(
            "relative grid min-h-0 gap-4 overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))]",
            className,
            "w-full max-w-none",
          )}
        >
          {children}
          {showCloseButton && (
            <DrawerClose
              render={
                <Button
                  variant="ghost"
                  className="absolute top-1 right-2 size-11"
                  size="icon"
                />
              }
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </DrawerClose>
          )}
        </div>
      </DrawerContent>
    );
  }
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        ref={animatedRef}
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          "data-resizing:overflow-hidden [&:is(.overflow-auto,.overflow-y-auto)]:[scrollbar-gutter:stable]",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-2 right-2"
                size="icon-sm"
              />
            }
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean;
}) {
  const mobile = React.useContext(DialogMobileContext);
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 md:flex-row md:justify-end",
        mobile && "*:min-h-12 *:w-full *:text-base",
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogClose render={<Button variant="outline" />}>Close</DialogClose>
      )}
    </div>
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  const mobile = React.useContext(DialogMobileContext);
  if (mobile) return <DrawerTitle className={className} {...props} />;
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-none font-medium",
        className,
      )}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  const mobile = React.useContext(DialogMobileContext);
  if (mobile) return <DrawerDescription className={className} {...props} />;
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
