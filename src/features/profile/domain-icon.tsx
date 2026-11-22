import { useState } from "react";
import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";

export function DomainIcon({ domain, className }: { domain: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <Globe className={cn("text-muted-foreground", className)} aria-hidden="true" />;
  return (
    <img
      src={`/api/domains/icon/${encodeURIComponent(domain)}`}
      alt=""
      loading="lazy"
      decoding="async"
      className={cn("rounded-[3px] object-contain", className)}
      onError={() => setFailed(true)}
    />
  );
}
