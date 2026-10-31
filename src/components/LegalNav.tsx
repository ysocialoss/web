import { A } from "@solidjs/router";
import { For } from "solid-js";

export default function LegalNav() {
  return <footer class="footer text-[#888]">
    <nav aria-label="Legal navigation"><For each={["About", "Support", "Terms", "Privacy", "Imprint"]}>{label => <A href={`/legal/${label.toLowerCase()}`}>{label}</A>}</For><a href="https://git.ysocial.cc">Open Source</a></nav>
  </footer>;
}
