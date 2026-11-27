import type { ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { IconLink } from "@/components/ui/icon-button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGoBack } from "@/hooks/use-go-back";
import { usePageTitle } from "@/hooks/use-page-title";

export type Language = "de" | "en";

export function useLanguage(): [Language, (language: Language) => void] {
  const [params, setParams] = useSearchParams();
  const language: Language = params.get("lang") === "en" ? "en" : "de";
  return [language, (next) => setParams(next === "en" ? { lang: "en" } : {}, { replace: true })];
}

export function LegalLayout({
  title,
  version,
  children,
}: {
  title: { de: string; en: string };
  version?: string;
  children: (language: Language) => ReactNode;
}) {
  const [language, setLanguage] = useLanguage();
  usePageTitle(title[language]);
  const goBack = useGoBack();
  return (
    <article className="mx-auto max-w-2xl pb-10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <IconLink to="/" label="Back" onClick={goBack}>
          <ArrowLeft />
        </IconLink>
        <Tabs value={language} onValueChange={(value) => setLanguage(value as Language)}>
          <TabsList>
            <TabsTrigger value="de">Deutsch</TabsTrigger>
            <TabsTrigger value="en">English</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">{title[language]}</h1>
      {version && (
        <p className="mt-1 text-sm text-muted-foreground">
          {language === "de" ? "Stand" : "Version"}: <time dateTime={version}>{version}</time>
        </p>
      )}
      {language === "en" && (
        <p className="mt-3 rounded-lg border bg-muted px-4 py-3 text-sm text-muted-foreground">
          This English version is provided for convenience. The German version is legally binding.
        </p>
      )}
      <div className="legal-text mt-6 space-y-4 text-sm leading-relaxed [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-5 [&_h3]:font-semibold [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_table]:w-full [&_td]:border-t [&_td]:py-2 [&_td]:pr-3 [&_td]:align-top [&_th]:pb-2 [&_th]:pr-3 [&_th]:text-left [&_ul]:list-disc [&_ul]:pl-5">
        {children(language)}
      </div>
      <nav aria-label="Legal" className="mt-10 flex flex-wrap gap-x-4 gap-y-2 border-t pt-4 text-sm text-muted-foreground">
        <Link to={`/legal/imprint${language === "en" ? "?lang=en" : ""}`}>{language === "de" ? "Impressum" : "Imprint"}</Link>
        <Link to={`/legal/privacy${language === "en" ? "?lang=en" : ""}`}>{language === "de" ? "Datenschutz" : "Privacy"}</Link>
        <Link to={`/legal/terms${language === "en" ? "?lang=en" : ""}`}>{language === "de" ? "Nutzungsbedingungen" : "Terms"}</Link>
        <Link to={`/legal/feed${language === "en" ? "?lang=en" : ""}`}>{language === "de" ? "So funktioniert der Feed" : "How the feed works"}</Link>
        <Link to="/contact">{language === "de" ? "Kontakt" : "Contact"}</Link>
        <Link to="/report">{language === "de" ? "Inhalte melden" : "Report content"}</Link>
      </nav>
    </article>
  );
}
