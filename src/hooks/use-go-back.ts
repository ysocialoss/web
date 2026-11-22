import type { MouseEvent } from "react";
import { useNavigate } from "react-router";

function historyIndex() {
  const state: unknown = window.history.state;
  return state && typeof state === "object" && "idx" in state && typeof state.idx === "number" ? state.idx : 0;
}

function cameFromThisSite() {
  if (!document.referrer || window.history.length < 2) return false;
  try {
    return new URL(document.referrer).origin === window.location.origin;
  } catch {
    return false;
  }
}

export function useGoBack(fallback = "/") {
  const navigate = useNavigate();
  return (event: MouseEvent<HTMLElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    if (historyIndex() > 0) void navigate(-1);
    else if (cameFromThisSite()) window.history.back();
    else void navigate(fallback, { replace: true });
  };
}
