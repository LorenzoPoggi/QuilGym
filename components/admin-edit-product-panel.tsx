"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getAdminProductEditor, type AdminProductEditorResult } from "@/lib/admin-actions";
import { AdminProductEditor, type AdminProductSaved } from "./admin-product-form";
import "@/app/styles/admin-form.css";

/**
 * Diálogo lateral con el editor de producto. Se carga con `next/dynamic` desde `AdminEditProduct`,
 * así que ni este código ni los estilos del formulario llegan a quienes no son administradores.
 */
export function AdminEditProductPanel({ productId, onClose, onSaved }: { productId: number; onClose: () => void; onSaved: (result: AdminProductSaved) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const requestCloseRef = useRef<(() => void) | null>(null);
  const [data, setData] = useState<AdminProductEditorResult | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    let active = true;
    getAdminProductEditor(productId)
      .then((result) => { if (active) { setData(result); setFailed(false); } })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [productId, attempt]);

  // Con el editor cargado, el cierre pasa por su lógica (confirma si hay cambios); si no, cierra directo.
  const requestClose = useCallback(() => {
    if (requestCloseRef.current) requestCloseRef.current(); else onClose();
  }, [onClose]);

  function retry() { setData(null); setFailed(false); setAttempt((n) => n + 1); }

  const errorMessage = failed ? "No pudimos cargar el producto. Revisá la conexión e intentá de nuevo." : data && !data.ok ? data.error : "";

  return <dialog ref={dialogRef} className="admin-edit-dialog" aria-labelledby="admin-edit-title"
    onCancel={(event) => { event.preventDefault(); requestClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
    <div className="admin-edit-dialog__bar">
      <h2 id="admin-edit-title">Editar producto</h2>
      <button type="button" className="admin-edit-dialog__close" aria-label="Cerrar editor" onClick={requestClose}><X size={20} aria-hidden="true"/></button>
    </div>
    <div className="admin-edit-dialog__body">
      {data?.ok
        ? <AdminProductEditor key={data.entry.product.updatedAt.toString()} entry={data.entry} taxonomy={data.taxonomy} mode="dialog" requestCloseRef={requestCloseRef} onCancel={onClose} onSaved={onSaved}/>
        : errorMessage
          ? <div className="admin-edit-dialog__state" role="alert"><p>{errorMessage}</p><div><button type="button" className="admin-primary" onClick={retry}>Reintentar</button><button type="button" className="admin-secondary" onClick={onClose}>Cerrar</button></div></div>
          : <div className="admin-edit-dialog__state" role="status"><p>Cargando producto…</p></div>}
    </div>
  </dialog>;
}
