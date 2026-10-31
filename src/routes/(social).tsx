import type { ParentProps } from "solid-js";
import SocialLayout from "~/components/SocialLayout";

export default function SocialRoutes(props: ParentProps) {
  return <SocialLayout>{props.children}</SocialLayout>;
}
