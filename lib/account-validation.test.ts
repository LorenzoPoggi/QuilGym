import { expect, it } from "vitest";
import { safeAccountReturn } from "./account-validation";
it("evita redirects externos o rutas de autenticación",()=>{for(const url of ["https://example.com","//example.com","/\\example.com","/\nexample.com","/\t/example.com","/api/auth/sign-out","/cuenta/ingresar",undefined])expect(safeAccountReturn(url)).toBe("/cuenta");expect(safeAccountReturn("/productos?q=creatina")).toBe("/productos?q=creatina")});
