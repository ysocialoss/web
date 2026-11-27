import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function LoginDialogContent({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        <p className="text-xs leading-relaxed text-muted-foreground">
          By signing up you confirm that you are at least 16 and accept the{" "}
          <a href="/legal/terms" className="underline underline-offset-4">Terms</a>. See how we handle data in the{" "}
          <a href="/legal/privacy" className="underline underline-offset-4">privacy policy</a> and the{" "}
          <a href="/legal/imprint" className="underline underline-offset-4">imprint</a>.
        </p>
      </DialogHeader>
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
        <a href="/auth/login" className={buttonVariants()}>
          Log in with CNS
        </a>
      </DialogFooter>
    </DialogContent>
  );
}
