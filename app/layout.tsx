import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "کلاسور سفر | برنامه‌ریزی گروهی",
  description: "برنامه‌ریزی سفر گروهی اصفهان، گزینه‌ها، بودجه و مسیر",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fa" dir="rtl"><body>{children}</body></html>;
}
