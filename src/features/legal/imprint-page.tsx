import { LegalLayout } from "./legal-layout";
import { useOperator } from "./use-operator";

export function ImprintPage() {
  const { operator, error, loading } = useOperator();
  return (
    <LegalLayout title={{ de: "Impressum", en: "Imprint" }}>
      {(language) => {
        const de = language === "de";
        if (loading) return <p className="text-muted-foreground">{de ? "Wird geladen…" : "Loading…"}</p>;
        if (error || !operator)
          return (
            <p role="alert" className="text-destructive">
              {de
                ? "Die Anbieterangaben konnten gerade nicht geladen werden. Bitte versuche es später erneut."
                : "The provider details could not be loaded right now. Please try again later."}
            </p>
          );
        const privacy = operator.contacts.privacy ?? operator.email;
        const abuse = operator.contacts.abuse ?? operator.email;
        return (
          <>
            <h2>{de ? "Angaben gemäß § 5 DDG" : "Information under § 5 DDG (German Digital Services Act)"}</h2>
            <address className="not-italic">
              {operator.name}
              {operator.address.map((line) => <span key={line} className="block">{line}</span>)}
            </address>
            <h2>{de ? "Kontakt" : "Contact"}</h2>
            <ul>
              <li>E-Mail: <a href={`mailto:${operator.email}`}>{operator.email}</a></li>
              {operator.phone && <li>{de ? "Telefon" : "Phone"}: <a href={`tel:${operator.phone.replace(/\s/g, "")}`}>{operator.phone}</a></li>}
            </ul>
            <h2>{de ? "Kontaktstellen nach dem Digital Services Act" : "Points of contact under the Digital Services Act"}</h2>
            <p>
              {de
                ? "Zentrale Kontaktstelle für Behörden der Mitgliedstaaten, die Europäische Kommission und das Gremium (Art. 11 DSA) sowie für Nutzerinnen und Nutzer (Art. 12 DSA):"
                : "Single point of contact for Member State authorities, the European Commission and the Board (Art. 11 DSA) and for users (Art. 12 DSA):"}{" "}
              <a href={`mailto:${abuse}`}>{abuse}</a>.{" "}
              {de
                ? "Die Kommunikation ist auf Deutsch und Englisch möglich. Die Kontaktaufnahme ist nicht ausschließlich automatisiert."
                : "You can write to us in German or English. Contact is not handled solely by automated means."}
            </p>
            <p>
              {de ? "Rechtswidrige Inhalte kannst du jederzeit über das " : "You can report illegal content at any time using the "}
              <a href="/report">{de ? "Meldeformular" : "report form"}</a>{de ? " melden." : "."}
            </p>
            <h2>{de ? "Datenschutz" : "Data protection"}</h2>
            <p>
              {de ? "Fragen zum Datenschutz: " : "Privacy questions: "}<a href={`mailto:${privacy}`}>{privacy}</a>.{" "}
              {de ? "Mehr dazu in der " : "See the "}<a href="/legal/privacy">{de ? "Datenschutzerklärung" : "privacy policy"}</a>.
            </p>
            <h2>{de ? "Hinweise" : "Notes"}</h2>
            <p>
              {de
                ? "ysocial ist ein privat und nicht gewerblich betriebenes soziales Netzwerk. Es werden keine journalistisch-redaktionellen Inhalte im Sinne von § 18 Abs. 2 MStV angeboten. Für die Inhalte der Beiträge sind die jeweiligen Nutzerinnen und Nutzer verantwortlich."
                : "ysocial is a social network run privately and on a non-commercial basis. It does not offer journalistic or editorial content within the meaning of § 18(2) MStV. Users are responsible for the content of their posts."}
            </p>
            <p>
              {de
                ? "Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen."
                : "We are neither willing nor obliged to take part in dispute resolution proceedings before a consumer arbitration board."}
            </p>
          </>
        );
      }}
    </LegalLayout>
  );
}
