import { Boxes, Cookie, Droplets, Dumbbell, FlaskConical, LayoutGrid, Pill, ShoppingBag, Sparkles, Tag, Weight, Zap, type LucideIcon } from "lucide-react";

// Íconos genéricos por categoría: solo orientan, no representan un producto concreto.
const icons: Record<string, LucideIcon> = {
  proteinas: Dumbbell,
  creatinas: FlaskConical,
  "pre-entrenos": Zap,
  aminoacidos: Droplets,
  "ganadores-de-peso": Weight,
  "vitaminas-y-minerales": Pill,
  colageno: Sparkles,
  snacks: Cookie,
  combos: Boxes,
  accesorios: ShoppingBag,
};

export function CategoryIcon({ slug }: { slug?: string }) {
  const Icon = slug ? icons[slug] ?? Tag : LayoutGrid;
  return <Icon aria-hidden="true"/>;
}
