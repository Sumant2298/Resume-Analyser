import "./globals.css";
import { Space_Grotesk, Fraunces } from "next/font/google";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap"
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap"
});

export const metadata = {
  title: "Resume Analyser",
  description:
    "Analyze a resume against a job description with match scoring and improvements."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${fraunces.variable}`}>
      <body>
        {children}
      </body>
    </html>
  );
}
