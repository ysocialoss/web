import { LegalLayout } from "./legal-layout";
import { useOperator } from "./use-operator";
import { collectedFeedData } from "./account-gates";

export const privacyVersion = "2026-12-01";

const storageKeys = [
  { key: "theme, branding", de: "Gewähltes Farbschema und Logo", en: "Chosen colour scheme and logo" },
  { key: "ysocial:show-hidden-navigation, ysocial:skip-external-link-warning", de: "Anzeigeeinstellungen, die du selbst gesetzt hast", en: "Display settings you chose" },
  { key: "ysocial:dismiss-staging-notice, notification-prompt-dismissed, approval-welcome", de: "Merkt sich, dass du einen Hinweis geschlossen hast", en: "Remembers that you closed a notice" },
  { key: "session-hint", de: "Handle, Anzeigename und Avatar des angemeldeten Kontos für einen schnellen Start; wird beim Abmelden gelöscht", en: "Handle, display name and avatar of the signed-in account for a fast start; removed when you log out" },
  { key: "ysocial:recent-searches", de: "Deine letzten Suchanfragen, nur auf deinem Gerät; in der Suche löschbar", en: "Your recent searches, only on your device; can be cleared in search" },
  { key: "trending-topics", de: "Zwischenspeicher öffentlicher Trendthemen", en: "Cache of public trending topics" },
  { key: "IndexedDB ysocial-encrypted-dms", de: "Schlüssel für deine Ende-zu-Ende-verschlüsselten Direktnachrichten", en: "Keys for your end-to-end encrypted direct messages" },
  { key: "Cookie session", de: "Hält dich angemeldet (HttpOnly, 30 Tage)", en: "Keeps you signed in (HttpOnly, 30 days)" },
  { key: "Cookie oauth_browser", de: "Schützt den Anmeldevorgang vor Fälschung (10 Minuten)", en: "Protects the sign-in flow against forgery (10 minutes)" },
  { key: "Service Worker sw.js", de: "Nur wenn du Push-Benachrichtigungen aktivierst", en: "Only if you turn on push notifications" },
];

const retention = [
  { de: "Konto, Profil, Beiträge, Medien", en: "Account, profile, posts, media", value: { de: "Bis zur Löschung durch dich; danach sofort, aus Backups nach spätestens 30 Tagen", en: "Until you delete them; then immediately, from backups within 30 days" } },
  { de: "Feed-Nutzungsdaten (Ansichten, Verweildauer)", en: "Feed usage data (views, dwell time)", value: { de: "180 Tage", en: "180 days" } },
  { de: "Feed-Interaktionsdaten (Likes, Follows usw. als Signal)", en: "Feed interaction signals (likes, follows etc.)", value: { de: "12 Monate", en: "12 months" } },
  { de: "Meldungen und ihre Momentaufnahmen", en: "Reports and their snapshots", value: { de: "6 Monate nach Abschluss, bei Weitergabe an Behörden 12 Monate", en: "6 months after closing, 12 months if passed to authorities" } },
  { de: "Moderationsentscheidungen und Beschwerden", en: "Moderation decisions and appeals", value: { de: "12 Monate", en: "12 months" } },
  { de: "Vom Bildfilter markierte Uploads", en: "Uploads flagged by the image filter", value: { de: "7 Tage", en: "7 days" } },
  { de: "Kontaktnachrichten", en: "Contact messages", value: { de: "3 Monate nach Bearbeitung, unbearbeitet 12 Monate", en: "3 months after handling, 12 months if unhandled" } },
  { de: "Sitzungen", en: "Sessions", value: { de: "Bis zur Abmeldung, höchstens 30 Tage", en: "Until you log out, at most 30 days" } },
  { de: "Hinweise auf Missbrauchsdarstellungen (nur Prüfsumme und Metadaten)", en: "Child sexual abuse material incidents (hash and metadata only)", value: { de: "12 Monate oder solange ein Verfahren läuft", en: "12 months or while proceedings are ongoing" } },
];

const hashMatchingRetention = { de: "Hinweise auf Missbrauchsdarstellungen (nur Prüfsumme und Metadaten)", en: "Child sexual abuse material incidents (hash and metadata only)", value: { de: "12 Monate oder solange ein Verfahren läuft", en: "12 months or while proceedings are ongoing" } };

export function PrivacyPage() {
  const { operator } = useOperator();
  const controller = operator
    ? <address className="not-italic">{operator.name}{operator.address.map((line) => <span key={line} className="block">{line}</span>)}</address>
    : <p><a href="/legal/imprint">Impressum / Imprint</a></p>;
  const hashMatching = operator?.hashMatching === true;
  const retentionRows = hashMatching ? [...retention, hashMatchingRetention] : retention;
  const privacyMail = operator?.contacts.privacy ?? operator?.email;
  const mail = privacyMail ? <a href={`mailto:${privacyMail}`}>{privacyMail}</a> : <a href="/legal/imprint">Impressum</a>;
  return (
    <LegalLayout title={{ de: "Datenschutzerklärung", en: "Privacy policy" }} version={privacyVersion}>
      {(language) => language === "de" ? (
        <>
          <p>Diese Erklärung beschreibt, welche personenbezogenen Daten ysocial verarbeitet, wofür, auf welcher Rechtsgrundlage und wie lange. Kurz gesagt: Wir verarbeiten nur, was für den Betrieb des Netzwerks nötig ist, setzen keine Werbe- oder Analyse-Tracker ein und verkaufen keine Daten.</p>

          <h2>1. Verantwortlicher</h2>
          {controller}
          <p>Datenschutzanfragen: {mail}. Ein Datenschutzbeauftragter ist nicht benannt, weil die gesetzlichen Voraussetzungen (Art. 37 DSGVO, § 38 BDSG) nicht vorliegen.</p>

          <h2>2. Anmeldung über CNS</h2>
          <p>Die Anmeldung erfolgt über CNS, den Login-Dienst desselben Betreibers. Dabei erhalten wir eine pseudonyme Kennung, Benutzername, Name und Profilbild aus deinem CNS-Konto (Scopes <code>openid profile</code>). Die Zugangstoken werden verschlüsselt gespeichert und beim Abmelden oder Löschen widerrufen. Rechtsgrundlage: Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO).</p>

          <h2>3. Konto, Profil und Inhalte</h2>
          <p>Wir speichern Handle, Anzeigename, Bio, Pronomen, Avatar, Banner, Beiträge, Antworten, Umfragen, Sprachnachrichten, Bilder sowie Likes, Reposts, Lesezeichen, Follows und Blockierungen. Öffentliche Beiträge und Profile sind für alle sichtbar. Du musst keinen echten Namen verwenden; Pseudonyme sind ausdrücklich erlaubt (§ 19 TDDDG). Neue Konten werden manuell von einer Warteliste freigeschaltet. Die Warteliste dient dazu, Missbrauch zu verhindern und das Wachstum von ysocial in der Beta-Phase gesund zu halten. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.</p>
          <p>Beim Hochladen von Bildern entfernen wir alle Metadaten wie EXIF und GPS-Standort, indem jedes Bild neu kodiert wird. Sprachnachrichten werden ebenfalls ohne Metadaten neu kodiert.</p>

          <h2>4. Direktnachrichten</h2>
          <p>Direktnachrichten und ihre Anhänge sind Ende-zu-Ende-verschlüsselt. Der Server speichert nur verschlüsselte Inhalte und Metadaten (Teilnehmende, Zeitpunkte, Geräteschlüssel). Inhalte sehen wir nur, wenn du eine Nachricht meldest; dann wird der gemeldete Ausschnitt entschlüsselt mitgesendet.</p>

          <h2>5. Sicherheit und Bildprüfung</h2>
          <p>Hochgeladene Bilder prüft ein selbst betriebenes Klassifikationsmodell automatisch auf Nacktheit. Abgelehnte Uploads werden 7 Tage für eine Überprüfung durch das Moderationsteam aufbewahrt. Rechtsgrundlage: berechtigtes Interesse am Schutz der Nutzenden und Dritter (Art. 6 Abs. 1 lit. f DSGVO).</p>
          {hashMatching && (
            <p>Zusätzlich gleichen wir hochgeladene Bilder mit Prüfsummen (Hashes) bekannter Darstellungen sexuellen Kindesmissbrauchs ab (Microsoft PhotoDNA). Bei einem Treffer wird der Upload blockiert, das Bild nicht gespeichert, nur eine Prüfsumme mit Metadaten (Konto, Zeitpunkt, IP-Adresse) gesichert und das Konto vorläufig gesperrt. Treffer melden wir den zuständigen Behörden. Rechtsgrundlage: berechtigtes Interesse am Schutz von Kindern und anderen (Art. 6 Abs. 1 lit. f DSGVO) sowie, soweit wir Straftaten melden müssen, rechtliche Pflichten (Art. 6 Abs. 1 lit. c DSGVO, Art. 18 DSA). Microsoft verarbeitet die Bilder in unserem Auftrag; eine Übermittlung in die USA stützt sich auf das EU-US Data Privacy Framework.</p>
          )}

          <h2>6. Feed-Personalisierung</h2>
          <p>Wenn du die Feed-Personalisierung einschaltest, zeichnen wir auf, wie du den Feed auf ysocial nutzt:</p>
          <ul>{collectedFeedData.map((item) => <li key={item.de}>{item.de}</li>)}</ul>
          <p>Zweck ist, dir künftig relevantere Beiträge zu zeigen. Rechtsgrundlage ist unser berechtigtes Interesse an einem relevanten Feed (Art. 6 Abs. 1 lit. f DSGVO). Wir verwenden ausschließlich Daten aus ysocial, keine Daten anderer Websites, keine Werbe-IDs und keine Fingerprints. Vor der ersten Aufzeichnung fragen wir dich ausdrücklich. Du kannst jederzeit widersprechen (Art. 21 DSGVO), indem du die Einstellung ausschaltest; die bisher aufgezeichneten Daten werden dann gelöscht. Die Personalisierung hat keine rechtliche oder ähnlich erhebliche Wirkung für dich (keine Entscheidung nach Art. 22 DSGVO). Wie der Feed funktioniert, steht unter <a href="/legal/feed">So funktioniert der Feed</a>.</p>

          <h2>7. Meldungen, Moderation, Beschwerden und Kontakt</h2>
          <p>Wenn du Inhalte meldest, speichern wir Grund, Erläuterung, eine Momentaufnahme des Inhalts und dein Konto bzw. bei Meldungen ohne Konto Name und E-Mail-Adresse (bei Meldungen von Missbrauchsdarstellungen freiwillig). Wenn wir gegen Inhalte oder Konten vorgehen, speichern wir die Entscheidung mit Begründung und informieren die betroffene Person (Art. 17 DSA). Rechtsgrundlage: rechtliche Pflichten nach dem Digital Services Act (Art. 6 Abs. 1 lit. c DSGVO) und unser berechtigtes Interesse an einer sicheren Plattform (lit. f). Bei Hinweisen auf eine Gefahr für Leben oder Sicherheit geben wir Daten an Strafverfolgungsbehörden weiter (Art. 18 DSA).</p>
          <p>Wenn du das <a href="/contact">Kontaktformular</a> nutzt, speichern wir deine Nachricht sowie die freiwillig angegebenen Angaben Name und E-Mail-Adresse, um dir zu antworten. Die Nachrichten sehen nur Administratoren. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO, soweit deine Anfrage unseren Nutzungsvertrag betrifft, sonst lit. f (Bearbeitung von Anfragen). Wir löschen Nachrichten 3 Monate nach der Bearbeitung, unbearbeitete nach 12 Monaten.</p>

          <h2>8. Verknüpfte Konten</h2>
          <p>Du kannst freiwillig Konten bei Discord, Twitch, Steam, GitHub sowie Links zu Spotify oder Apple Music verknüpfen. Dabei wirst du zum jeweiligen Anbieter weitergeleitet. Wir fordern nur die kleinsten nötigen Berechtigungen an (bei Discord <code>identify</code>, bei GitHub und Twitch keine zusätzlichen Scopes) und speichern nur Kennung, Benutzername, Anzeigename und Profil-Link. Zugangstoken werden nach dem Abruf sofort verworfen. Für GitHub lesen wir die öffentliche Beitragszahl, für Twitch den öffentlichen Live-Status. Beim Trennen werden die gespeicherten Daten gelöscht. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.</p>

          <h2>9. GIFs, Link-Vorschauen und eingebettete Inhalte</h2>
          <p>Die GIF-Suche nutzt den Dienst KLIPY. Suchanfragen sendet unser Server mit einer pseudonymen Kennung; GIFs werden über unseren Server ausgeliefert, sodass KLIPY deine IP-Adresse nicht erhält. Link-Vorschauen und Website-Icons ruft ebenfalls unser Server ab. YouTube-Videos und externe Bilder in Direktnachrichten werden erst nach deinem Klick geladen; dann überträgt dein Browser deine IP-Adresse an den jeweiligen Anbieter (bei YouTube über youtube-nocookie.com).</p>

          <h2>10. Push-Benachrichtigungen</h2>
          <p>Wenn du Push-Benachrichtigungen aktivierst, speichern wir die von deinem Browser erzeugte Push-Adresse. Benachrichtigungen werden verschlüsselt über den Push-Dienst deines Browserherstellers (zum Beispiel Google, Mozilla oder Apple) zugestellt. Du kannst den Inhalt in Benachrichtigungen ausblenden. Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO; die Einwilligung kannst du jederzeit in den Einstellungen widerrufen.</p>

          <h2>11. Server-Logs</h2>
          <p>Beim Aufruf speichert unser Webserver technische Zugriffsdaten (Zeitpunkt, Adresse, Statuscode, Browserkennung) mit gekürzter IP-Adresse für 7 Tage, um Fehler und Angriffe zu erkennen (Art. 6 Abs. 1 lit. f DSGVO). Die Anwendung selbst speichert keine IP-Adressen. Für das öffentliche Meldeformular wird die IP-Adresse 10 Minuten lang nur im Arbeitsspeicher gehalten, um Missbrauch zu begrenzen.</p>

          <h2>12. Speicherung auf deinem Gerät</h2>
          <p>Wir setzen keine Cookies oder vergleichbaren Speicher für Werbung, Analyse oder Tracking ein und brauchen deshalb kein Cookie-Banner. Alle Einträge sind für den von dir gewünschten Dienst unbedingt erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG):</p>
          <table><thead><tr><th>Eintrag</th><th>Zweck</th></tr></thead><tbody>
            {storageKeys.map((entry) => <tr key={entry.key}><td><code>{entry.key}</code></td><td>{entry.de}</td></tr>)}
          </tbody></table>

          <h2>13. Empfänger und Auftragsverarbeiter</h2>
          <ul>
            <li>Hosting und Login (CNS): eigene Infrastruktur des Betreibers.</li>
            <li>Auslieferung und Schutz der Website (Content-Delivery-Netzwerk, Cloudflare Tunnel) sowie Speicherung von Avataren, Bannern, Sprachnachrichten, Beitragsbildern und verschlüsselten Anhängen von Direktnachrichten (Cloudflare R2, Speicherort EU): Cloudflare, Inc. als Auftragsverarbeiter; Standardvertragsklauseln und EU-US Data Privacy Framework.</li>
            {hashMatching && <li>Abgleich mit bekannten Missbrauchsdarstellungen: Microsoft PhotoDNA.</li>}
            <li>GIF-Suche: KLIPY (nur Suchbegriff und pseudonyme Kennung).</li>
            <li>Strafverfolgungsbehörden, wenn wir gesetzlich dazu verpflichtet sind oder eine Gefahr für Leben oder Sicherheit besteht.</li>
          </ul>

          <h2>14. Speicherdauer</h2>
          <table><thead><tr><th>Daten</th><th>Dauer</th></tr></thead><tbody>
            {retentionRows.map((row) => <tr key={row.de}><td>{row.de}</td><td>{row.value.de}</td></tr>)}
          </tbody></table>

          <h2>15. Deine Rechte</h2>
          <p>Du hast das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21 DSGVO) sowie das Recht, erteilte Einwilligungen zu widerrufen. Vieles geht direkt in der App:</p>
          <ul>
            <li>Einstellungen, Datenschutz und Sicherheit: Daten als ZIP-Datei herunterladen und Feed-Daten löschen. Inhalte von Direktnachrichten sind Ende-zu-Ende-verschlüsselt und können nur auf deinen Geräten gelesen werden; der Export enthält ihre Metadaten.</li>
            <li>Profil bearbeiten: Angaben berichtigen.</li>
            <li>Einstellungen, Verbindungen: verknüpfte Konten trennen.</li>
            <li>Einstellungen, Konto: Konto endgültig löschen.</li>
          </ul>
          <p>Für alles andere schreib an {mail}. Wir antworten innerhalb eines Monats.</p>
          <p>Du kannst dich bei einer Datenschutzaufsichtsbehörde beschweren, zum Beispiel bei der für uns zuständigen: Unabhängiges Landeszentrum für Datenschutz Schleswig-Holstein (ULD), Holstenstraße 98, 24103 Kiel, <a href="https://www.datenschutzzentrum.de">www.datenschutzzentrum.de</a>.</p>

          <h2>16. Mindestalter</h2>
          <p>ysocial richtet sich an Personen ab 16 Jahren. Bei der Registrierung bestätigst du dein Alter. Konten von jüngeren Personen löschen wir, sobald wir davon erfahren.</p>

          <h2>17. Änderungen</h2>
          <p>Wir passen diese Erklärung an, wenn sich der Dienst ändert. Die jeweils aktuelle Fassung steht auf dieser Seite.</p>
        </>
      ) : (
        <>
          <p>This policy explains which personal data ysocial processes, why, on which legal basis and for how long. In short: we only process what is needed to run the network, we use no advertising or analytics trackers, and we never sell data.</p>

          <h2>1. Controller</h2>
          {controller}
          <p>Privacy requests: {mail}. No data protection officer is appointed because the legal requirements (Art. 37 GDPR, § 38 BDSG) are not met.</p>

          <h2>2. Signing in with CNS</h2>
          <p>You sign in through CNS, the login service run by the same operator. We receive a pseudonymous identifier, username, name and profile picture from your CNS account (scopes <code>openid profile</code>). Access tokens are stored encrypted and revoked when you log out or delete your account. Legal basis: performance of a contract (Art. 6(1)(b) GDPR).</p>

          <h2>3. Account, profile and content</h2>
          <p>We store your handle, display name, bio, pronouns, avatar, banner, posts, replies, polls, voice notes and images, as well as likes, reposts, bookmarks, follows and blocks. Public posts and profiles are visible to everyone. You never need to use your real name; pseudonyms are explicitly allowed (§ 19 TDDDG). New accounts are approved manually from a waitlist. The waitlist exists to prevent abuse and to support healthy growth of ysocial during its beta phase. Legal basis: Art. 6(1)(b) GDPR.</p>
          <p>When you upload images, we remove all metadata such as EXIF and GPS location by re-encoding every image. Voice notes are re-encoded without metadata too.</p>

          <h2>4. Direct messages</h2>
          <p>Direct messages and their attachments are end-to-end encrypted. The server only stores encrypted content and metadata (participants, timestamps, device keys). We only see content if you report a message, in which case the reported excerpt is decrypted and sent along.</p>

          <h2>5. Safety and image checks</h2>
          <p>A self-hosted classification model automatically checks uploaded images for nudity. Rejected uploads are kept for 7 days so the moderation team can review them. Legal basis: our legitimate interest in protecting users and others (Art. 6(1)(f) GDPR).</p>
          {hashMatching && (
            <p>We also compare uploaded images with hashes of known child sexual abuse material (Microsoft PhotoDNA). On a match, the upload is blocked, the image is not stored, only a hash with metadata (account, time, IP address) is preserved and the account is suspended pending review. We report matches to the competent authorities. Legal basis: our legitimate interest in protecting children and others (Art. 6(1)(f) GDPR) and, where we are obliged to report criminal offences, legal obligations (Art. 6(1)(c) GDPR, Art. 18 DSA). Microsoft processes the images on our behalf; a transfer to the USA relies on the EU-US Data Privacy Framework.</p>
          )}

          <h2>6. Feed personalization</h2>
          <p>If you turn on feed personalization, we record how you use the feed on ysocial:</p>
          <ul>{collectedFeedData.map((item) => <li key={item.en}>{item.en}</li>)}</ul>
          <p>The purpose is to show you more relevant posts in future. The legal basis is our legitimate interest in a relevant feed (Art. 6(1)(f) GDPR). We only use data from ysocial, no data from other websites, no advertising IDs and no fingerprinting. We ask you explicitly before anything is recorded. You can object at any time (Art. 21 GDPR) by switching the setting off; the data recorded so far is then deleted. Personalization has no legal or similarly significant effect on you (no decision under Art. 22 GDPR). See <a href="/legal/feed?lang=en">How the feed works</a>.</p>

          <h2>7. Reports, moderation, appeals and contact</h2>
          <p>When you report content we store the reason, your explanation, a snapshot of the content and your account, or for reports without an account your name and email address (optional for reports of child sexual abuse material). When we act against content or accounts, we store the decision with its reasons and inform the person affected (Art. 17 DSA). Legal basis: legal obligations under the Digital Services Act (Art. 6(1)(c) GDPR) and our legitimate interest in a safe platform (point (f)). If there are signs of a threat to life or safety, we pass data to law enforcement (Art. 18 DSA).</p>
          <p>If you use the <a href="/contact?lang=en">contact form</a>, we store your message and the name and email address you optionally give, so that we can reply. Only administrators can see the messages. Legal basis: Art. 6(1)(b) GDPR where your request concerns our user agreement, otherwise point (f) (handling enquiries). We delete messages 3 months after they are handled and unhandled ones after 12 months.</p>

          <h2>8. Linked accounts</h2>
          <p>You can choose to link accounts on Discord, Twitch, Steam and GitHub, and links to Spotify or Apple Music. You are redirected to the provider for this. We request the smallest permissions needed (<code>identify</code> on Discord, no extra scopes on GitHub and Twitch) and only store the identifier, username, display name and profile link. Access tokens are discarded right after use. For GitHub we read the public contribution count, for Twitch the public live status. Disconnecting deletes the stored data. Legal basis: Art. 6(1)(b) GDPR.</p>

          <h2>9. GIFs, link previews and embedded content</h2>
          <p>GIF search uses the KLIPY service. Our server sends search queries with a pseudonymous identifier, and GIFs are delivered through our server, so KLIPY does not receive your IP address. Our server also fetches link previews and website icons. YouTube videos and external images in direct messages only load after you click; your browser then sends your IP address to that provider (for YouTube via youtube-nocookie.com).</p>

          <h2>10. Push notifications</h2>
          <p>If you turn on push notifications, we store the push address your browser creates. Notifications are delivered encrypted through your browser vendor's push service (for example Google, Mozilla or Apple). You can hide content in notifications. Legal basis: Art. 6(1)(a) GDPR; you can withdraw consent at any time in settings.</p>

          <h2>11. Server logs</h2>
          <p>Our web server stores technical access data (time, address, status code, browser identifier) with a truncated IP address for 7 days to detect errors and attacks (Art. 6(1)(f) GDPR). The application itself does not store IP addresses. For the public report form, your IP address is kept in memory only for 10 minutes to limit abuse.</p>

          <h2>12. Storage on your device</h2>
          <p>We use no cookies or similar storage for advertising, analytics or tracking, so no cookie banner is needed. Every entry is strictly necessary for the service you asked for (§ 25(2) no. 2 TDDDG):</p>
          <table><thead><tr><th>Entry</th><th>Purpose</th></tr></thead><tbody>
            {storageKeys.map((entry) => <tr key={entry.key}><td><code>{entry.key}</code></td><td>{entry.en}</td></tr>)}
          </tbody></table>

          <h2>13. Recipients and processors</h2>
          <ul>
            <li>Hosting and login (CNS): the operator's own infrastructure.</li>
            <li>Delivery and protection of the website (content delivery network, Cloudflare Tunnel) and storage of avatars, banners, voice notes, post images and encrypted direct message attachments (Cloudflare R2, EU data location): Cloudflare, Inc. as processor; standard contractual clauses and EU-US Data Privacy Framework.</li>
            {hashMatching && <li>Matching against known child sexual abuse material: Microsoft PhotoDNA.</li>}
            <li>GIF search: KLIPY (search term and pseudonymous identifier only).</li>
            <li>Law enforcement, where we are legally obliged or there is a threat to life or safety.</li>
          </ul>

          <h2>14. Retention</h2>
          <table><thead><tr><th>Data</th><th>Period</th></tr></thead><tbody>
            {retentionRows.map((row) => <tr key={row.en}><td>{row.en}</td><td>{row.value.en}</td></tr>)}
          </tbody></table>

          <h2>15. Your rights</h2>
          <p>You have the right of access (Art. 15), rectification (Art. 16), erasure (Art. 17), restriction (Art. 18), data portability (Art. 20) and to object (Art. 21 GDPR), and to withdraw any consent. Much of this works directly in the app:</p>
          <ul>
            <li>Settings, Privacy and safety: download your data as a ZIP file and clear feed data. Direct message content is end-to-end encrypted and can only be read on your devices; the export contains its metadata.</li>
            <li>Edit profile: correct your details.</li>
            <li>Settings, Connections: disconnect linked accounts.</li>
            <li>Settings, Account: delete your account permanently.</li>
          </ul>
          <p>For anything else, write to {mail}. We answer within one month.</p>
          <p>You can complain to a data protection supervisory authority, for example the one responsible for us: Unabhängiges Landeszentrum für Datenschutz Schleswig-Holstein (ULD), Holstenstraße 98, 24103 Kiel, Germany, <a href="https://www.datenschutzzentrum.de">www.datenschutzzentrum.de</a>.</p>

          <h2>16. Minimum age</h2>
          <p>ysocial is for people aged 16 and over. You confirm your age when you sign up. We delete accounts of younger people as soon as we learn about them.</p>

          <h2>17. Changes</h2>
          <p>We update this policy when the service changes. The current version is always on this page.</p>
        </>
      )}
    </LegalLayout>
  );
}
