import { LegalLayout } from "./legal-layout";
import { useOperator } from "./use-operator";

export const termsVersion = "2026-11-28";

export const termsClauseTitles: Record<string, { de: string; en: string }> = {
  "3.1": { de: "Mindestalter", en: "Minimum age" },
  "5.1": { de: "Rechtswidrige Inhalte", en: "Illegal content" },
  "5.2": { de: "Belästigung und Drohungen", en: "Harassment and threats" },
  "5.3": { de: "Hass", en: "Hate" },
  "5.4": { de: "Gewalt und Gewaltverherrlichung", en: "Violence and glorification of violence" },
  "5.5": { de: "Sexuelle Inhalte und Nacktheit", en: "Sexual content and nudity" },
  "5.6": { de: "Selbstverletzung", en: "Self-harm" },
  "5.7": { de: "Spam und Manipulation", en: "Spam and manipulation" },
  "5.8": { de: "Irreführende Informationen", en: "Misleading information" },
  "5.9": { de: "Identitätsanmaßung", en: "Impersonation" },
  "5.10": { de: "Privatsphäre anderer", en: "Privacy of others" },
  "5.11": { de: "Geistiges Eigentum", en: "Intellectual property" },
  "5.12": { de: "KI-generierte Inhalte", en: "AI-generated content" },
  "6.2": { de: "Umgehung von Sperren und Missbrauch des Dienstes", en: "Ban evasion and misuse of the service" },
};

export function TermsPage() {
  const { operator } = useOperator();
  const hashMatching = operator?.hashMatching === true;
  return (
    <LegalLayout title={{ de: "Nutzungsbedingungen", en: "Terms of use" }} version={termsVersion}>
      {(language) => language === "de" ? (
        <>
          <h2>1. Geltungsbereich</h2>
          <p>Diese Bedingungen gelten für die Nutzung des sozialen Netzwerks ysocial zwischen dir und dem im <a href="/legal/imprint">Impressum</a> genannten Betreiber. ysocial ist kostenlos und wird privat betrieben.</p>

          <h2>2. Leistungen</h2>
          <p>ysocial ermöglicht es, ein Profil anzulegen, Beiträge, Bilder, GIFs, Umfragen und Sprachnachrichten zu veröffentlichen, anderen zu folgen und Ende-zu-Ende-verschlüsselte Direktnachrichten zu senden. Ein Anspruch auf bestimmte Funktionen oder ständige Verfügbarkeit besteht nicht. Wir dürfen Funktionen ändern, wenn das für dich zumutbar ist.</p>
          <p>Der Feed auf der Startseite sortiert Beiträge mit einem Empfehlungssystem. Die wichtigsten Parameter, ihre Gewichtung und wie du sie beeinflussen kannst, beschreibt <a href="/legal/feed">So funktioniert der Feed</a>; diese Seite ist Teil dieser Bedingungen. „Folge ich“ zeigt Beiträge in zeitlicher Reihenfolge; diese Reihenfolge wird nicht personalisiert. Wenn du die Feed-Personalisierung eingeschaltet hast, speichern wir auch dort, welche Beiträge du gesehen hast, um den Feed zu verbessern; Einzelheiten stehen in der Datenschutzerklärung.</p>

          <h2>3. Registrierung</h2>
          <p><strong>3.1 Mindestalter.</strong> Du musst mindestens 16 Jahre alt sein. Mit der Registrierung bestätigst du das.</p>
          <p><strong>3.2 Pseudonyme.</strong> Du musst keinen echten Namen angeben. Handle und Anzeigename dürfen frei gewählt werden, solange sie nicht gegen Abschnitt 5 verstoßen.</p>
          <p><strong>3.3 Freischaltung.</strong> Neue Konten werden manuell von einer Warteliste freigeschaltet. Die Warteliste dient dazu, Missbrauch zu verhindern und das Wachstum von ysocial in der Beta-Phase gesund zu halten. Ein Anspruch auf Freischaltung besteht nicht.</p>
          <p><strong>3.4 Sicherheit.</strong> Halte deinen Login geschützt. Pro Person ist ein Konto erlaubt, Zweitkonten für klar erkennbare Zwecke (zum Beispiel ein Projekt) sind in Ordnung.</p>

          <h2>4. Deine Inhalte</h2>
          <p><strong>4.1</strong> Deine Inhalte bleiben deine. Du räumst uns ein einfaches, unentgeltliches, weltweites Recht ein, sie im Rahmen von ysocial zu speichern, anzuzeigen, technisch anzupassen (zum Beispiel Bilder zu verkleinern) und gemäß deinen Einstellungen anderen zugänglich zu machen. Das Recht endet, wenn du den Inhalt oder dein Konto löschst; Kopien in Backups verschwinden spätestens nach 30 Tagen.</p>
          <p><strong>4.2</strong> Du bist für deine Inhalte verantwortlich und versicherst, dass du die nötigen Rechte daran hast.</p>

          <h2>5. Regeln</h2>
          <p>Folgendes ist auf ysocial nicht erlaubt:</p>
          <p><strong>5.1 Rechtswidrige Inhalte</strong>, insbesondere Darstellungen sexuellen Kindesmissbrauchs, Terrorpropaganda, Volksverhetzung, Kennzeichen verfassungswidriger Organisationen, Beleidigung, üble Nachrede und Verleumdung.</p>
          <p><strong>5.2 Belästigung und Drohungen</strong> gegen Personen, einschließlich gezielter Kampagnen und dem Aufruf dazu.</p>
          <p><strong>5.3 Hass</strong> gegen Menschen aufgrund von Herkunft, Religion, Behinderung, Geschlecht, sexueller Orientierung, Geschlechtsidentität oder ähnlichen Merkmalen.</p>
          <p><strong>5.4 Gewalt und Gewaltverherrlichung</strong>, einschließlich drastischer Darstellungen ohne erkennbaren Kontext.</p>
          <p><strong>5.5 Sexuelle Inhalte und Nacktheit.</strong> Pornografische Inhalte sind nicht erlaubt.</p>
          <p><strong>5.6 Selbstverletzung.</strong> Inhalte, die Suizid oder Selbstverletzung fördern oder anleiten. Gespräche über eigene Erfahrungen und Hilfsangebote sind erlaubt.</p>
          <p><strong>5.7 Spam und Manipulation</strong>, zum Beispiel massenhafte Werbung, automatisierte Konten ohne Kennzeichnung oder künstliches Erzeugen von Interaktionen.</p>
          <p><strong>5.8 Irreführende Informationen</strong>, die geeignet sind, erheblichen Schaden anzurichten, etwa zu Wahlen oder Gesundheit.</p>
          <p><strong>5.9 Identitätsanmaßung.</strong> Sich als eine andere reale Person oder Organisation ausgeben. Klar gekennzeichnete Parodie ist erlaubt.</p>
          <p><strong>5.10 Privatsphäre anderer.</strong> Veröffentlichen privater Informationen anderer ohne deren Einwilligung (zum Beispiel Adressen oder private Fotos).</p>
          <p><strong>5.11 Geistiges Eigentum.</strong> Inhalte, die Urheber-, Marken- oder andere Schutzrechte verletzen.</p>
          <p><strong>5.12 KI-generierte Inhalte.</strong> Inhalte, die ganz oder überwiegend von generativer künstlicher Intelligenz erzeugt wurden, sind streng verboten. Das gilt für Texte, Bilder, GIFs, Videos, Sprachaufnahmen und synthetische Stimmen, auch in Profilbildern, Bannern und Profilangaben. Verstöße kannst du mit dem Grund „KI-generierte Inhalte“ melden.</p>

          <h2>6. Moderation</h2>
          <p><strong>6.1</strong> Wir prüfen gemeldete Inhalte und dürfen bei Verstößen gegen Gesetze oder diese Regeln Inhalte entfernen oder verbergen, Profilangaben zurücksetzen und Konten vorübergehend oder dauerhaft sperren. Wir handeln dabei sorgfältig, objektiv und verhältnismäßig und berücksichtigen die Grundrechte aller Beteiligten, insbesondere die Meinungsfreiheit.</p>
          <p><strong>6.2 Umgehung von Sperren</strong> und sonstiger Missbrauch des Dienstes, etwa Angriffe auf die Technik, sind verboten.</p>
          {hashMatching ? (
            <p><strong>6.3 Automatisierte Prüfungen.</strong> Hochgeladene Bilder werden automatisch auf Nacktheit und mit Prüfsummen auf bekannte Darstellungen sexuellen Kindesmissbrauchs geprüft. Bei einem Treffer wird der Upload blockiert. Entscheidungen über Konten trifft immer ein Mensch, außer bei Treffern auf bekannte Missbrauchsdarstellungen, bei denen das Konto sofort vorläufig gesperrt wird.</p>
          ) : (
            <p><strong>6.3 Automatisierte Prüfungen.</strong> Hochgeladene Bilder werden automatisch auf Nacktheit geprüft. Entscheidungen über Konten trifft immer ein Mensch.</p>
          )}
          <p><strong>6.4 Begründung.</strong> Wenn wir gegen deine Inhalte oder dein Konto vorgehen, informieren wir dich in der App über die Maßnahme, die Tatsachen, die Rechtsgrundlage oder Regel, ob automatisierte Mittel beteiligt waren und wie du dich wehren kannst (Art. 17 DSA).</p>
          <p><strong>6.5 Meldungen.</strong> Rechtswidrige Inhalte kann jede Person über das <a href="/report">Meldeformular</a> oder die Meldefunktion in der App melden. Wir bestätigen den Eingang und informieren über das Ergebnis. Verstöße gegen die Regeln in Abschnitt 5, etwa KI-generierte Inhalte (5.12), kann ebenfalls jede Person dort melden.</p>
          <p><strong>6.6 Straftaten.</strong> Bei Hinweisen auf Straftaten, die das Leben oder die Sicherheit von Personen bedrohen, informieren wir die Strafverfolgungsbehörden (Art. 18 DSA).</p>

          <h2>7. Beschwerden und Streitbeilegung</h2>
          <p>Gegen eine Moderationsentscheidung kannst du innerhalb von sechs Monaten in der App Beschwerde einlegen. Die Beschwerde prüft nach Möglichkeit eine andere Person als die, die entschieden hat. Du kannst dich außerdem an eine nach Art. 21 DSA zertifizierte außergerichtliche Streitbeilegungsstelle wenden oder den Rechtsweg beschreiten.</p>

          <h2>8. Kündigung und Löschung</h2>
          <p>Du kannst dein Konto jederzeit in den Einstellungen löschen. Wir können den Nutzungsvertrag mit einer Frist von zwei Wochen ordentlich kündigen, etwa wenn wir den Dienst einstellen, und bei schwerwiegenden Verstößen außerordentlich. Vor einer Einstellung des Dienstes kannst du deine Daten exportieren.</p>

          <h2>9. Haftung</h2>
          <p>Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit, bei Verletzung von Leben, Körper oder Gesundheit sowie nach dem Produkthaftungsgesetz. Bei leicht fahrlässiger Verletzung wesentlicher Vertragspflichten ist die Haftung auf den vorhersehbaren, vertragstypischen Schaden begrenzt. Im Übrigen ist die Haftung für leichte Fahrlässigkeit ausgeschlossen. Für Inhalte von Nutzenden haften wir nur nach den gesetzlichen Vorschriften, insbesondere ab Kenntnis.</p>

          <h2>10. Änderungen dieser Bedingungen</h2>
          <p>Wir können diese Bedingungen ändern, wenn sich der Dienst oder die Rechtslage ändert. Über Änderungen informieren wir in der App; die neue Fassung gilt, sobald du sie bestätigst. Ohne Bestätigung kannst du ysocial nicht weiter nutzen, aber jederzeit deine Daten exportieren und dein Konto löschen.</p>

          <h2>11. Schlussbestimmungen</h2>
          <p>Es gilt deutsches Recht. Wenn du Verbraucherin oder Verbraucher mit gewöhnlichem Aufenthalt in einem anderen Staat bist, bleiben dir die zwingenden Verbraucherschutzvorschriften dieses Staates erhalten. Sollte eine Bestimmung unwirksam sein, bleibt der Rest wirksam.</p>
        </>
      ) : (
        <>
          <h2>1. Scope</h2>
          <p>These terms govern your use of the social network ysocial between you and the operator named in the <a href="/legal/imprint?lang=en">imprint</a>. ysocial is free and run privately.</p>

          <h2>2. Services</h2>
          <p>ysocial lets you create a profile, publish posts, images, GIFs, polls and voice notes, follow others and send end-to-end encrypted direct messages. There is no entitlement to specific features or constant availability. We may change features where this is reasonable for you.</p>
          <p>The Feed on the home page orders posts with a recommender system. Its main parameters, their weight and how you can influence them are described in <a href="/legal/feed?lang=en">How the feed works</a>; that page is part of these terms. Following shows posts in time order, and that order is never personalized. If you turned on feed personalization, we also record which posts you saw there to improve the Feed; the privacy policy has the details.</p>

          <h2>3. Registration</h2>
          <p><strong>3.1 Minimum age.</strong> You must be at least 16 years old. You confirm this when you sign up.</p>
          <p><strong>3.2 Pseudonyms.</strong> You do not have to use your real name. You may choose your handle and display name freely as long as they do not break section 5.</p>
          <p><strong>3.3 Approval.</strong> New accounts are approved manually from a waitlist. The waitlist exists to prevent abuse and to support healthy growth of ysocial during its beta phase. There is no entitlement to approval.</p>
          <p><strong>3.4 Security.</strong> Keep your login safe. One account per person; additional accounts for clearly recognisable purposes (for example a project) are fine.</p>

          <h2>4. Your content</h2>
          <p><strong>4.1</strong> Your content remains yours. You grant us a simple, free, worldwide right to store it within ysocial, display it, adapt it technically (for example resize images) and make it available to others according to your settings. This right ends when you delete the content or your account; copies in backups disappear within 30 days.</p>
          <p><strong>4.2</strong> You are responsible for your content and confirm that you hold the necessary rights to it.</p>

          <h2>5. Rules</h2>
          <p>The following is not allowed on ysocial:</p>
          <p><strong>5.1 Illegal content</strong>, in particular child sexual abuse material, terrorist propaganda, incitement to hatred, symbols of unconstitutional organisations, insult, defamation and slander.</p>
          <p><strong>5.2 Harassment and threats</strong> against people, including targeted campaigns and calls for them.</p>
          <p><strong>5.3 Hate</strong> against people based on origin, religion, disability, sex, sexual orientation, gender identity or similar characteristics.</p>
          <p><strong>5.4 Violence and glorification of violence</strong>, including graphic depictions without recognisable context.</p>
          <p><strong>5.5 Sexual content and nudity.</strong> Pornographic content is not allowed.</p>
          <p><strong>5.6 Self-harm.</strong> Content that promotes or instructs suicide or self-harm. Talking about your own experiences and offering help is allowed.</p>
          <p><strong>5.7 Spam and manipulation</strong>, for example mass advertising, unlabelled automated accounts or artificially generated interactions.</p>
          <p><strong>5.8 Misleading information</strong> likely to cause serious harm, for example about elections or health.</p>
          <p><strong>5.9 Impersonation.</strong> Pretending to be another real person or organisation. Clearly labelled parody is allowed.</p>
          <p><strong>5.10 Privacy of others.</strong> Publishing other people's private information without their consent (for example addresses or private photos).</p>
          <p><strong>5.11 Intellectual property.</strong> Content that infringes copyright, trademarks or other protected rights.</p>
          <p><strong>5.12 AI-generated content.</strong> Content created wholly or largely by generative artificial intelligence is strictly forbidden. This covers text, images, GIFs, video, voice recordings and synthetic voices, including in profile pictures, banners and profile details. You can report it with the reason “AI-generated content”.</p>

          <h2>6. Moderation</h2>
          <p><strong>6.1</strong> We review reported content and, where laws or these rules are broken, may remove or hide content, reset profile details and suspend accounts temporarily or permanently. We act diligently, objectively and proportionately and take the fundamental rights of everyone involved into account, in particular freedom of expression.</p>
          <p><strong>6.2 Ban evasion</strong> and other misuse of the service, such as attacks on its technology, are prohibited.</p>
          {hashMatching ? (
            <p><strong>6.3 Automated checks.</strong> Uploaded images are checked automatically for nudity and, using hashes, for known child sexual abuse material. On a match, the upload is blocked. Decisions about accounts are always taken by a person, except for matches with known abuse material, where the account is suspended immediately pending review.</p>
          ) : (
            <p><strong>6.3 Automated checks.</strong> Uploaded images are checked automatically for nudity. Decisions about accounts are always taken by a person.</p>
          )}
          <p><strong>6.4 Statement of reasons.</strong> When we act against your content or account, we tell you in the app what we did, the facts, the legal ground or rule, whether automated means were involved and how you can contest it (Art. 17 DSA).</p>
          <p><strong>6.5 Reports.</strong> Anyone can report illegal content through the <a href="/report">report form</a> or the report option in the app. We confirm receipt and inform you of the outcome. Anyone can also report breaches of the rules in section 5 there, such as AI-generated content (5.12).</p>
          <p><strong>6.6 Criminal offences.</strong> If we become aware of offences that threaten the life or safety of people, we inform law enforcement (Art. 18 DSA).</p>

          <h2>7. Appeals and dispute resolution</h2>
          <p>You can appeal a moderation decision in the app within six months. Where possible, the appeal is reviewed by someone other than the person who decided. You can also turn to an out-of-court dispute settlement body certified under Art. 21 DSA or go to court.</p>

          <h2>8. Termination and deletion</h2>
          <p>You can delete your account at any time in settings. We may terminate the agreement with two weeks' notice, for example if we shut down the service, and without notice for serious breaches. Before a shutdown you can export your data.</p>

          <h2>9. Liability</h2>
          <p>We are liable without limitation for intent and gross negligence, for injury to life, body or health and under the German Product Liability Act. For slightly negligent breach of essential contractual obligations, liability is limited to the foreseeable damage typical for this type of contract. Otherwise liability for slight negligence is excluded. For user content we are only liable as provided by law, in particular from the time we become aware of it.</p>

          <h2>10. Changes to these terms</h2>
          <p>We may change these terms when the service or the law changes. We announce changes in the app; the new version applies once you confirm it. Without confirming you cannot keep using ysocial, but you can export your data and delete your account at any time.</p>

          <h2>11. Final provisions</h2>
          <p>German law applies. If you are a consumer habitually resident in another country, the mandatory consumer protection rules of that country still apply to you. If a provision is invalid, the rest remains in force.</p>
        </>
      )}
    </LegalLayout>
  );
}
