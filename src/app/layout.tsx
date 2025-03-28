// src/app/layout.tsx
import { Inter, Poppins } from "next/font/google";
import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/contexts/theme-provider"; // Our wrapper file
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" }); // Use variable for better Tailwind integration

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["600", "700"], // Include the weights you want to use (e.g., semi-bold, bold)
  variable: "--font-logo", // Assign a CSS variable name
});
export const metadata: Metadata = {
  title: "MyDocta",
  description: "Your AI Health Assistant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased", // Use bg-background from shadcn/tailwind
          inter.variable,
          poppins.variable // Apply font variable
        )}
      >
        <ThemeProvider
          attribute="class" // Tells next-themes to use classes on the html tag
          defaultTheme="system" // Default preference
          enableSystem // Enable system theme detection
          disableTransitionOnChange // Optional: avoids flashes during theme switch
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}