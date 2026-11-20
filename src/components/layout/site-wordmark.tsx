export function SiteWordmark({ className }: { className: string }) {
  return (
    <span className={`relative ${className}`}>
      <img
        src="/logo.png"
        alt="ysocial"
        width={1708}
        height={644}
        className="block h-auto w-full"
      />
      <img
        src="/logo.png"
        alt=""
        aria-hidden="true"
        width={1708}
        height={644}
        className="site-wordmark-tint pointer-events-none absolute inset-0 size-full"
      />
    </span>
  );
}
