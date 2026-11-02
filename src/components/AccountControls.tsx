import { A } from "@solidjs/router";
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
import { useSocial } from "~/lib/social-context";
export default function AccountControls() {
  const { auth: state, reloadAuth: reload } = useSocial();
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
      class="relative"
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
        class="relative isolate -my-[1.5px] flex size-11 items-center justify-center rounded-[5px] bg-[#202020] focus-visible:outline-[#00d363] focus-visible:outline-offset-2"
        aria-label="Account"
        aria-expanded={open()}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <UserRound size={24} />
      </button>
      <Show when={open()}>
        <div id={panelId} class="absolute top-[calc(100%+12px)] right-0 z-50 w-[min(260px,calc(100vw-40px))] rounded-[10px] border border-[#343434] bg-[#202020] p-2 text-[14px] shadow-[0_12px_35px_#0008]" aria-label="Account options">
          <p class="px-3 py-2 text-[12px] text-[#999]">Account</p>
          <div aria-live="polite">
            <Switch>
              <Match when={state().kind === "loading"}>
                <span>Loading account…</span>
              </Match>
              <Match when={state().kind === "anonymous"}>
                <a
                  class="
                    block w-full rounded-md px-3 py-2.5 text-left text-[#f5f5f5] hover:bg-[#303030]
                    focus-visible:bg-[#303030] focus-visible:outline-[#00d363] focus-visible:outline-offset-2
                    disabled:cursor-wait disabled:opacity-50
                  "
                  href="/auth/login"
                  rel="external"
                >
                  Sign in with CNS
                </a>
              </Match>
              <Match when={state().kind === "unavailable"}>
                <button
                  class="
                    block w-full rounded-md px-3 py-2.5 text-left text-[#f5f5f5] hover:bg-[#303030]
                    focus-visible:bg-[#303030] focus-visible:outline-[#00d363] focus-visible:outline-offset-2
                    disabled:cursor-wait disabled:opacity-50
                  "
                  type="button"
                  onClick={() => {
                    void reload();
                  }}
                >
                  Retry account connection
                </button>
              </Match>
              <Match when={state().kind === "onboarding"}>
                <a class="
                  block w-full rounded-md px-3 py-2.5 text-left text-[#f5f5f5] hover:bg-[#303030]
                  focus-visible:bg-[#303030] focus-visible:outline-[#00d363] focus-visible:outline-offset-2
                  disabled:cursor-wait disabled:opacity-50
                " href="/onboarding">
                  Choose your handle
                </a>
                <button
                  class="
                    block w-full rounded-md px-3 py-2.5 text-left text-[#f5f5f5] hover:bg-[#303030]
                    focus-visible:bg-[#303030] focus-visible:outline-[#00d363] focus-visible:outline-offset-2
                    disabled:cursor-wait disabled:opacity-50
                  "
                  type="button"
                  disabled={busy()}
                  onClick={logout}
                >
                  Sign out
                </button>
              </Match>
              <Match when={state().kind === "signedIn"}>
                <A class="block px-3 py-2 font-semibold hover:underline [overflow-wrap:anywhere]" href={`/profile/${handle()}`} onClick={() => close()}>View your profile</A>
                <button
                  class="
                    block w-full rounded-md px-3 py-2.5 text-left text-[#f5f5f5] hover:bg-[#303030]
                    focus-visible:bg-[#303030] focus-visible:outline-[#00d363] focus-visible:outline-offset-2
                    disabled:cursor-wait disabled:opacity-50
                  "
                  type="button"
                  disabled={busy()}
                  onClick={logout}
                >
                  {busy() ? "Signing out…" : "Sign out"}
                </button>
              </Match>
            </Switch>
            {error() && (
              <p role="alert" class="px-3 py-2 text-red-300">
                {error()}
              </p>
            )}
          </div>
        </div>
      </Show>
    </div>
  );
}
