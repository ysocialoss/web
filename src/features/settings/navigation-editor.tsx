import { useLayoutEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Eye,
  EyeOff,
  GripVertical,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  setShowHiddenNavigation,
  useShowHiddenNavigation,
} from "@/lib/show-hidden-navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  defaultNavigation,
  hiddenNavigation,
  navigation,
} from "@/components/layout/navigation";
import { api, errorMessage } from "@/lib/api";
import type { NavigationItem } from "@/lib/navigation-items";
import { cn } from "@/lib/utils";
import { useShortcutDrag } from "./use-shortcut-drag";

const reorderSpring = {
  type: "spring",
  stiffness: 460,
  damping: 34,
  mass: 0.72,
} as const;

export function NavigationEditor({
  userId,
  items,
  onSaved,
}: {
  userId: string;
  items: NavigationItem[] | null;
  onSaved: (userId: string, items: NavigationItem[] | null) => void;
}) {
  const showHidden = useShowHiddenNavigation();
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const [edits, setEdits] = useState<{
    items: NavigationItem[] | null;
  }>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hiddenHeadingRef = useRef<HTMLHeadingElement>(null);
  const hideButtons = useRef(new Map<NavigationItem, HTMLButtonElement>());
  const pendingFocus = useRef<NavigationItem | "hidden" | null>(null);
  const draft = edits ? edits.items : items;
  const shown = draft ?? defaultNavigation;
  const hidden = hiddenNavigation(shown, true);
  const {
    listRef,
    preview,
    start,
    move: moveDrag,
    cancel,
    finish,
  } = useShortcutDrag(move);
  const canDrag = !saving && shown.length > 1;
  const changed =
    draft === null || items === null
      ? draft !== items
      : draft.length !== items.length ||
        draft.some((id, index) => id !== items[index]);

  useLayoutEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    const element =
      target === "hidden"
        ? hiddenHeadingRef.current
        : hideButtons.current.get(target);
    element?.focus();
  }, [edits]);

  function move(from: number, to: number) {
    const item = shown[from];
    if (!item || from === to || to < 0 || to >= shown.length) return;
    const next = [...shown];
    next.splice(from, 1);
    next.splice(to, 0, item);
    setEdits({ items: next });
  }

  function close() {
    cancel();
    setEdits(undefined);
    setError("");
    setOpen(false);
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      await api.setNavigationItems(userId, draft);
      onSaved(userId, draft);
      close();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        if (next) setOpen(true);
        else close();
      }}
    >
      <DialogTrigger
        render={
          <button
            ref={triggerRef}
            type="button"
            aria-label="Customize navigation"
            className="flex w-full cursor-pointer items-center gap-4 px-4 py-3.5 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          />
        }
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">
            Customize navigation
          </span>
          <span className="mt-0.5 block text-sm text-muted-foreground">
            Set the shortcuts for your sidebar and mobile navigation bar.
          </span>
        </span>
        <ChevronRight
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground"
        />
      </DialogTrigger>
      <DialogContent
        className="max-h-[90dvh] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-md"
        finalFocus={triggerRef}
        showCloseButton={!saving}
      >
        <DialogHeader className="pr-8">
          <DialogTitle>Customize navigation</DialogTitle>
          <DialogDescription>
            Drag shortcuts by their handles or use the arrow buttons to reorder
            them.
          </DialogDescription>
        </DialogHeader>
        <div className="-mx-4 min-h-0 space-y-4 overflow-y-auto overscroll-contain px-4 py-1">
          <label className="flex items-center justify-between gap-3 text-sm font-medium">
            <span>Show hidden shortcuts in navigation</span>
            <Switch
              checked={showHidden}
              onCheckedChange={setShowHiddenNavigation}
            />
          </label>
          <div className="space-y-2">
            <h3 className="font-medium">Visible shortcuts</h3>
            {shown.length === 0 ? (
              <p className="py-2 text-muted-foreground">
                {showHidden
                  ? "All shortcuts are under Show hidden."
                  : "No shortcuts are visible in navigation."}
              </p>
            ) : (
              <ol
                ref={listRef}
                onPointerMove={moveDrag}
                onPointerUp={finish}
                onPointerCancel={cancel}
                onLostPointerCapture={cancel}
                aria-label="Navigation shortcuts"
                className="p-1"
              >
                {shown.map((id, index) => {
                  const { label, icon: Icon } = navigation[id];
                  const lifted = preview?.from === index;
                  const target = preview?.to === index && !lifted;
                  return (
                    <motion.li
                      key={id}
                      layout={reduceMotion ? false : "position"}
                      transition={{ layout: reorderSpring }}
                      className={cn("relative py-0.5", lifted && "z-10")}
                    >
                      <div
                        className={cn(
                          "relative flex min-h-10 items-center gap-1 rounded-xl bg-background/85 py-1 pr-2 shadow-[0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-foreground/5 transition-[background-color,box-shadow] duration-150 motion-reduce:transition-none",
                          lifted && "bg-popover shadow-lg ring-ring/70",
                          target && "bg-primary/10 ring-inset ring-primary/35",
                        )}
                        style={
                          lifted
                            ? {
                                transform: `translateY(${preview?.offset ?? 0}px)`,
                              }
                            : undefined
                        }
                      >
                        <motion.span
                          aria-hidden="true"
                          data-navigation-drag-handle=""
                          data-base-ui-swipe-ignore=""
                          className={cn(
                            "grid size-9 shrink-0 touch-none place-items-center text-muted-foreground select-none pointer-coarse:size-11",
                            canDrag
                              ? "cursor-grab active:cursor-grabbing"
                              : "opacity-50",
                          )}
                          onPointerDown={
                            canDrag ? (event) => start(event, index) : undefined
                          }
                          initial={false}
                          animate={{
                            scale: lifted && !reduceMotion ? 1.14 : 1,
                          }}
                          transition={
                            reduceMotion ? { duration: 0 } : reorderSpring
                          }
                        >
                          <GripVertical className="pointer-events-none size-4" />
                        </motion.span>
                        <Icon
                          aria-hidden="true"
                          className="size-4 shrink-0 text-muted-foreground"
                        />
                        <span className="min-w-0 flex-1 wrap-anywhere">
                          {label}
                        </span>
                        <div className="flex">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Move ${label} up`}
                            disabled={saving || index === 0}
                            focusableWhenDisabled={!saving}
                            className="data-disabled:opacity-50"
                            onClick={() => move(index, index - 1)}
                          >
                            <ArrowUp aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Move ${label} down`}
                            disabled={saving || index === shown.length - 1}
                            focusableWhenDisabled={!saving}
                            className="data-disabled:opacity-50"
                            onClick={() => move(index, index + 1)}
                          >
                            <ArrowDown aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            ref={(button) => {
                              if (button) hideButtons.current.set(id, button);
                              return () => {
                                hideButtons.current.delete(id);
                              };
                            }}
                            aria-label={`Hide ${label}`}
                            disabled={saving}
                            onClick={() => {
                              pendingFocus.current =
                                shown[index + 1] ??
                                shown[index - 1] ??
                                "hidden";
                              setEdits({
                                items: shown.filter((item) => item !== id),
                              });
                            }}
                          >
                            <EyeOff aria-hidden="true" />
                          </Button>
                        </div>
                      </div>
                    </motion.li>
                  );
                })}
              </ol>
            )}
          </div>
          {hidden.length > 0 && (
            <div className="space-y-2">
              <h3 ref={hiddenHeadingRef} tabIndex={-1} className="font-medium">
                Hidden shortcuts
              </h3>
              <div className="flex flex-wrap gap-2">
                {hidden.map((id) => (
                  <Button
                    key={id}
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={saving}
                    aria-label={`Show ${navigation[id].label}`}
                    onClick={() => {
                      pendingFocus.current = id;
                      setEdits({ items: [...shown, id] });
                    }}
                  >
                    <Eye aria-hidden="true" />
                    {navigation[id].label}
                  </Button>
                ))}
              </div>
            </div>
          )}
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={saving || draft === null}
            focusableWhenDisabled={!saving}
            className="data-disabled:opacity-50"
            onClick={() => setEdits({ items: null })}
          >
            Restore defaults
          </Button>
          <Button
            type="button"
            disabled={saving || !changed}
            onClick={() => void save()}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
