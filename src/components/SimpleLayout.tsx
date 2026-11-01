import LegalNav from "~/components/LegalNav";
import { A } from "@solidjs/router";
import type { ParentProps } from "solid-js";

export default function SimpleLayout(props: ParentProps) {
  return (
    <div class="flex h-dvh flex-col overflow-y-auto bg-[#111111]">
      <header class="px-6 pt-[30px] sm:px-10">
        <nav aria-label="Home navigation" class="mx-auto max-w-[1570px]">
          <A href="/" aria-label="ysocial home" class="
            flex h-[58px] w-[156px] items-center transition-[transform,color,background-color,box-shadow,filter]
            duration-[180ms] hover:scale-[1.03] motion-reduce:transition-none motion-reduce:hover:scale-100
            [&_img]:block [&_img]:h-auto [&_img]:w-full max-[701px]:h-12 max-[701px]:w-[125px]
          ">
            <img src="/logo.png" alt="ysocial" />
          </A>
        </nav>
      </header>
      <div class="flex-1">{props.children}</div>
      <LegalNav />
    </div>
  );
}
