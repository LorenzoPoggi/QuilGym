/** true si el usuario pidió reducir el movimiento (solo en el cliente). */
export const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
