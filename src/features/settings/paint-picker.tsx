import { useEffect, useState } from "react";
import { Check, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DisplayName } from "@/components/display-name";
import { api, ApiError, errorMessage, type CatalogPaint, type Paint } from "@/lib/api";
import { cn } from "@/lib/utils";
import { updateAuthor } from "@/features/feed/optimistic-actions";

type PaintUser = {
  id: string;
  handle: string;
  displayName: string;
  paint: Paint | null;
};

export function PaintPicker({ user }: { user: PaintUser }) {
  const [paints, setPaints] = useState<CatalogPaint[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saving, setSaving] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(user.paint?.id ?? null);
  const name = user.displayName || user.handle;

  useEffect(() => {
    const controller = new AbortController();
    api
      .paints(controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setPaints(result.paints);
        setLoadError("");
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setLoadError(errorMessage(reason));
      });
    return () => controller.abort();
  }, [user.id, loadAttempt]);

  async function choose(paint: CatalogPaint | null) {
    const paintId = paint?.id ?? null;
    if (saving !== undefined || paintId === selectedId) return;
    setSaving(paintId);
    setError("");
    try {
      const session = await api.session();
      if (!session.authenticated || session.needsOnboarding || session.user.id !== user.id)
        throw new ApiError(403, "retry_account_changed");
      await api.setPaint(paintId);
      const equipped = paint ? { id: paint.id, name: paint.name, definition: paint.definition } : null;
      updateAuthor(user.id, { paint: equipped });
      setSelectedId(paintId);
    } catch (reason) {
      setError(errorMessage(reason));
      // Ownership may have changed (for example a revoked paint), so refresh the catalog.
      if (reason instanceof ApiError && reason.status === 403) setLoadAttempt((current) => current + 1);
    } finally {
      setSaving(undefined);
    }
  }

  const options: { key: string; paint: CatalogPaint | null }[] = [
    { key: "none", paint: null },
    ...(paints ?? []).map((paint) => ({ key: paint.id, paint })),
  ];

  return (
    <section className="space-y-3 border-t pt-3" aria-labelledby="paint-picker-heading gay">
      <div>
        <h2 id="paint-picker-heading" className="font-semibold">
          Name paint
        </h2>
        <p className="text-muted-foreground">
          A paint for your display name, shown wherever your name appears.
        </p>
      </div>
      {loadError && !paints ? (
        <div role="alert" className="space-y-1 text-destructive">
          <p>{loadError}</p>
          <Button variant="outline" onClick={() => setLoadAttempt((current) => current + 1)}>
            Retry paints
          </Button>
        </div>
      ) : !paints ? (
        <p role="status" className="text-muted-foreground">
          Loading paints…
        </p>
      ) : (
        <div role="radiogroup" aria-labelledby="paint-picker-heading" className="grid grid-cols-2 gap-2">
          {options.map(({ key, paint }) => {
            const selected = (paint?.id ?? null) === selectedId;
            const locked = paint !== null && !paint.owned;
            const pending = saving !== undefined && saving === (paint?.id ?? null);
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-disabled={locked || undefined}
                disabled={locked || saving !== undefined}
                title={locked ? `${paint.name} is locked` : undefined}
                onClick={() => void choose(paint)}
                className={cn(
                  "flex min-w-0 flex-col items-start gap-1 rounded-lg border p-2.5 text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                  selected ? "border-foreground bg-muted" : "hover:bg-muted",
                  locked && "cursor-not-allowed opacity-50 grayscale-60 hover:bg-transparent",
                  pending && "animate-pulse",
                )}
              >
                <DisplayName
                  user={{ displayName: name, paint }}
                  className="max-w-full truncate font-semibold"
                />
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  {locked && <Lock className="size-3" aria-hidden="true" />}
                  {selected && <Check className="size-3" aria-hidden="true" />}
                  {paint ? paint.name : "None"}
                  {locked && <span className="sr-only"> (locked)</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
