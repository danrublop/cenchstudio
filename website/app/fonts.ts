import { EB_Garamond, Saira_Stencil_One } from "next/font/google";

export const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const sairaStencil = Saira_Stencil_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-saira-stencil",
});
