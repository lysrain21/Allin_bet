import { WalletProvider } from "@/context/WalletProvider";
import type { Metadata } from "next";
import localFont from "next/font/local";
import { PropsWithChildren } from "react";
import { GeoTargetly } from "@/utils/GeoTargetly";
import "nes.css/css/nes.min.css";
import "./globals.css";

const kongtext = localFont({
  src: "./../../public/kongtext.ttf",
  variable: "--font-kongtext",
});

export const metadata: Metadata = {
  title: "AllinBet - Aptos Gambling Game",
  description: "Bet with APT tokens and test your luck in this randomized product game",
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta
          name="google-site-verification"
          content="Rnm3DL87HNmPncIFwBLXPhy-WGFDXIyplSL4fRtnFsA"
        />
      </head>
      <body className={kongtext.className}>
        <WalletProvider>{children}</WalletProvider>
        <GeoTargetly />
      </body>
    </html>
  );
}
