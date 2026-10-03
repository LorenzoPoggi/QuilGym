/** Normaliza texto para búsquedas: minúsculas y sin acentos. */
export function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function slugify(value: string) {
  return normalizeText(value)
    .replace(/&#?\w+;/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
