import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

export type ComposerQuote = { text: string };

const quotes: readonly ComposerQuote[] = [
  { text: "The question is not what you look at, but what you see." },
  { text: "To be great is to be misunderstood." },
  { text: "Rather than love, than money, than fame, give me truth." },
  { text: "Whereof one cannot speak, thereof one must be silent." },
  { text: "The unexamined life is not worth living." },
  { text: "Become who you are." },
  {
    text: "All of humanity's problems stem from man's inability to sit quietly in a room alone.",
  },
  { text: "Nothing in life is to be feared, it is only to be understood." },
  { text: "Well begun is half done" },
  { text: "The only true wisdom is in knowing you know nothing." },
  { text: "Simplicity is prerequisite for reliability." },
  { text: "Be kind, for everyone you meet is fighting a hard battle" },
  { text: "Fall seven times, stand up eight." },
];

let previous: ComposerQuote | undefined;

export function pickQuote(not: ComposerQuote | null = null): ComposerQuote {
  const avoid = not ?? previous;
  const pool = quotes.filter((quote) => quote !== avoid);
  const quote = pool[Math.floor(Math.random() * pool.length)];
  previous = quote;
  return quote;
}

const edge = "1.75rem";
const sharpMask = `linear-gradient(to right, transparent, #000 ${edge}, #000 calc(100% - ${edge}), transparent)`;
const blurMask = `linear-gradient(to right, transparent, #000 0.9rem, transparent ${edge}, transparent calc(100% - ${edge}), #000 calc(100% - 0.9rem), transparent)`;
const track = "inline-block will-change-transform motion-safe:animate-[quote-rotate_var(--quote-duration)_ease-in-out_infinite_alternate]";

export function QuoteText({
  quote,
  className,
  marquee = false,
}: {
  quote: ComposerQuote;
  className?: string;
  marquee?: boolean;
}) {
  const outer = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(0);
  useLayoutEffect(() => {
    const box = outer.current;
    const text = inner.current;
    if (!marquee || !box || !text) return;
    const measure = () => setOverflow(Math.max(0, Math.ceil(text.offsetWidth - box.clientWidth)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    observer.observe(text);
    return () => observer.disconnect();
  }, [marquee, quote]);
  const label = `\u201e${quote.text}\u201c`;
  const rotating = marquee && overflow > 0;
  const style = {
    "--quote-shift": `${-overflow}px`,
    "--quote-duration": `${Math.max(6, overflow / 14 + 4).toFixed(1)}s`,
  } as CSSProperties;
  if (!marquee)
    return <span className={cn("block truncate text-foreground/55", className)}>{label}</span>;
  return (
    <span
      ref={outer}
      className={cn("relative block overflow-hidden whitespace-nowrap text-foreground/55", className)}
      style={rotating ? { maskImage: sharpMask, WebkitMaskImage: sharpMask } : undefined}
    >
      <span ref={inner} className={rotating ? track : "inline-block"} style={style}>
        {label}
      </span>
      {rotating && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
          style={{ maskImage: blurMask, WebkitMaskImage: blurMask }}
        >
          <span className={cn(track, "blur-[3px]")} style={style}>
            {label}
          </span>
        </span>
      )}
    </span>
  );
}
