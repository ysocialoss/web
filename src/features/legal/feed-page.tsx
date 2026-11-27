import { LegalLayout } from "./legal-layout";
import { collectedFeedData } from "./account-gates";

export function FeedExplainerPage() {
  return (
    <LegalLayout title={{ de: "So funktioniert der Feed", en: "How the feed works" }} version="2026-11-27">
      {(language) => language === "de" ? (
        <>
          <p>Hier erklären wir, nach welchen Kriterien ysocial Beiträge anzeigt und welche Daten dafür genutzt werden.</p>
          <h2>Neueste</h2>
          <p>Alle öffentlichen Beiträge, neueste zuerst. Reposts erscheinen zum Zeitpunkt des Reposts. Beiträge von Konten, die du blockiert hast oder die dich blockiert haben, sowie verborgene oder gesperrte Inhalte werden ausgeblendet. Es findet keine Personalisierung statt.</p>
          <h2>Folge ich</h2>
          <p>Beiträge und Reposts von Konten, denen du folgst, sowie deine eigenen, neueste zuerst. Es findet keine Personalisierung statt.</p>
          <h2>Für dich (in Vorbereitung)</h2>
          <p>Wir arbeiten an einem personalisierten Feed. Er wird Beiträge danach ordnen, wie wahrscheinlich du mit ihnen interagierst, auf Basis deiner Nutzung von ysocial. Bevor er startet, ergänzen wir hier die wichtigsten Parameter und ihre Gewichtung. Die chronologischen Feeds bleiben immer verfügbar.</p>
          <h2>Welche Daten genutzt werden</h2>
          <p>Nutzungsdaten zeichnen wir nur auf, wenn du die Feed-Personalisierung eingeschaltet hast:</p>
          <ul>{collectedFeedData.map((item) => <li key={item.de}>{item.de}</li>)}</ul>
          <p>Diese Daten dienen allein dazu, deinen Feed zu verbessern. Sie werden nicht für Werbung verwendet, nicht verkauft und nicht an Dritte weitergegeben. Nicht genutzt werden: Daten anderer Websites oder Apps, Werbe-IDs, Standort, Kontakte, Inhalte von Direktnachrichten.</p>
          <h2>Deine Kontrolle</h2>
          <p>Du kannst die Personalisierung in den Einstellungen unter Datenschutz und Sicherheit jederzeit ausschalten; die gespeicherten Daten werden dann gelöscht. Über das Menü eines Beitrags siehst du mit „Warum sehe ich das?", warum er dir angezeigt wird.</p>
        </>
      ) : (
        <>
          <p>This page explains how ysocial decides which posts to show and which data it uses.</p>
          <h2>Latest</h2>
          <p>All public posts, newest first. Reposts appear at the time of the repost. Posts from accounts you blocked or that blocked you, and hidden or suspended content, are left out. There is no personalization.</p>
          <h2>Following</h2>
          <p>Posts and reposts from accounts you follow, plus your own, newest first. There is no personalization.</p>
          <h2>For you (coming later)</h2>
          <p>We are working on a personalized feed. It will rank posts by how likely you are to interact with them, based on how you use ysocial. Before it launches, we will list its main parameters and their weight here. The chronological feeds will always stay available.</p>
          <h2>What data is used</h2>
          <p>We only record usage data if you turned feed personalization on:</p>
          <ul>{collectedFeedData.map((item) => <li key={item.en}>{item.en}</li>)}</ul>
          <p>This data only serves to improve your feed. It is not used for advertising, not sold and not passed to third parties. Not used: data from other websites or apps, advertising IDs, location, contacts, content of direct messages.</p>
          <h2>Your control</h2>
          <p>You can turn personalization off at any time in Settings under Privacy and safety; the stored data is then deleted. In a post's menu, "Why am I seeing this?" tells you why it is shown to you.</p>
        </>
      )}
    </LegalLayout>
  );
}
