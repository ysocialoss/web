import { A } from "@solidjs/router";
import { HttpStatusCode } from "@solidjs/start";
import SimpleLayout from "~/components/SimpleLayout";

export default function NotFound() {
  return (
    <SimpleLayout>
      <HttpStatusCode code={404} />
      <main class="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-12">
        <h1 class="text-5xl font-semibold tracking-tight">404</h1>
        <A href="/" class="
          inline-flex transition-[transform,color,background-color,box-shadow,filter] duration-[180ms]
          motion-reduce:transition-none hover:brightness-[1.16] touch-manipulation items-center justify-center
          rounded-full font-semibold hover:scale-[1.01] active:scale-[0.97] motion-reduce:hover:scale-100
          motion-reduce:active:scale-100 bg-[#00d363] text-[#111111] h-[44px] px-6
        ">
          Back to feed
        </A>
      </main>
    </SimpleLayout>
  );
}
