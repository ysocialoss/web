import { useCallback, type Ref } from "react";

function attachRef(ref: Ref<HTMLDivElement> | undefined, popup: HTMLDivElement) {
  if (typeof ref === "function") return ref(popup) ?? (() => ref(null));
  if (ref) {
    ref.current = popup;
    return () => {
      ref.current = null;
    };
  }
}

export function useAnimatedPopupHeight(ref?: Ref<HTMLDivElement>) {
  return useCallback(
    (popup: HTMLDivElement | null) => {
      if (!popup) return;

      const releaseRef = attachRef(ref, popup);

      const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
      const canAnimate = () =>
        !motion.matches &&
        popup.matches("[data-open]:not([data-swiping], [data-nested-drawer-open])");
      let height = popup.offsetHeight;
      let animation: Animation | undefined;
      let frame = 0;

      const stop = () => {
        animation?.cancel();
        animation = undefined;
        popup.removeAttribute("data-resizing");
      };

      const syncHeight = () => {
        if (!canAnimate()) {
          stop();
          height = popup.offsetHeight;
          return;
        }

        const previousHeight = animation ? popup.offsetHeight : height;
        // Read the natural height without discarding an animation already headed there.
        const effect = animation?.effect;
        if (animation) animation.effect = null;
        const targetHeight = popup.offsetHeight;
        if (animation && effect && targetHeight === height) {
          animation.effect = effect;
          return;
        }

        stop();
        height = popup.offsetHeight;
        if (!previousHeight || previousHeight === height) return;

        popup.setAttribute("data-resizing", "");
        animation = popup.animate(
          [{ height: `${previousHeight}px` }, { height: `${height}px` }],
          { duration: 220, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "both" },
        );
        animation.onfinish = () => {
          stop();
          syncHeight();
        };
      };

      // DOM changes can be measured before paint. Defer intrinsic resizes outside
      // ResizeObserver delivery so Base UI's drawer observer can settle as well.
      const changes = new MutationObserver(syncHeight);
      changes.observe(popup, {
        subtree: true,
        childList: true,
        characterData: true,
        attributeFilter: [
          "hidden",
          "inert",
          "data-open",
          "data-swiping",
          "data-nested-drawer-open",
        ],
      });
      const resize = new ResizeObserver(() => {
        if (animation || frame || height === popup.offsetHeight) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          syncHeight();
        });
      });
      resize.observe(popup, { box: "border-box" });
      motion.addEventListener("change", syncHeight);

      return () => {
        changes.disconnect();
        resize.disconnect();
        cancelAnimationFrame(frame);
        motion.removeEventListener("change", syncHeight);
        stop();
        releaseRef?.();
      };
    },
    [ref],
  );
}
