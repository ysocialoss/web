import NumberFlow from "@number-flow/react";
import { UserRound } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { countFormat } from "@/lib/count-format";

export function ProfileCard() {
  return (
    <section aria-labelledby="profile-heading">
      <div className="relative h-24 rounded-lg bg-linear-to-r from-green-500 to-green-950">
        <Avatar className="absolute -bottom-5 right-2 size-14 rounded-lg ring-4 ring-background after:rounded-lg">
          <AvatarFallback className="rounded-lg">
            <UserRound className="size-7" aria-hidden="true" />
          </AvatarFallback>
        </Avatar>
      </div>
      <div className="mt-7">
        <h2 id="profile-heading" className="text-sm font-semibold">
          User
        </h2>
        <p className="text-xs text-muted-foreground">@user</p>
        <dl className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {["posts", "followers", "following"].map((label) => (
            <div key={label} className="flex gap-1">
              <dd className="font-semibold">
                <NumberFlow
                  locales="en-US"
                  format={countFormat}
                  value={0}
                  className="tabular-nums"
                />
              </dd>
              <dt className="text-muted-foreground">{label}</dt>
            </div>
          ))}
        </dl>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge className="rounded-sm bg-red-600 text-white">Badge 1</Badge>
          <Badge className="rounded-sm bg-red-600 text-white">Badge 2</Badge>
        </div>
      </div>
    </section>
  );
}
