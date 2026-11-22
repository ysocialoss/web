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
];

let previous: ComposerQuote | undefined;

export function pickQuote(not: ComposerQuote | null = null): ComposerQuote {
  const avoid = not ?? previous;
  const pool = quotes.filter((quote) => quote !== avoid);
  const quote = pool[Math.floor(Math.random() * pool.length)];
  previous = quote;
  return quote;
}

export function QuoteText({
  quote,
  className,
}: {
  quote: ComposerQuote;
  className?: string;
}) {
  return (
    <span className={cn("block truncate text-foreground/55", className)}>
      &bdquo;{quote.text}&ldquo;
    </span>
  );
}
