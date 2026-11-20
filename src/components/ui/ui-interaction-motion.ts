
'use client';

import * as React from 'react';

export const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';
export const EASE_SETTLE = 'cubic-bezier(0.22, 1.18, 0.36, 1)';
export const EASE_THROW = 'cubic-bezier(0.34, 1.36, 0.64, 1)';
export const INTERACTION_PRESS =
  'transition-[background-color,color,box-shadow,opacity,scale] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100';
export const INTERACTION_FOCUS ='focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const query = '(prefers-reduced-motion: reduce)';
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
};
export const useInteractionReducedMotion = () => React.useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);

export function useInteractionActivity<T extends Element>() {
  const ref = React.useRef<T>(null);
  const [visible, setVisible] = React.useState(false);
  const [hidden, setHidden] = React.useState(false);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(el);
    const visibility = () => setHidden(document.hidden);
    visibility(); document.addEventListener('visibilitychange', visibility);
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  return { ref, active: visible && !hidden };
}

export function interactionIcon(on: boolean, reduced: boolean): React.CSSProperties {
  return { opacity: on ? 1 : 0, transform: on ? 'none' : 'scale(0.6)', filter: on ? 'blur(0px)' : 'blur(3px)', transition: reduced ? 'none' : `opacity 220ms ${EASE_OUT}, transform 380ms ${EASE_OUT}, filter 220ms ${EASE_OUT}` };
}

export const MATERIAL_LIFT =
  'shadow-[0_1px_1.5px_rgb(0_0_0/0.07),0_3px_8px_-2px_rgb(0_0_0/0.1),inset_0_0.5px_0_rgb(255_255_255/0.8)] dark:shadow-[0_1px_2px_rgb(0_0_0/0.5),0_4px_10px_-2px_rgb(0_0_0/0.35),inset_0_0.5px_0_rgb(255_255_255/0.1)]';
export const MATERIAL_RECESS =
  'shadow-[inset_0_1px_2.5px_rgb(0_0_0/0.09),inset_0_-0.5px_0_rgb(255_255_255/0.7)] dark:shadow-[inset_0_1px_3px_rgb(0_0_0/0.45),inset_0_-0.5px_0_rgb(255_255_255/0.07)]';

export type SpringConfig = { stiffness: number; damping: number; mass?: number };
export interface Spring {
  get(): number;
  getVelocity(): number;
  getTarget(): number;
  set(target: number): void;
  push(velocity: number): void;
  jump(value: number): void;
  configure(config: SpringConfig): void;
  stop(): void;
}

const SPRING_STEP = 1 / 240;
type Running = { step: () => void };
const runningSprings = new Set<Running>();
const springPainters = new Set<() => void>();
let springFrame = 0;
let springLast = 0;
let springSpare = 0;

function springTick(now: number) {
  springSpare += Math.min((now - springLast) / 1000, 0.05);
  springLast = now;
  while (springSpare >= SPRING_STEP) {
    runningSprings.forEach((spring) => spring.step());
    springSpare -= SPRING_STEP;
  }
  const painters = [...springPainters];
  springPainters.clear();
  painters.forEach((paint) => paint());
  springFrame = runningSprings.size ? requestAnimationFrame(springTick) : 0;
}

function wakeSprings(spring: Running) {
  runningSprings.add(spring);
  if (springFrame) return;
  springSpare = 0;
  springFrame = requestAnimationFrame((now) => {
    springLast = now - 1000 / 60;
    springTick(now);
  });
}

export function createSpring(initial: number, config: SpringConfig, onFrame: () => void, precision = 0.01): Spring {
  let value = initial;
  let velocity = 0;
  let target = initial;
  let { stiffness, damping, mass = 1 } = config;
  const running: Running = {
    step() {
      velocity += ((-stiffness * (value - target) - damping * velocity) / mass) * SPRING_STEP;
      value += velocity * SPRING_STEP;
      if (Math.abs(value - target) < precision && Math.abs(velocity) < precision * 10) {
        value = target;
        velocity = 0;
        runningSprings.delete(running);
      }
      springPainters.add(onFrame);
    },
  };
  return {
    get: () => value,
    getVelocity: () => velocity,
    getTarget: () => target,
    set(next) {
      if (next === target && !runningSprings.has(running)) return;
      target = next;
      wakeSprings(running);
    },
    push(speed) {
      velocity += speed;
      wakeSprings(running);
    },
    jump(next) {
      value = next;
      target = next;
      velocity = 0;
      runningSprings.delete(running);
      onFrame();
    },
    configure(next) {
      ({ stiffness, damping, mass = 1 } = next);
    },
    stop() {
      runningSprings.delete(running);
    },
  };
}

export type PointerSample = { x: number; time: number };
export function samplePointer(samples: PointerSample[], x: number, time: number) {
  samples.push({ x, time });
  while (samples.length > 2 && time - samples[0].time > 100) samples.shift();
}
export function releaseVelocity(samples: PointerSample[], now: number) {
  if (samples.length < 2 || now - samples[samples.length - 1].time > 100) return 0;
  const first = samples[0], last = samples[samples.length - 1];
  return (last.x - first.x) / Math.max(1, last.time - first.time);
}

export function rubberBand(overshoot: number, dimension = 320, constant = 0.55): number {
  const d = dimension || 320;
  const abs = Math.abs(overshoot);
  return Math.sign(overshoot) * (1 - 1 / ((abs * constant) / d + 1)) * d;
}

export function projectInertia(distance: number, velocity: number, time = 0.12): number {
  return distance + velocity * 1000 * time;
}

export function softenVelocity(velocity: number, distanceToTarget: number, factor = 10): number {
  const maxAllowed = Math.abs(distanceToTarget) * factor;
  return Math.sign(velocity) * Math.min(Math.abs(velocity), maxAllowed);
}

export function springFrames(
  from: number,
  to: number,
  velocity = 0,
  duration = 480,
  config: { omega?: number; damping?: number; steps?: number } = {},
) {
  const { omega = 16, damping = 0.74, steps = 36 } = config;
  const damped = omega * Math.sqrt(Math.max(0.001, 1 - damping * damping));
  const displacement = from - to;
  const coefficient = (velocity * 1000 + damping * omega * displacement) / damped;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = (i / steps) * (duration / 1000);
    const value = to + Math.exp(-damping * omega * t) * (displacement * Math.cos(damped * t) + coefficient * Math.sin(damped * t));
    return { value: i === steps ? to : value, offset: i / steps };
  });
}

