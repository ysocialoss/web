import { createEffect, createSignal, For, on, Show, untrack } from "solid-js";

import { formatCount } from "~/lib/format-count";

type AnimatedCountProps = { value: number };

/** Rolls only changed digits, aligning their positions from the right. */
export default function AnimatedCount(props: AnimatedCountProps) {
  const [frame, setFrame] = createSignal<{
    value: number;
    previous: number | null;
    direction: "up" | "down";
  }>({ value: props.value, previous: null, direction: "up" });

  createEffect(
    on(
      () => props.value,
      (value) => {
        const previous = untrack(frame).value;
        if (value === previous) return;
        setFrame({
          value,
          previous,
          direction: value >= previous ? "up" : "down",
        });
      },
      { defer: true },
    ),
  );

  return (
    <span
      class="animated-count"
      aria-label={String(props.value)}
      title={props.value.toLocaleString("en")}
    >
      <Show when={frame()} keyed>
        {(current) => {
          const value = formatCount(current.value);
          const previous =
            current.previous === null ? value : formatCount(current.previous);
          const width = Math.max(value.length, previous.length);
          const nextDigits = value.padStart(width, " ").split("");
          const previousDigits = previous.padStart(width, " ").split("");
          return (
            <span class="animated-count-digits" aria-hidden="true">
              <For each={nextDigits}>
                {(digit, index) => {
                  const oldDigit = previousDigits[index()] ?? " ";
                  const changed =
                    current.previous !== null && digit !== oldDigit;
                  return (
                    <span
                      class="animated-count-stack"
                      classList={{ "count-changing": changed }}
                      data-direction={current.direction}
                    >
                      <Show when={changed}>
                        <span class="count-previous">{oldDigit.trim()}</span>
                      </Show>
                      <span class="count-current">{digit.trim()}</span>
                    </span>
                  );
                }}
              </For>
            </span>
          );
        }}
      </Show>
    </span>
  );
}
