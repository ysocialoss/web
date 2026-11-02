import { A } from "@solidjs/router";
import { For } from "solid-js";

export default function LegalNav() {
  return (
    <footer class="
      col-span-full shrink-0 pt-[18px] pb-6 max-[1701px]:w-auto max-[1701px]:gap-[22px]
      max-[701px]:group-data-[dms]/page:pt-[14px] max-[701px]:group-data-[dms]/page:pb-[18px] [&_nav]:flex
      [&_nav]:flex-wrap [&_nav]:justify-center [&_nav]:gap-x-6 [&_nav]:gap-y-3 [&_a]:transition-colors
      [&_a]:duration-[160ms] [&_a]:underline-offset-4 [&_a]:hover:text-white [&_a]:hover:underline
      [&_a]:active:text-[#ccc] [&_a]:active:underline [&_a]:active:duration-[70ms]
      motion-reduce:[&_a]:transition-none max-[701px]:[&_nav]:gap-x-[18px] max-[701px]:[&_nav]:gap-y-2.5
      max-[701px]:[&_nav]:text-[13px] text-[#888]
    ">
      <nav aria-label="Legal navigation">
        <For each={["About", "Support", "Terms", "Privacy", "Imprint"]}>
          {(label) => <A href={`/legal/${label.toLowerCase()}`}>{label}</A>}
        </For>
        <a href="https://git.ysocial.cc">Open Source</a>
      </nav>
    </footer>
  );
}
