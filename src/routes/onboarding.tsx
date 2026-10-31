import { createSignal, onMount, Show } from 'solid-js';
import SimpleLayout from '~/components/SimpleLayout';
import { useAuth } from '~/lib/auth';
export default function Onboarding() {
  const { state, reload } = useAuth();
  const [handle, setHandle] = createSignal('');
  const [error, setError] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  async function load() {
    await reload();
    const current = state();
    if (current.kind === 'anonymous') { location.replace('/login'); return; }
    if (current.kind === 'signedIn') { location.replace('/'); return; }
    if (current.kind === 'onboarding' && !handle()) setHandle(current.suggestedHandle);
  }
  onMount(() => { void load(); });
  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (busy()) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/auth/profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ handle: handle() }) });
      if (response.ok) { location.replace('/'); return; }
      if (response.status === 401) { location.replace('/login'); return; }
      const body: unknown = await response.json();
      if (typeof body === 'object' && body !== null && 'error' in body && body.error === 'already_onboarded') { location.replace('/'); return; }
      setError(response.status === 409 ? 'That handle is taken. Please choose another.' : 'Could not save your handle. Please try again.');
    } catch { setError('Could not connect. Please try again.'); }
    finally { setBusy(false); }
  }
  return <SimpleLayout><main class="mx-auto max-w-lg px-6 py-12 text-white">
    <h1 class="mb-4 text-2xl">Choose your handle</h1>
    <p class="mb-6 text-neutral-400">Choose how people will find you on ysocial.</p>
    <Show when={state().kind !== 'loading'} fallback={<p role="status">Loading your account…</p>}>
      <Show when={state().kind === 'onboarding'} fallback={<button type="button" onClick={() => { void load(); }}>Retry account connection</button>}>
        <form onSubmit={submit} class="flex flex-col gap-4">
          <label class="flex flex-col gap-2">Handle<input name="handle" aria-describedby="handle-help" value={handle()} onInput={event => setHandle(event.currentTarget.value)} required minLength={3} maxLength={32} pattern="[a-z0-9_]{3,32}" disabled={busy()} class="rounded border border-neutral-600 bg-neutral-900 p-3" /></label>
          <p id="handle-help" class="text-sm text-neutral-400">3–32 lowercase letters, numbers, or underscores.</p>
          <button type="submit" disabled={busy()} class="rounded bg-white px-4 py-2 text-black disabled:opacity-50">{busy() ? 'Saving…' : 'Continue'}</button>
        </form>
      </Show>
    </Show>
    <Show when={error()}><p role="alert" class="mt-4 text-red-400">{error()}</p></Show>
  </main></SimpleLayout>;
}
