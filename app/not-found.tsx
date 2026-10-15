import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";

export default function NotFound() {
  return <><Header/><main className="not-found-page"><section className="not-found-card" aria-labelledby="not-found-title">
    <p className="eyebrow">ERROR 404 · QUILGYM</p>
    <h1 id="not-found-title">No encontramos esta página.</h1>
    <p>El enlace puede haber cambiado o estar escrito de otra forma. Volvé a la tienda y seguimos desde ahí.</p>
    <div><Link className="button button--dark" href="/productos"><Search aria-hidden="true"/>Explorar productos</Link><Link className="button button--outline" href="/">Ir al inicio <ArrowRight aria-hidden="true"/></Link></div>
  </section></main><Footer/></>;
}
