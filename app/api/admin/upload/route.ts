import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin-auth";

export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: "Vercel Blob no está configurado." }, { status: 503 });
  let body: HandleUploadBody;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 }); }
  try {
    const result = await handleUpload({ body, request,
      onBeforeGenerateToken: async (pathname) => {
        if (!await getAdminUser()) throw new Error("No autorizado.");
        if (!/^quilgym\/products\/[a-zA-Z0-9_.-]+\.(webp|png|jpe?g)$/.test(pathname)) throw new Error("Nombre de imagen inválido.");
        return { allowedContentTypes: ["image/webp", "image/png", "image/jpeg"], maximumSizeInBytes: 4 * 1024 * 1024, addRandomSuffix: true };
      },
      onUploadCompleted: async () => { /* La URL se guarda al confirmar el producto. */ },
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "No autorizado.") {
      return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    }
    // Los errores de Blob pueden contener detalles del proveedor o de la configuración.
    // Se registran solo por tipo y el navegador recibe un mensaje estable.
    console.warn("[admin] No se pudo subir la imagen", { reason: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "No pudimos subir la imagen. Revisá el formato y el tamaño e intentá nuevamente." }, { status: 400 });
  }
}
