import type { ParentProps } from "solid-js";
import SimpleLayout from "~/components/SimpleLayout";

export default function LegalLayout(props: ParentProps) {
  return (
    <SimpleLayout>
      <main class="mx-auto w-full max-w-[1570px] flex-1 px-6 py-12 sm:px-10">
        {props.children}
      </main>
    </SimpleLayout>
  );
}
