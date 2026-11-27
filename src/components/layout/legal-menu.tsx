import { Bug, CodeXml, Equal, FileText, Flag, Mail, Megaphone } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { ActionMenu } from "@/components/ui/action-menu";
import { cn } from "@/lib/utils";
import { openChangelog } from "@/features/changelog/changelog-store";

/** The two-bar button that holds the legal and project links. */
export function LegalMenu({ className }: { className?: string }) {
  return (
    <ActionMenu
      items={[
        { kind: "action", label: "What's new", icon: Megaphone, onClick: openChangelog },
        { kind: "link", label: "Report", icon: Flag, to: "/report" },
        { kind: "link", label: "Found a bug?", icon: Bug, to: "/bug" },
        { kind: "link", label: "Privacy", icon: FileText, to: "/legal/privacy" },
        { kind: "link", label: "Terms", icon: FileText, to: "/legal/terms" },
        {
          kind: "link",
          label: "Imprint",
          icon: FileText,
          to: "/legal/imprint",
        },
        { kind: "link", label: "Contact", icon: Mail, to: "/contact" },
        {
          kind: "link",
          label: "Open Source",
          icon: CodeXml,
          to: "https://git.ysocial.cc/",
          reloadDocument: true,
        },
      ]}
      trigger={
        <IconButton
          variant="ghost"
          size="icon"
          className={cn("size-9", className)}
          label="More"
        >
          <Equal aria-hidden="true" />
        </IconButton>
      }
    />
  );
}
