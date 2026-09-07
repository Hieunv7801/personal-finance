import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Money Flow", description: "Quản lý dòng tiền theo chu kỳ lương" };
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="vi"><body>{children}</body></html>;
}