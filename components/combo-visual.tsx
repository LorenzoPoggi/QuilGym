import Image from "next/image";
import type { ComboPart } from "@/lib/combo-contents";

/** Composición decorativa con las fotos limpias de los productos incluidos. */
export function ComboVisual({ parts, sizes, preload = false }: { parts: ComboPart[]; sizes: string; preload?: boolean }) {
  const photos = parts.flatMap((part) => Array.from({ length: part.quantity }, () => part)).slice(0, 2);
  if (!photos.length) return null;
  if (photos.length === 2) {
    return (
      <span className="combo-visual combo-visual--pair">
        <span className="combo-visual__item combo-visual__item--back"><Image src={photos[0].photoUrl} alt="" fill sizes={sizes} preload={preload}/></span>
        <span className="combo-visual__item combo-visual__item--front"><Image src={photos[1].photoUrl} alt="" fill sizes={sizes} preload={preload}/></span>
      </span>
    );
  }
  return <span className="combo-visual"><span className="combo-visual__item combo-visual__item--solo"><Image src={photos[0].photoUrl} alt="" fill sizes={sizes} preload={preload}/></span></span>;
}
