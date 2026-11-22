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
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function ErrorDialog({
  message,
  title = "Something went wrong",
  onClose,
}: {
  message: string;
  title?: string;
  onClose: () => void;
}) {
  const mobile = useIsMobile();
  const Root = mobile ? Dialog : AlertDialog;
  const Content = mobile ? DialogContent : AlertDialogContent;
  const Header = mobile ? DialogHeader : AlertDialogHeader;
  const Title = mobile ? DialogTitle : AlertDialogTitle;
  const Description = mobile ? DialogDescription : AlertDialogDescription;
  const Footer = mobile ? DialogFooter : AlertDialogFooter;
  const Close = mobile ? DialogClose : AlertDialogCancel;
  return (
    <Root open={message !== ""} onOpenChange={(open) => !open && onClose()}>
      <Content>
        <Header>
          <Title>{title}</Title>
          <Description role="alert">{message}</Description>
        </Header>
        <Footer>
          <Close render={<Button variant="outline" />}>OK</Close>
        </Footer>
      </Content>
    </Root>
  );
}
