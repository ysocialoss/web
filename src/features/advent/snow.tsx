import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type SnowTone = "light" | "dark" | "any";

const TAU = Math.PI * 2;
const SPRITE = 96;
type Kind = "dot" | "bokeh" | "star" | "plate" | "fern";

function useIsDark() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setDark(root.classList.contains("dark")));
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

function crystalPath(context: CanvasRenderingContext2D, kind: Kind, radius: number) {
  const branches: [number, number][] =
    kind === "fern"
      ? [[0.32, 0.3], [0.5, 0.27], [0.67, 0.22], [0.83, 0.14]]
      : kind === "star"
        ? [[0.48, 0.3], [0.72, 0.2]]
        : [[0.62, 0.22]];
  context.beginPath();
  for (let arm = 0; arm < 6; arm++) {
    const angle = (arm * TAU) / 6;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const at = (x: number, y: number) => [x * cos - y * sin, x * sin + y * cos] as const;
    const [fromX, fromY] = at(radius * 0.1, 0);
    const [toX, toY] = at(radius * (kind === "plate" ? 0.88 : 1), 0);
    context.moveTo(fromX, fromY);
    context.lineTo(toX, toY);
    for (const [position, length] of branches) {
      for (const side of [-1, 1]) {
        const [bx, by] = at(radius * position, 0);
        const [ex, ey] = at(radius * position + radius * length * 0.5, side * radius * length * 0.866);
        context.moveTo(bx, by);
        context.lineTo(ex, ey);
      }
    }
    if (kind === "plate") {
      const [ax, ay] = at(radius * 0.5, 0);
      const [bx, by] = at(radius * 0.5 * Math.cos(Math.PI / 6) * 1.15, radius * 0.5 * Math.sin(Math.PI / 6) * 1.15);
      context.moveTo(ax, ay);
      context.lineTo(bx, by);
    }
  }
  if (kind === "plate") {
    for (let corner = 0; corner <= 6; corner++) {
      const x = Math.cos((corner * TAU) / 6) * radius * 0.5;
      const y = Math.sin((corner * TAU) / 6) * radius * 0.5;
      if (corner === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
  }
}

function makeSprite(kind: Kind, tone: SnowTone, scale: number) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.round(SPRITE * scale);
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  context.scale(scale, scale);
  context.translate(SPRITE / 2, SPRITE / 2);
  const half = SPRITE / 2;
  if (kind === "dot" || kind === "bokeh") {
    const gradient = context.createRadialGradient(0, 0, 0, 0, 0, half - 1);
    if (kind === "dot") {
      gradient.addColorStop(0, "rgba(255,255,255,1)");
      gradient.addColorStop(0.35, "rgba(255,255,255,0.92)");
      gradient.addColorStop(0.7, tone === "dark" ? "rgba(230,242,255,0.3)" : "rgba(180,208,238,0.45)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
    } else {
      const base = tone === "dark" ? "255,255,255" : "190,216,246";
      gradient.addColorStop(0, `rgba(${base},0.34)`);
      gradient.addColorStop(0.5, `rgba(${base},0.26)`);
      gradient.addColorStop(0.85, `rgba(${base},0.1)`);
      gradient.addColorStop(1, `rgba(${base},0)`);
    }
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(0, 0, half - 1, 0, TAU);
    context.fill();
    return canvas;
  }
  const radius = half - 12;
  const width = SPRITE * (kind === "fern" ? 0.034 : 0.046);
  context.lineCap = "round";
  context.lineJoin = "round";
  if (tone !== "dark") {
    context.save();
    crystalPath(context, kind, radius);
    context.strokeStyle = tone === "any" ? "rgba(74,112,160,0.5)" : "rgba(104,148,198,0.62)";
    context.lineWidth = width * 2.5;
    context.stroke();
    context.restore();
  }
  context.save();
  context.shadowColor = tone === "dark" ? "rgba(176,212,255,0.95)" : "rgba(150,190,235,0.9)";
  context.shadowBlur = SPRITE * 0.1 * scale;
  crystalPath(context, kind, radius);
  context.strokeStyle = "#ffffff";
  context.lineWidth = width;
  context.stroke();
  context.restore();
  context.fillStyle = "#ffffff";
  context.beginPath();
  for (let corner = 0; corner < 6; corner++) {
    const x = Math.cos((corner * TAU) / 6) * radius * 0.16;
    const y = Math.sin((corner * TAU) / 6) * radius * 0.16;
    if (corner === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
  context.fill();
  for (let arm = 0; arm < 6; arm++) {
    const x = Math.cos((arm * TAU) / 6) * radius * (kind === "plate" ? 0.88 : 1);
    const y = Math.sin((arm * TAU) / 6) * radius * (kind === "plate" ? 0.88 : 1);
    context.beginPath();
    context.arc(x, y, width * 0.95, 0, TAU);
    context.fill();
  }
  return canvas;
}

type Flake = {
  x: number;
  y: number;
  size: number;
  depth: number;
  fall: number;
  sway: number;
  swayRate: number;
  phase: number;
  spin: number;
  angle: number;
  alpha: number;
  twinkle: number;
  glint: boolean;
  sprite: HTMLCanvasElement;
};

function random(seed: number) {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function createEngine(
  canvas: HTMLCanvasElement,
  { tone, density, calm, detail }: { tone: SnowTone; density: number; calm: boolean; detail: number },
) {
  const context = canvas.getContext("2d");
  if (!context) return () => {};
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  const sprites: Record<Kind, HTMLCanvasElement> = {
    dot: makeSprite("dot", tone, scale),
    bokeh: makeSprite("bokeh", tone, scale),
    star: makeSprite("star", tone, scale),
    plate: makeSprite("plate", tone, scale),
    fern: makeSprite("fern", tone, scale),
  };
  let width = 0;
  let height = 0;
  const flakes: Flake[] = [];
  let frame = 0;
  let last = 0;
  let clock = 0;
  let seed = 1;
  const next = () => random(seed++);

  const spawn = (flake: Partial<Flake> & { depth: number }, anywhere: boolean): Flake => {
    const { depth } = flake;
    const near = depth > 0.78;
    const far = depth < 0.34;
    const roll = next();
    const kind: Kind = far
      ? "dot"
      : near
        ? roll < 0.18 ? "bokeh" : roll < 0.42 ? "fern" : roll < 0.76 ? "star" : "plate"
        : roll < 0.28 ? "dot" : roll < 0.52 ? "plate" : roll < 0.8 ? "star" : "fern";
    const size =
      kind === "bokeh" ? (40 + next() * 48) * detail
      : far ? (2 + next() * 2.8) * detail
      : near ? (19 + next() * 17) * detail
      : (8 + next() * 9) * detail;
    return {
      x: next() * (width + 80) - 40,
      y: anywhere ? next() * (height + 60) - 30 : -size - next() * height * 0.25,
      size,
      depth,
      fall: (far ? 16 + next() * 18 : near ? 62 + next() * 52 : 30 + next() * 28) * (kind === "bokeh" ? 1.35 : 1),
      sway: 8 + next() * 26 * (0.4 + depth),
      swayRate: 0.35 + next() * 0.9,
      phase: next() * TAU,
      spin: (next() - 0.5) * (kind === "dot" || kind === "bokeh" ? 0 : near ? 1.1 : 1.8),
      angle: next() * TAU,
      alpha: kind === "bokeh" ? 0.4 + next() * 0.3 : far ? 0.4 + next() * 0.3 : 0.62 + next() * 0.3,
      twinkle: 1.2 + next() * 2.6,
      glint: kind !== "dot" && kind !== "bokeh" && depth > 0.4 && next() < 0.07,
      sprite: sprites[kind],
    };
  };

  const fill = () => {
    const target = Math.round(Math.max(24, Math.min(240, ((width * height) / 17000) * density)));
    while (flakes.length < target) flakes.push(spawn({ depth: next() ** 1.7 }, true));
    if (flakes.length > target) flakes.length = target;
    flakes.sort((a, b) => a.depth - b.depth);
  };

  const wind = (time: number) =>
    Math.sin(time * 0.21) * 16 + Math.sin(time * 0.067 + 1.3) * 11 + Math.max(0, Math.sin(time * 0.11 + 4)) ** 4 * 30;

  const glint = (x: number, y: number, size: number, strength: number) => {
    context.save();
    context.translate(x, y);
    context.globalAlpha = strength;
    context.globalCompositeOperation = "lighter";
    context.fillStyle = "rgba(255,255,255,0.95)";
    const reach = size * 0.95;
    const waist = size * 0.07;
    context.beginPath();
    context.moveTo(0, -reach);
    context.quadraticCurveTo(waist, -waist, reach, 0);
    context.quadraticCurveTo(waist, waist, 0, reach);
    context.quadraticCurveTo(-waist, waist, -reach, 0);
    context.quadraticCurveTo(-waist, -waist, 0, -reach);
    context.fill();
    context.restore();
  };

  const draw = () => {
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.clearRect(0, 0, width, height);
    for (const flake of flakes) {
      const twinkle = flake.size > 6 ? 0.84 + 0.16 * Math.sin(clock * flake.twinkle + flake.phase) : 1;
      context.globalAlpha = Math.min(1, flake.alpha * twinkle);
      context.save();
      context.translate(flake.x, flake.y);
      context.rotate(flake.angle);
      context.drawImage(flake.sprite, -flake.size / 2, -flake.size / 2, flake.size, flake.size);
      context.restore();
      if (flake.glint) {
        const pulse = Math.sin(clock * flake.twinkle * 0.9 + flake.phase);
        if (pulse > 0.82) glint(flake.x, flake.y, flake.size * 0.8 * ((pulse - 0.82) / 0.18 + 0.4), (pulse - 0.82) / 0.18);
      }
    }
    context.globalAlpha = 1;
  };

  const step = (now: number) => {
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0);
    last = now;
    clock += dt;
    const gust = wind(clock);
    for (const flake of flakes) {
      flake.y += flake.fall * dt;
      flake.x += (gust * (0.25 + flake.depth) + Math.cos(flake.phase + clock * flake.swayRate) * flake.sway) * dt;
      flake.angle += flake.spin * dt;
      if (flake.y - flake.size > height) Object.assign(flake, spawn({ depth: flake.depth }, false));
      else if (flake.x < -flake.size - 40) flake.x = width + flake.size + 20;
      else if (flake.x > width + flake.size + 40) flake.x = -flake.size - 20;
    }
    draw();
    frame = requestAnimationFrame(step);
  };

  const resize = () => {
    const box = canvas.getBoundingClientRect();
    width = Math.max(1, box.width);
    height = Math.max(1, box.height);
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    fill();
    if (calm || document.hidden) draw();
  };

  const run = () => {
    if (calm || frame || document.hidden) return;
    last = 0;
    frame = requestAnimationFrame(step);
  };
  const halt = () => {
    cancelAnimationFrame(frame);
    frame = 0;
  };

  const sizeObserver = new ResizeObserver(resize);
  sizeObserver.observe(canvas);
  const visibility = new IntersectionObserver(([entry]) => (entry?.isIntersecting ? run() : halt()));
  visibility.observe(canvas);
  const onVisibility = () => (document.hidden ? halt() : run());
  document.addEventListener("visibilitychange", onVisibility);
  resize();
  if (calm) draw();

  return () => {
    halt();
    sizeObserver.disconnect();
    visibility.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
  };
}

export function SnowField({
  tone = "auto",
  density = 1,
  detail = 1,
  className,
}: {
  tone?: SnowTone | "auto";
  density?: number;
  detail?: number;
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const dark = useIsDark();
  const reduced = useReducedMotion();
  const resolved: SnowTone = tone === "auto" ? (dark ? "dark" : "light") : tone;
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    return createEngine(element, { tone: resolved, density, calm: reduced, detail });
  }, [resolved, density, reduced, detail]);
  return <canvas ref={canvas} aria-hidden="true" className={cn("pointer-events-none absolute inset-0 size-full", className)} />;
}
