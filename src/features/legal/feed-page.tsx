import { LegalLayout } from "./legal-layout";
import { collectedFeedData } from "./account-gates";
import { termsVersion } from "./terms-page";

export function FeedExplainerPage() {
  return (
    <LegalLayout title={{ de: "So funktioniert der Feed", en: "How the feed works" }} version={termsVersion}>
      {(language) => language === "de" ? (
        <>
          <p>Hier erklären wir, nach welchen Kriterien ysocial Beiträge anzeigt, wie stark sie gewichtet werden und welche Daten dafür genutzt werden.</p>
          <h2>Feed (Beta)</h2>
          <p>Der Feed auf der Startseite sortiert Beiträge danach, wie wahrscheinlich sie dich interessieren. Er funktioniert in drei Schritten.</p>
          <h3>1. Auswahl</h3>
          <p>In Frage kommen Beiträge der letzten 72 Stunden (bei wenigen Beiträgen der letzten 7 Tage) und gerade beliebte Beiträge. Wenn du die Feed-Personalisierung eingeschaltet hast, kommen Beiträge dazu, die Konten, denen du folgst, repostet, beantwortet oder geliked haben. Nicht angezeigt werden deine eigenen Beiträge, Beiträge, die du schon geliked, repostet, gespeichert oder beantwortet hast, Beiträge, die du in den letzten 24 Stunden gesehen hast (außer jemand, dem du folgst, hat sie seitdem repostet oder beantwortet), sowie Beiträge von Konten, die du blockiert hast oder die dich blockiert haben, und verborgene oder gesperrte Inhalte.</p>
          <h3>2. Bewertung</h3>
          <p>Für jeden Beitrag schätzen wir, wie wahrscheinlich bestimmte Reaktionen sind, und addieren sie mit diesen Gewichten:</p>
          <ul>
            <li>Antworten: 4</li>
            <li>Repost, Zitat oder Teilen: 3</li>
            <li>Speichern: 3</li>
            <li>Like: 2</li>
            <li>Öffnen des Beitrags oder seiner Medien: 1</li>
            <li>Öffnen des Profils: 1</li>
            <li>Mindestens 3 Sekunden lesen: 0,5</li>
            <li>Dem Konto folgen, wenn du ihm noch nicht folgst: 5</li>
            <li>Negative Reaktionen wie Blockieren oder Melden: minus 20</li>
          </ul>
          <p>Für die Schätzung nutzen wir das Alter und die Art des Beitrags (Antwort, Zitat, Bild, Sprachnachricht, Umfrage, Link, Länge), ob du dem Konto folgst und es dir, wie oft du in den letzten 21 Tagen mit dem Konto interagiert hast, ob Konten, denen du folgst, den Beitrag geliked, repostet oder beantwortet haben, wie beliebt der Beitrag insgesamt und gerade ist, wie oft andere ihn öffnen und lesen, Themen, mit denen du oft interagierst, und ob du ihn in der letzten Woche schon gesehen hast. Die Gewichte sind derzeit von Hand festgelegt. Später lernen wir sie aus den Nutzungsdaten; dann aktualisieren wir diese Seite.</p>
          <h3>3. Frische und Vielfalt</h3>
          <p>Die Bewertung halbiert sich mit jeweils 24 Stunden Alter, fällt aber nie unter 30 Prozent. Beiträge, die du vor 1 bis 7 Tagen gesehen hast, zählen nur zu 30 Prozent. Dasselbe Konto erscheint nie zweimal hintereinander und höchstens zweimal unter zehn Beiträgen. Ab dem vierten Platz ist etwa jeder zehnte Platz eine zufällige Auswahl weiter unten aus der Liste, damit der Feed nicht nur mehr vom Gleichen zeigt.</p>
          <h3>Ohne Personalisierung</h3>
          <p>Der Feed braucht die Feed-Personalisierung. Wenn du sie ausgeschaltet hast, ist der Feed ausgegraut und du landest bei „Folge ich"; mit einem Tipp auf den Feed kannst du sie einschalten. Wer nicht angemeldet ist oder sich noch nicht entschieden hat, sieht dieselbe Sortierung nur mit öffentlichen Signalen (Beliebtheit, Frische, Vielfalt); dabei werden keine Daten über dich genutzt oder gespeichert.</p>
          <h2>Folge ich</h2>
          <p>Beiträge und Reposts von Konten, denen du folgst, sowie deine eigenen, neueste zuerst. Es findet keine Personalisierung statt. Dieser chronologische Feed bleibt immer verfügbar.</p>
          <h2>Welche Daten genutzt werden</h2>
          <p>Nutzungsdaten zeichnen wir nur auf, wenn du die Feed-Personalisierung eingeschaltet hast:</p>
          <ul>{collectedFeedData.map((item) => <li key={item.de}>{item.de}</li>)}</ul>
          <p>Für jede Feed-Seite speichern wir, welche Beiträge ausgewählt wurden, in welcher Reihenfolge und mit welchen Signalen, damit das Weiterblättern funktioniert und wir die Sortierung verbessern können. Das wird nach 180 Tagen gelöscht. Für nicht angemeldete Besucher speichern wir eine gemeinsame, anonyme Liste für 2 Tage.</p>
          <p>Diese Daten dienen allein dazu, deinen Feed zu verbessern. Sie werden nicht für Werbung verwendet, nicht verkauft und nicht an Dritte weitergegeben. Nicht genutzt werden: Daten anderer Websites oder Apps, Werbe-IDs, Standort, Kontakte, Inhalte von Direktnachrichten.</p>
          <h2>Deine Kontrolle</h2>
          <p>Unter Einstellungen, Feed kannst du die Sortierung selbst beeinflussen. Diese Einstellungen gelten nur für den Feed, nicht für „Folge ich", Profile oder die Suche.</p>
          <ul>
            <li>Entdecken: wie viele Beiträge von Konten kommen, denen du noch nicht folgst. Die Bewertung solcher Beiträge wird in fünf Stufen mit 0,3, 0,6, 1, 1,5 oder 2,2 multipliziert.</li>
            <li>Frische: wie stark neue Beiträge bevorzugt werden. Die Halbwertszeit der Bewertung beträgt in fünf Stufen 72, 48, 24, 12 oder 6 Stunden.</li>
            <li>Antworten: wie oft Antworten von Konten, denen du folgst, erscheinen. In der niedrigsten Stufe gar nicht, sonst mit 0,5, 1, 1,5 oder 2 multipliziert.</li>
            <li>Themen: „Mehr über #Thema" multipliziert passende Beiträge mit 1,5, „Weniger über #Thema" mit 0,3. Das gilt, bis du es entfernst.</li>
            <li>„Interessiert" im Menü eines Beitrags: Beiträge dieses Kontos zählen 60 Tage lang 1,3-fach, seine Themen 1,2-fach.</li>
            <li>„Nicht interessiert": Der Beitrag verschwindet aus deinem Feed, Beiträge des Kontos zählen 60 Tage lang 0,7-fach, seine Themen 0,8-fach.</li>
            <li>„@Konto 30 Tage stummschalten": Beiträge des Kontos erscheinen 30 Tage lang nicht im Feed. In „Folge ich" und auf dem Profil siehst du sie weiterhin.</li>
          </ul>
          <p>Diese Entscheidungen speichern wir auch, wenn die Personalisierung ausgeschaltet ist; sie wirken dann, sobald du den Feed einschaltest. „Feed-Aktivität löschen" setzt alles zurück. Die Personalisierung selbst kannst du dort jederzeit ausschalten; die aufgezeichneten Daten werden dann gelöscht. Über das Menü eines Beitrags siehst du mit „Warum sehe ich das?", welche Gründe am stärksten zählten und welche deiner Einstellungen gewirkt haben.</p>
        </>
      ) : (
        <>
          <p>This page explains how ysocial decides which posts to show, how much each criterion counts, and which data it uses.</p>
          <h2>Feed (beta)</h2>
          <p>The Feed on the home page orders posts by how likely they are to interest you. It works in three steps.</p>
          <h3>1. Selection</h3>
          <p>Candidates are posts from the last 72 hours (the last 7 days when there are few) and posts that are popular right now. If you turned on feed personalization, posts that accounts you follow reposted, replied to or liked are added. Left out are your own posts, posts you already liked, reposted, saved or replied to, posts you saw in the last 24 hours (unless someone you follow has reposted or replied to them since), posts from accounts you blocked or that blocked you, and hidden or suspended content.</p>
          <h3>2. Scoring</h3>
          <p>For each post we estimate how likely certain reactions are and add them up with these weights:</p>
          <ul>
            <li>Reply: 4</li>
            <li>Repost, quote or share: 3</li>
            <li>Save: 3</li>
            <li>Like: 2</li>
            <li>Opening the post or its media: 1</li>
            <li>Opening the profile: 1</li>
            <li>Reading for at least 3 seconds: 0.5</li>
            <li>Following the account if you do not follow it yet: 5</li>
            <li>Negative reactions such as blocking or reporting: minus 20</li>
          </ul>
          <p>The estimate uses the post's age and type (reply, quote, image, voice note, poll, link, length), whether you follow the account and it follows you, how often you interacted with the account in the last 21 days, whether accounts you follow liked, reposted or replied to the post, how popular the post is overall and right now, how often others open and read it, topics you often engage with, and whether you already saw it in the last week. The weights are currently set by hand. Later we will learn them from usage data, and we will update this page when we do.</p>
          <h3>3. Freshness and variety</h3>
          <p>The score halves with every 24 hours of age, but never drops below 30 percent. Posts you saw 1 to 7 days ago count only 30 percent. The same account never appears twice in a row and at most twice in ten posts. From the fourth place on, about one place in ten is a random pick from further down the list, so the Feed does not only show more of the same.</p>
          <h3>Without personalization</h3>
          <p>The Feed needs feed personalization. If you turned it off, the Feed is greyed out and you land on Following; tapping the Feed lets you turn it on. Visitors who are not signed in, or have not decided yet, see the same ordering using only public signals (popularity, freshness, variety); no data about you is used or stored for it.</p>
          <h2>Following</h2>
          <p>Posts and reposts from accounts you follow, plus your own, newest first. There is no personalization. This chronological feed always stays available.</p>
          <h2>What data is used</h2>
          <p>We only record usage data if you turned feed personalization on:</p>
          <ul>{collectedFeedData.map((item) => <li key={item.en}>{item.en}</li>)}</ul>
          <p>For each Feed page we store which posts were picked, their order and their ranking signals, so paging works and we can improve the ranking. This is deleted after 180 days. For visitors who are not signed in we store one shared, anonymous list for 2 days.</p>
          <p>This data only serves to improve your feed. It is not used for advertising, not sold and not passed to third parties. Not used: data from other websites or apps, advertising IDs, location, contacts, content of direct messages.</p>
          <h2>Your control</h2>
          <p>In Settings, Feed you can shape the ordering yourself. These settings apply to the Feed only, not to Following, profiles or search.</p>
          <ul>
            <li>Discovery: how many posts come from accounts you do not follow yet. Their score is multiplied by 0.3, 0.6, 1, 1.5 or 2.2 across five steps.</li>
            <li>Freshness: how strongly newer posts are preferred. The score's half-life is 72, 48, 24, 12 or 6 hours across five steps.</li>
            <li>Replies: how often replies from accounts you follow show up. Not at all on the lowest step, otherwise multiplied by 0.5, 1, 1.5 or 2.</li>
            <li>Topics: "More about #topic" multiplies matching posts by 1.5, "Fewer about #topic" by 0.3. This lasts until you remove it.</li>
            <li>"Interested" in a post's menu: posts from that account count 1.3 times for 60 days, its topics 1.2 times.</li>
            <li>"Not interested": the post leaves your Feed, posts from that account count 0.7 times for 60 days, its topics 0.8 times.</li>
            <li>"Snooze @account for 30 days": that account's posts stay out of the Feed for 30 days. You still see them in Following and on their profile.</li>
          </ul>
          <p>We store these choices even when personalization is off; they take effect once you turn the Feed on. "Clear feed activity" resets all of them. You can also turn personalization off there at any time; the recorded data is then deleted. In a post's menu, "Why am I seeing this?" shows which reasons counted most and which of your settings applied.</p>
        </>
      )}
    </LegalLayout>
  );
}
