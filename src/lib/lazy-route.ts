import { createElement, lazy, useState, type ComponentType } from "react";

export type LazyRoute<P extends object> = ComponentType<P> & {
  preload: () => Promise<unknown>;
};

export function lazyRoute<P extends object>(
  load: () => Promise<{ default: ComponentType<P> }>,
): LazyRoute<P> {
  let loaded: ComponentType<P> | undefined;
  let pending: ReturnType<typeof load> | undefined;
  const once = () => {
    pending ??= load().then(
      (module) => {
        loaded = module.default;
        return module;
      },
      (error: unknown) => {
        pending = undefined;
        throw error;
      },
    );
    return pending;
  };
  const Lazy = lazy(once) as unknown as ComponentType<P>;
  // React.lazy delays its first reveal by ~300ms even when preloaded.
  function Route(props: P) {
    const [Loaded] = useState(() => loaded);
    return createElement(Loaded ?? Lazy, props);
  }
  const route = Route as LazyRoute<P>;
  route.preload = () => once().catch(() => undefined);
  return route;
}
