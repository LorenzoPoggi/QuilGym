export function safeAccountReturn(raw: unknown) {
  return typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") && !/[\\\u0000-\u0020\u007f]/.test(raw) && !raw.startsWith("/api/") && !raw.startsWith("/cuenta/ingresar") && !raw.startsWith("/cuenta/registro") ? raw : "/";
}
