import { createSignal, onCleanup, onMount } from "solid-js";
import { relativeTime } from "~/lib/relative-time";

export default function RelativeTime(props: { timestamp: number }) {
  const [now, setNow] = createSignal(Date.now());
  onMount(() => {
    const interval = setInterval(() => setNow(Date.now()), 1_000);
    onCleanup(() => clearInterval(interval));
  });
  return <time class="ml-auto whitespace-nowrap font-light" dateTime={new Date(props.timestamp).toISOString()} title={new Date(props.timestamp).toLocaleString("en-GB")}>
    {relativeTime(props.timestamp, now())}
  </time>;
}
