import { useEffect, useRef, useState } from "react";

function scrollParent(node: HTMLElement) {
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    const { overflowY } = getComputedStyle(parent);
    if (overflowY === "auto" || overflowY === "scroll") return parent;
  }
  return null;
}

export function useLoadMore(onLoadMore: () => void, enabled: boolean) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const callback = useRef(onLoadMore);
  useEffect(() => {
    callback.current = onLoadMore;
  });
  useEffect(() => {
    if (!node || !enabled || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) callback.current();
      },
      { root: scrollParent(node), rootMargin: "0px 0px 600px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, enabled]);
  return setNode;
}
