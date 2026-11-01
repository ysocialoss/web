import { UserRound } from "~/components/Icons";

export default function Avatar(props: { large?: boolean; label?: string }) {
  return (
    <span
      aria-label={props.label || "Your avatar"}
      class={
        props.large
          ? "absolute top-[111px] right-5 size-[110px] rounded-[15px] border-[9px] border-[#111] object-cover max-[1701px]:right-[15px]"
          : "flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-[#282828] text-[#888]"
      }
    >
      <UserRound size={24} />
    </span>
  );
}
