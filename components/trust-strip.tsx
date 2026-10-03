import { CardIcon, CheckIcon, ShieldIcon, TruckIcon } from "./icons";

const items = [
  { icon: TruckIcon, label: "Envíos nacionales" },
  { icon: ShieldIcon, label: "Pago seguro" },
  { icon: CardIcon, label: "Todos los medios de pago" },
  { icon: CheckIcon, label: "Productos originales" },
];

export function TrustStrip() {
  return <div className="trust-strip">{items.map(({ icon: Icon, label }) => <div key={label}><span><Icon/></span><strong>{label}</strong></div>)}</div>;
}
