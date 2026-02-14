"use client";

import { ClerkProvider } from "@clerk/nextjs";

import { TRPCReactProvider } from "~/trpc/react";
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { TooltipProvider } from "~/components/ui/tooltip";


export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TRPCReactProvider>
      <NextThemesProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
        >
          <TooltipProvider>
            <ClerkProvider>
              {children}
            </ClerkProvider>
          </TooltipProvider>
      </NextThemesProvider>
    </TRPCReactProvider>
  );
}
