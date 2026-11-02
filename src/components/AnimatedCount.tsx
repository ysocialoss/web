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
      class="inline-grid overflow-hidden align-middle tabular-nums leading-[1.4]"
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
            <span class="inline-flex" aria-hidden="true">
              <For each={nextDigits}>
                {(digit, index) => {
                  const oldDigit = previousDigits[index()] ?? " ";
                  const changed =
                    current.previous !== null && digit !== oldDigit;
                  return (
                    <span
                      class="group/count grid overflow-hidden [--count-enter:100%] [--count-exit:-100%] data-[direction=down]:[--count-enter:-100%] data-[direction=down]:[--count-exit:100%]"
                      data-changing={changed}
                      data-direction={current.direction}
                    >
                      <Show when={changed}>
                        <span class="[grid-area:1/1] text-left group-data-[changing=true]/count:animate-[count-exit_380ms_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none! motion-reduce:invisible">{oldDigit.trim()}</span>
                      </Show>
                      <span class="[grid-area:1/1] text-left group-data-[changing=true]/count:animate-[count-enter_380ms_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none!">{digit.trim()}</span>
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
