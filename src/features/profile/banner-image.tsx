import type { BannerCrop } from "@/lib/api";
export function BannerImage({
  src,
  crop,
  alt,
}: {
  src: string;
  crop: BannerCrop | null;
  alt: string;
}) {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-xl">
      <img
        src={src}
        alt={alt}
        className={crop ? "absolute max-w-none" : "size-full object-cover"}
        style={
          crop
            ? {
                width: `${100 / crop.width}%`,
                height: `${100 / crop.height}%`,
                left: `${(-100 * crop.x) / crop.width}%`,
                top: `${(-100 * crop.y) / crop.height}%`,
              }
            : undefined
        }
      />
    </div>
  );
}
