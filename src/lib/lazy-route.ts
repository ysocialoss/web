import { lazy, type ComponentType, type LazyExoticComponent } from "react";

export type LazyRoute<P extends object> = LazyExoticComponent<ComponentType<P>> & {
  preload: () => Promise<unknown>;
};

export function lazyRoute<P extends object>(
  load: () => Promise<{ default: ComponentType<P> }>,
): LazyRoute<P> {
  let pending: ReturnType<typeof load> | undefined;
  const once = () => {
    pending ??= load().catch((error: unknown) => {
      pending = undefined;
      throw error;
    });
    return pending;
  };
  const component = lazy(once) as LazyRoute<P>;
  component.preload = () => once().catch(() => undefined);
  return component;
}
