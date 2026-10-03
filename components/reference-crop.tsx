import Image, { type StaticImageData } from "next/image";
import type { CSSProperties } from "react";

type Crop = { x: number; y: number; width: number; height: number };

type ReferenceCropProps = {
  source: StaticImageData;
  crop: Crop;
  alt: string;
  className?: string;
  priority?: boolean;
};

export function ReferenceCrop({ source, crop, alt, className = "", priority = false }: ReferenceCropProps) {
  const style = {
    "--crop-ratio": `${crop.width} / ${crop.height}`,
    "--image-width": `${(source.width / crop.width) * 100}%`,
    "--image-left": `${(-crop.x / crop.width) * 100}%`,
    "--image-top": `${(-crop.y / crop.height) * 100}%`,
  } as CSSProperties;

  return (
    <div className={`reference-crop ${className}`} style={style} role="img" aria-label={alt}>
      <Image
        src={source}
        alt=""
        aria-hidden="true"
        priority={priority}
        loading={priority ? "eager" : "lazy"}
        sizes="(max-width: 768px) 100vw, 50vw"
        className="reference-crop__image"
      />
    </div>
  );
}
