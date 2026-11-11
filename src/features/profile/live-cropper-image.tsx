import { useContext, useEffect, useRef } from "react";
import { CropperContext } from "@zriz/react";
import { cssMatrix, viewOf, type ViewFrame } from "@zriz/core/dom";

// zriz's default Image paints a decoded bitmap. Keep the original browser image
// alive so GIF/APNG/WebP frames advance, and follow zriz's viewport transform.
export function LiveCropperImage({ src }: { src: string }) {
  const cropper = useContext(CropperContext);
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (!cropper) return;
    const view = viewOf(cropper);
    function paint(frame: ViewFrame) {
      if (!image.current) return;
      image.current.style.width = `${frame.state.image.width}px`;
      image.current.style.height = `${frame.state.image.height}px`;
      image.current.style.transform = cssMatrix(frame.matrix);
      image.current.style.visibility = "visible";
    }
    const frame = view.frame();
    if (frame) paint(frame);
    return view.onFrame(paint);
  }, [cropper]);
  return (
    <img
      ref={image}
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      className="pointer-events-none absolute top-0 left-0 max-w-none select-none"
      style={{ visibility: "hidden", transformOrigin: "0 0" }}
    />
  );
}
