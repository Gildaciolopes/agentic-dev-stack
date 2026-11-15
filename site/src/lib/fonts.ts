import { JetBrains_Mono } from "next/font/google";

export const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-jetbrains",
  adjustFontFallback: true,
});
