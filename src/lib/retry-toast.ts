import { toast } from "@/components/ui/toast-manager";
import { errorMessage } from "@/lib/api";

export function showRetryToast(
  title: string,
  error: unknown,
  retry: () => void,
) {
  const id = toast.add({
    type: "error",
    title,
    description: errorMessage(error),
    timeout: 8000,
    priority: "high",
    actionProps: {
      children: "Retry",
      onClick: () => {
        toast.close(id);
        retry();
      },
    },
  });
}
