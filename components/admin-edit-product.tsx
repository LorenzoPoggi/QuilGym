"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAccount } from "./account-provider";
import type { AdminProductSaved } from "./admin-product-form";

// El editor y sus estilos se descargan recién cuando el administrador abre el diálogo.
const Panel = dynamic(() => import("./admin-edit-product-panel").then((module) => module.AdminEditProductPanel), {
  ssr: false,
  loading: () => createPortal(<div className="admin-edit-loading" role="status">Cargando editor…</div>, document.body),
});

/**
 * Lápiz para editar un producto desde la vitrina. Solo se dibuja si `/api/account/role` confirma al administrador
 * (el servidor exige Google vinculado y correo verificado); las páginas siguen siendo estáticas.
 * El permiso real se vuelve a validar en cada Server Action.
 * `currentSlug` es el de la ficha abierta: si el guardado lo cambia, se navega a la URL nueva.
 */
export function AdminEditProduct({ productId, name, currentSlug }: { productId: number; name: string; currentSlug?: string }) {
  const { isAdmin } = useAccount();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!isAdmin) return null;

  function saved(result: AdminProductSaved) {
    setOpen(false);
    setToast(result.aviso === "archivado" ? "Producto archivado" : "Producto guardado");
    if (currentSlug && result.slug && result.slug !== currentSlug) router.replace(`/productos/${result.slug}`);
    else router.refresh();
  }

  return <>
    <button type="button" className="admin-edit-button" aria-label="Editar producto" title={`Editar ${name}`}
      onClick={(event) => { event.preventDefault(); event.stopPropagation(); setOpen(true); }}>
      <Pencil aria-hidden="true"/>
    </button>
    {open ? <Panel productId={productId} onClose={() => setOpen(false)} onSaved={saved}/> : null}
    {toast ? createPortal(<p className="admin-edit-toast" role="status">{toast}</p>, document.body) : null}
  </>;
}
