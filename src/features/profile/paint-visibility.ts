import { createContext } from "react";

export const NamePaintPreferencesContext = createContext({
  namePaintsDisabled: false,
  namePaintAnimationsDisabled: false,
});

let paintObserver: IntersectionObserver | undefined;

export function observeNamePaint(element: Element | null) {
  if (!element || typeof IntersectionObserver === "undefined") return;

  // Share one viewport observer across the feed, dialogs, and paint previews.
  paintObserver ??= new IntersectionObserver((entries) => {
    for (const { target, isIntersecting } of entries) {
      target.toggleAttribute("data-paint-visible", isIntersecting);
    }
  });
  paintObserver.observe(element);

  return () => {
    paintObserver?.unobserve(element);
    element.removeAttribute("data-paint-visible");
  };
}
