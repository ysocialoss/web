import {
  createSignal,
  Match,
  onCleanup,
  onMount,
  Show,
  Switch,
  createUniqueId,
} from "solid-js";
import { UserRound } from "~/components/Icons";
import { useAuth } from "~/lib/auth";
export default function AccountControls() {
  const { state, reload } = useAuth();
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal("");
  const [open, setOpen] = createSignal(false);
  const panelId = createUniqueId();
  let root: HTMLDivElement | undefined;
  let trigger: HTMLButtonElement | undefined;
  function close(restoreFocus = false) {
    setOpen(false);
    if (restoreFocus) trigger?.focus();
  }
  onMount(() => {
    void reload();
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root?.contains(event.target))
        close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open()) {
        event.preventDefault();
        close(true);
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    onCleanup(() => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    });
  });
  function handle() {
    const current = state();
    return current.kind === "signedIn" ? current.user.handle : "";
  }
  async function logout() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error();
      await reload();
      close(true);
    } catch {
      setError("Could not sign out. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      class="account-controls"
      ref={root}
      onFocusOut={(event) => {
        if (
          event.relatedTarget instanceof Node &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          close();
      }}
    >
      <button
        ref={trigger}
        type="button"
        class="account-trigger"
        aria-label="Account"
        aria-expanded={open()}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <UserRound size={24} />
      </button>
      <Show when={open()}>
        <div id={panelId} class="account-dropdown" aria-label="Account options">
          <p class="account-dropdown-title">Account</p>
          <div aria-live="polite">
            <Switch>
              <Match when={state().kind === "loading"}>
                <span>Loading account…</span>
              </Match>
              <Match when={state().kind === "anonymous"}>
                <a
                  class="account-dropdown-item"
                  href="/auth/login"
                  rel="external"
                >
                  Sign in with CNS
                </a>
              </Match>
              <Match when={state().kind === "unavailable"}>
                <button
                  class="account-dropdown-item"
                  type="button"
                  onClick={() => {
                    void reload();
                  }}
                >
                  Retry account connection
                </button>
              </Match>
              <Match when={state().kind === "onboarding"}>
                <a class="account-dropdown-item" href="/onboarding">
                  Choose your handle
                </a>
                <button
                  class="account-dropdown-item"
                  type="button"
                  disabled={busy()}
                  onClick={logout}
                >
                  Sign out
                </button>
              </Match>
              <Match when={state().kind === "signedIn"}>
                <p class="account-dropdown-handle">@{handle()}</p>
                <button
                  class="account-dropdown-item"
                  type="button"
                  disabled={busy()}
                  onClick={logout}
                >
                  {busy() ? "Signing out…" : "Sign out"}
                </button>
              </Match>
            </Switch>
            {error() && (
              <p role="alert" class="account-dropdown-error">
                {error()}
              </p>
            )}
          </div>
        </div>
      </Show>
    </div>
  );
}
