import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { pageMetadata } from "@/lib/metadata";
import LegalPage from "@/components/LegalPage";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata(locale, "terms", "/terms");
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalPage doc="terms" />;
}
