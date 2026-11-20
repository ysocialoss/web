import { useState, type ReactElement } from "react";
import { LoaderCircle } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function ConfirmationDialog({
  open,
  trigger,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  error,
  destructive = false,
}: {
  open: boolean;
  trigger?: ReactElement;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => boolean | Promise<boolean | undefined>;
  error?: string;
  destructive?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const mobile = useIsMobile();
  const Root = mobile ? Dialog : AlertDialog;
  const Trigger = mobile ? DialogTrigger : AlertDialogTrigger;
  const Content = mobile ? DialogContent : AlertDialogContent;
  const Header = mobile ? DialogHeader : AlertDialogHeader;
  const Title = mobile ? DialogTitle : AlertDialogTitle;
  const Description = mobile ? DialogDescription : AlertDialogDescription;
  const Footer = mobile ? DialogFooter : AlertDialogFooter;
  const Cancel = mobile ? DialogClose : AlertDialogCancel;
  async function confirm() {
    if (pending) return;
    setFailed(false);
    try {
      const result = onConfirm();
      if (typeof result === "boolean") {
        if (result) onOpenChange(false);
        else setFailed(true);
        return;
      }
      setPending(true);
      const success = await result;
      if (success) onOpenChange(false);
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }
  return (
    <Root
      open={open}
      onOpenChange={(next) => {
        if (!pending) {
          setFailed(false);
          onOpenChange(next);
        }
      }}
    >
      {trigger && <Trigger render={trigger} />}
      <Content>
        <Header>
          <Title>{title}</Title>
          <Description>{description}</Description>
        </Header>
        {failed && (
          <p role="alert" className="text-sm text-destructive">
            {error || "Unable to complete this action. Please try again."}
          </p>
        )}
        <Footer>
          <Cancel disabled={pending} render={<Button variant="outline" />}>
            Cancel
          </Cancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={() => void confirm()}
          >
            {pending && (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            )}
            {confirmLabel}
          </AlertDialogAction>
        </Footer>
      </Content>
    </Root>
  );
}
