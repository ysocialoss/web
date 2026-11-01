import { A } from "@solidjs/router";
import { HttpStatusCode } from "@solidjs/start";
import SimpleLayout from "~/components/SimpleLayout";

export default function NotFound() {
  return (
    <SimpleLayout>
      <HttpStatusCode code={404} />
      <main class="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-12">
        <h1 class="text-5xl font-semibold tracking-tight">404</h1>
        <A href="/" class="pill-button pill-button-primary h-[44px] px-6">
          Back to feed
        </A>
      </main>
    </SimpleLayout>
  );
}
