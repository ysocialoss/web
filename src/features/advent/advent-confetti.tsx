import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import * as m from "motion/react-m";
import { cn } from "@/lib/utils";

type Burst = { id: number; x: number; y: number; big: boolean };

let bursts: Burst[] = [];
let nextId = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function launchConfetti(x: number, y: number, big = false) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const id = ++nextId;
  bursts = [...bursts, { id, x, y, big }];
  emit();
  window.setTimeout(() => {
    bursts = bursts.filter((burst) => burst.id !== id);
    emit();
  }, 6500);
}

const colors = ["#2fcc6b", "#c62f3b", "#e6b65a", "#ffffff", "#1f9a4f", "#f3d58c"];
const shapes = ["size-2 rounded-full", "h-3 w-1.5 rounded-[1px]", "size-2.5 rounded-[2px]", "h-1.5 w-3 rounded-full"];
const noise = (seed: number) => {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
};

function pieces(count: number, power: number) {
  return Array.from({ length: count }, (_, index) => {
    const spread = power > 1 ? 220 : 150;
    const angle = (-90 + (noise(index + 1) - 0.5) * spread) * (Math.PI / 180);
    const speed = (90 + noise(index + 7) * 170) * power;
    return {
      dx: Math.cos(angle) * speed,
      dy: Math.sin(angle) * speed,
      sway: (noise(index + 31) - 0.5) * 160,
      spin: (noise(index + 21) - 0.5) * 1440,
      flip: noise(index + 41) > 0.5 ? 720 : -720,
      duration: 2.8 + noise(index + 13) * 1.8,
      delay: noise(index + 3) * 0.15,
      color: colors[index % colors.length],
      shape: shapes[index % shapes.length],
    };
  });
}

const small = pieces(70, 1);
const big = pieces(160, 1.9);

function BurstPieces({ burst }: { burst: Burst }) {
  const bottom = window.innerHeight - burst.y + 60;
  return (
    <>
      {(burst.big ? big : small).map((piece, index) => (
        <m.span
          key={index}
          className={cn("absolute shadow-[0_0_1px_rgb(0_0_0/0.35)]", piece.shape)}
          style={{ left: burst.x, top: burst.y, backgroundColor: piece.color }}
          initial={{ x: 0, y: 0, rotate: 0, rotateX: 0, scale: 0.4, opacity: 1 }}
          animate={{
            x: [0, piece.dx, piece.dx + piece.sway],
            y: [0, piece.dy, bottom],
            rotate: piece.spin,
            rotateX: piece.flip,
            scale: 1,
          }}
          transition={{
            duration: piece.duration,
            delay: piece.delay,
            times: [0, 0.22, 1],
            ease: ["easeOut", [0.45, 0, 0.9, 0.6]],
          }}
        />
      ))}
    </>
  );
}

export function ConfettiLayer() {
  const list = useSyncExternalStore(subscribe, () => bursts, () => bursts);
  if (list.length === 0) return null;
  return createPortal(
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[70] overflow-hidden">
      {list.map((burst) => (
        <BurstPieces key={burst.id} burst={burst} />
      ))}
    </div>,
    document.body,
  );
}
