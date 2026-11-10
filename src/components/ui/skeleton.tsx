import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { cn } from "cn";

const SkeletonReadyContext = createContext(false);

export function SkeletonDelay({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SkeletonReadyContext.Provider value={true}>
      <div
        style={{
          display: "contents",
          visibility: ready ? "visible" : "hidden",
        }}
        aria-hidden={!ready || undefined}
      >
        {children}
      </div>
    </SkeletonReadyContext.Provider>
  );
}

function SkeletonShape({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "animate-pulse rounded-md bg-muted motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}

function Skeleton(props: ComponentProps<"div">) {
  const ready = useContext(SkeletonReadyContext);
  if (ready) return <SkeletonShape {...props} />;
  return (
    <SkeletonDelay>
      <SkeletonShape {...props} />
    </SkeletonDelay>
  );
}

export { Skeleton };
