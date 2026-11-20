import { Construction } from "lucide-react";

export function ComingSoonContent({
  title,
  heading: Heading = "h2",
}: {
  title: string;
  heading?: "h1" | "h2";
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <Construction className="size-9 text-muted-foreground" aria-hidden="true" />
      <Heading className="text-xl font-semibold">{title}</Heading>
      <p className="text-sm text-muted-foreground">
        This part of ysocial is on its way.
      </p>
    </div>
  );
}
