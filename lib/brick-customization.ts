import { formatArs } from "./commerce";

/**
 * Personalización oficial del Card Payment Brick (`customization.visual.style.customVariables`, `texts`,
 * `hideFormTitle`) con los tokens del sitio (CLAUDE.md §9). El título y las marcas aceptadas los muestra QuilGym
 * fuera del Brick; los tipos de tarjeta se configuran por exclusión y el tope de cuotas lo fija el servidor.
 */
export const brickStyleVariables = {
  textPrimaryColor: "#1d2022", textSecondaryColor: "#656c71",
  inputBackgroundColor: "#ffffff", formBackgroundColor: "#ffffff",
  baseColor: "#1d2022", baseColorFirstVariant: "#343a3d", baseColorSecondVariant: "#f1f2f0",
  errorColor: "#b3261e", successColor: "#1b7a3a", successSecondaryColor: "#e6f4ea",
  outlinePrimaryColor: "#1d2022", outlineSecondaryColor: "#d6dadd",
  buttonTextColor: "#ffffff",
  fontSizeExtraExtraSmall: "12px", fontSizeExtraSmall: "13px", fontSizeSmall: "14px", fontSizeMedium: "16px", fontSizeLarge: "18px", fontSizeExtraLarge: "22px",
  fontWeightNormal: "400", fontWeightSemiBold: "600",
  inputVerticalPadding: "14px", inputHorizontalPadding: "14px",
  inputBorderWidth: "1px", inputFocusedBorderWidth: "2px",
  inputFocusedBoxShadow: "0 0 0 3px rgba(29, 32, 34, .16)", inputErrorFocusedBoxShadow: "0 0 0 3px rgba(179, 38, 30, .18)",
  borderRadiusSmall: "10px", borderRadiusMedium: "10px", borderRadiusLarge: "16px",
  formPadding: "0px",
};

export function brickCustomization({ amount, excludedTypes, maxInstallments }: { amount: number; excludedTypes: string[]; maxInstallments: number }) {
  return {
    paymentMethods: { types: { excluded: excludedTypes }, minInstallments: 1, maxInstallments },
    visual: {
      hideFormTitle: true, hidePaymentButton: false,
      style: { theme: "default", customVariables: brickStyleVariables },
      texts: {
        installmentsSectionTitle: "Cuotas",
        selectInstallments: "Elegí las cuotas",
        formSubmit: `Pagar ${formatArs(amount)}`,
      },
    },
  };
}
