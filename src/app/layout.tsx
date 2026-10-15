import type { Metadata } from "next";
import { Montserrat, Tajawal } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { localeDir, type Locale } from "@/i18n/config";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const tajawal = Tajawal({
  variable: "--font-tajawal",
  subsets: ["arabic"],
  weight: ["300", "400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Horizon Care Tracker",
  description: "Alkalma Horizon programme care-coordination tracker",
  icons: { icon: "/favicon.svg" },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = (await getLocale()) as Locale;
  return (
    <html
      lang={locale}
      dir={localeDir(locale)}
      className={`${montserrat.variable} ${tajawal.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
