import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIM-HUMAS POLRES SUBANG",
  description: "Automated Narrative Generator & SPIT PRESISI Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="bg-slate-950 text-slate-100 antialiased font-sans selection:bg-blue-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}