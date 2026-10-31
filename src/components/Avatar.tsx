import { UserRound } from "~/components/Icons";

export default function Avatar(props: { large?: boolean }) {
  return <span aria-label="Your avatar" class={props.large ? "profile-avatar" : "flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-[#282828] text-[#888]"}><UserRound size={24} /></span>;
}
