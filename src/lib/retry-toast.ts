import { toast } from "@/components/ui/toast";
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
    timeout: 0,
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
