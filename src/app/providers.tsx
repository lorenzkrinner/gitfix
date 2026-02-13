"use client";

import { ClerkProvider } from "@clerk/nextjs";

import { TRPCReactProvider } from "~/trpc/react";
import { ThemeProvider as NextThemesProvider } from "next-themes"


export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TRPCReactProvider>
      <ClerkProvider>
        <NextThemesProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </NextThemesProvider>
      </ClerkProvider>
    </TRPCReactProvider>
  );
}
