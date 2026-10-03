import { CardIcon, CheckIcon, ShieldIcon, TruckIcon } from "./icons";

const items = [
  { icon: TruckIcon, label: "Envíos nacionales" },
  { icon: ShieldIcon, label: "Pago seguro" },
  { icon: CardIcon, label: "3 cuotas sin interés" },
  { icon: CheckIcon, label: "Productos originales" },
];

export function TrustStrip() {
  return <div className="trust-strip">{items.map(({ icon: Icon, label }) => <div key={label}><span><Icon/></span><strong>{label}</strong></div>)}</div>;
}
