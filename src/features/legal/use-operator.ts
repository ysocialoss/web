import { useEffect, useState } from "react";
import { api, type Operator } from "@/lib/api";

export function useOperator() {
  const [state, setState] = useState<{ operator: Operator | null; error: boolean; loading: boolean }>({
    operator: null,
    error: false,
    loading: true,
  });
  useEffect(() => {
    const controller = new AbortController();
    api.operator(controller.signal)
      .then((operator) => setState({ operator, error: false, loading: false }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ operator: null, error: true, loading: false });
      });
    return () => controller.abort();
  }, []);
  return state;
}
