"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { compareHref } from "@/lib/compare";

/** Búsqueda del selector del comparador: sin JS es un formulario GET; con JS filtra mientras se escribe sin mover el scroll. */
export function ComparePickerSearch({ slugs, categoria, cambiar, q }: { slugs: string[]; categoria?: string; cambiar?: string; q?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(q ?? "");
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const go = (text: string) => startTransition(() => router.replace(compareHref({ slugs, categoria, cambiar, q: text.trim().slice(0, 80) || undefined }), { scroll: false }));

  return <form className="compare-picker__search" action="/comparar" method="get" role="search" aria-busy={pending} onSubmit={(event) => { event.preventDefault(); clearTimeout(timer.current); go(value); }}>
    <input type="hidden" name="p" value={slugs.join(",")}/>
    {cambiar ? <input type="hidden" name="cambiar" value={cambiar}/> : null}
    {categoria ? <input type="hidden" name="categoria" value={categoria}/> : null}
    <label htmlFor="compare-search">Buscar por nombre o marca</label>
    <div><Search aria-hidden="true"/><input id="compare-search" name="q" type="search" maxLength={80} autoComplete="off" placeholder="Ej.: creatina star, proteína 2 lb" value={value}
      onChange={(event) => { const text = event.target.value; setValue(text); clearTimeout(timer.current); timer.current = setTimeout(() => go(text), 300); }}/>
      <button className="button button--dark" type="submit">Buscar</button></div>
  </form>;
}
