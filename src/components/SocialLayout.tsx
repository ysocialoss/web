import AccountControls from '~/components/AccountControls';
import { createEffect, createSignal, For, on, type ParentProps } from "solid-js";
import { A, useLocation } from "@solidjs/router";
import LegalNav from "~/components/LegalNav";
import { SocialContext } from "~/lib/social-context";
import { Bell, Search, Settings2, Component, MessagesSquare, SquareChartGantt, Plus } from "~/components/Icons";

const nav = [
  { label: "Feed", href: "/", icon: SquareChartGantt },
  { label: "DMs", href: "/dms", icon: MessagesSquare },
  { label: "Search", href: "/search", icon: Search },
  { label: "Tweak feed", href: "/tweak-feed", icon: Settings2 },
  { label: "Communities", href: "/communities", icon: Component },
];

export default function SocialLayout(props: ParentProps) {
  const location = useLocation();
  const [topFade, setTopFade] = createSignal(0);
  const [composerVisible, setComposerVisible] = createSignal(true);
  const showNewPost = () => location.pathname === "/" && !composerVisible();
  let feedElement: HTMLElement | undefined;

  function observeComposer(element: HTMLElement) {
    setComposerVisible(true);
    const observer = new IntersectionObserver(([entry]) => {
      if (entry) setComposerVisible(entry.isIntersecting);
    }, { root: feedElement, threshold: 0 });
    observer.observe(element);
    return () => {
      observer.disconnect();
      setComposerVisible(true);
    };
  }

  createEffect(on(() => location.pathname, () => {
    feedElement?.scrollTo({ top: 0, behavior: "instant" });
    setTopFade(0);
  }, { defer: true }));

  return <SocialContext.Provider value={{ observeComposer }}>
    <div class="page-shell" classList={{ "page-shell-dms": location.pathname === "/dms" }}>
    <aside class="left-sidebar">
      <A href="/" aria-label="ysocial home" class="logo"><img src="/logo.png" alt="ysocial" /></A>
      <nav class="mt-[29px] flex flex-col items-start gap-[25px]" aria-label="Main navigation"><For each={nav}>{item => <A href={item.href} end activeClass="selected" inactiveClass="" class="nav-link"><item.icon size={22} strokeWidth={2} /><span>{item.label}</span></A>}</For></nav>
      <button classList={{ "new-post-visible": showNewPost() }} aria-hidden={!showNewPost()} tabIndex={showNewPost() ? 0 : -1} class="new-post pill-button gap-[16px]"><Plus size={24} />New Post</button>
    </aside>
    <main ref={element => { feedElement = element; }} class="feed min-w-0" style={{ "--feed-top-fade": `${topFade()}px` }} onScroll={event => setTopFade(Math.min(20, Math.max(0, event.currentTarget.scrollTop)))}>
      {props.children}
    </main>
    <aside class="right-sidebar">
      <div class="top-actions flex justify-end gap-[15px]"><button aria-label="Notifications"><Bell size={24} /></button><AccountControls /></div>
    </aside>
    <LegalNav />
  </div>
  </SocialContext.Provider>;
}
