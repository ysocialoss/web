import { useAuth } from "~/lib/auth";
import AccountControls from "~/components/AccountControls";
import {
  createEffect,
  createSignal,
  For,
  on,
  type ParentProps,
  onMount,
} from "solid-js";
import { A, useLocation } from "@solidjs/router";
import LegalNav from "~/components/LegalNav";
import { SocialContext } from "~/lib/social-context";
import {
  Bell,
  Search,
  Settings2,
  Component,
  MessagesSquare,
  SquareChartGantt,
  Plus,
} from "~/components/Icons";

const nav = [
  { label: "Feed", href: "/", icon: SquareChartGantt },
  { label: "DMs", href: "/dms", icon: MessagesSquare },
  { label: "Search", href: "/search", icon: Search },
  { label: "Tweak feed", href: "/tweak-feed", icon: Settings2 },
  { label: "Communities", href: "/communities", icon: Component },
];

export default function SocialLayout(props: ParentProps) {
  const location = useLocation();
  const auth = useAuth();
  onMount(() => void auth.reload());
  const [topFade, setTopFade] = createSignal(0);
  const [composerVisible, setComposerVisible] = createSignal(true);
  const showNewPost = () => location.pathname === "/" && !composerVisible();
  let feedElement: HTMLElement | undefined;

  function observeComposer(element: HTMLElement) {
    setComposerVisible(true);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) setComposerVisible(entry.isIntersecting);
      },
      { root: feedElement, threshold: 0 },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      setComposerVisible(true);
    };
  }

  createEffect(
    on(
      () => location.pathname,
      () => {
        feedElement?.scrollTo({ top: 0, behavior: "instant" });
        setTopFade(0);
      },
      { defer: true },
    ),
  );

  return (
    <SocialContext.Provider value={{ observeComposer, auth: auth.state, reloadAuth: auth.reload, scrollRoot: () => feedElement }}>
      <div
        class="
          group/page mx-auto grid h-dvh min-h-0 w-[1570px] max-w-[calc(100%-80px)] grid-cols-[275px_600px_455px]
          grid-rows-[minmax(0,1fr)_auto] gap-x-[120px] pt-[30px]
          max-[1701px]:grid-cols-[230px_minmax(450px,600px)_minmax(320px,455px)]
          max-[1701px]:gap-x-[clamp(35px,5vw,90px)] max-[1251px]:max-w-[calc(100%-48px)]
          max-[1251px]:grid-cols-[170px_minmax(0,600px)] max-[1251px]:justify-start max-[1251px]:gap-[30px]
          min-[701px]:max-[951px]:grid-cols-[140px_minmax(0,600px)] min-[701px]:max-[951px]:gap-6
          max-[701px]:flex max-[701px]:w-full max-[701px]:max-w-[600px] max-[701px]:flex-col max-[701px]:px-5
          max-[701px]:pt-[15px] data-[dms=true]:grid-cols-[275px_minmax(0,1fr)]
          max-[1701px]:data-[dms=true]:grid-cols-[230px_minmax(0,1fr)]
          max-[1251px]:data-[dms=true]:grid-cols-[170px_minmax(0,1fr)]
          min-[701px]:max-[951px]:data-[dms=true]:grid-cols-[140px_minmax(0,1fr)]
        "
        data-dms={location.pathname === "/dms"}
      >
        <aside data-sidebar="left" class="relative max-[701px]:mb-[22px] max-[701px]:flex max-[701px]:shrink-0 max-[701px]:items-center max-[701px]:justify-between">
          <A href="/" aria-label="ysocial home" class="
            flex h-[58px] w-[156px] items-center transition-[transform,color,background-color,box-shadow,filter]
            duration-[180ms] hover:scale-[1.03] motion-reduce:transition-none motion-reduce:hover:scale-100
            [&_img]:block [&_img]:h-auto [&_img]:w-full max-[701px]:h-12 max-[701px]:w-[125px]
          ">
            <img src="/logo.png" alt="ysocial" />
          </A>
          <nav
            class="mt-[29px] flex flex-col items-start gap-[25px] max-[701px]:mt-0 max-[701px]:flex-row max-[701px]:gap-[17px]"
            aria-label="Main navigation"
          >
            <For each={nav}>
              {(item) => (
                <A
                  href={item.href}
                  end
                  activeClass=""
                  inactiveClass=""
                  class="
                    relative isolate -mx-[14px] -my-[10px] flex min-h-11 min-w-11 touch-manipulation
                    items-center gap-2.5 px-[14px] py-2.5 leading-[23px]
                    transition-[transform,color,background-color,box-shadow,filter] duration-[180ms]
                    hover:scale-[1.04] hover:brightness-[1.16] active:scale-[0.92] active:duration-[70ms]
                    motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100
                    aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-[14px]
                    aria-[current=page]:after:bottom-1 aria-[current=page]:after:h-[3px]
                    aria-[current=page]:after:rounded aria-[current=page]:after:bg-[#00d363]
                    aria-[current=page]:after:content-[''] max-[701px]:[&_span]:hidden max-[701px]:nth-4:hidden
                    max-[701px]:nth-5:hidden
                  "
                >
                  <item.icon size={22} strokeWidth={2} />
                  <span>{item.label}</span>
                </A>
              )}
            </For>
            <div class="min-[1252px]:hidden">
              <AccountControls />
            </div>
          </nav>
          <button
            onClick={() => {
              feedElement?.scrollTo({ top: 0, behavior: "smooth" });
              feedElement?.querySelector<HTMLButtonElement>("[data-composer-trigger]")?.click();
            }}
            data-visible={showNewPost()}
            aria-hidden={!showNewPost()}
            tabIndex={showNewPost() ? 0 : -1}
            class="
              fixed bottom-[30px] invisible w-[275px] h-[58px] translate-y-3 opacity-0 pointer-events-none
              transition-[opacity,translate,visibility,transform,filter] duration-[220ms,280ms,0s,180ms,160ms]
              delay-[0s,0s,280ms,0s,0s] data-[visible=true]:visible data-[visible=true]:translate-y-0
              data-[visible=true]:opacity-100 data-[visible=true]:pointer-events-auto
              data-[visible=true]:delay-0 motion-reduce:translate-y-0 motion-reduce:transition-none
              [&_svg]:transition-[transform,color] [&_svg]:duration-[220ms] active:[&_svg]:rotate-90
              motion-reduce:[&_svg]:transition-none max-[1701px]:w-[230px] max-[1251px]:w-[170px]
              min-[701px]:max-[951px]:w-[140px] max-[701px]:right-5 max-[701px]:bottom-[78px] max-[701px]:z-20
              max-[701px]:h-12 max-[701px]:w-[145px] max-[701px]:shadow-[0_3px_20px_#0008]
              group-data-[dms=true]/page:hidden inline-flex touch-manipulation items-center justify-center
              rounded-full bg-[#0c2b1a] font-semibold hover:scale-[1.01] active:scale-[0.97]
              motion-reduce:hover:scale-100 motion-reduce:active:scale-100 gap-[16px]
            "
          >
            <Plus size={24} />
            New Post
          </button>
        </aside>
        <main
          ref={(element) => {
            feedElement = element;
          }}
          class="
            min-h-0 -mx-4 overflow-y-auto overscroll-y-contain px-4 pb-[30px] [scrollbar-width:none]
            [&::-webkit-scrollbar]:hidden [--feed-fade:20px]
            [mask-image:linear-gradient(to_bottom,transparent,#000_var(--feed-top-fade,0px),#000_calc(100%_-_var(--feed-fade)),transparent)]
            max-[701px]:flex-1 max-[701px]:pb-[90px] group-data-[dms=true]/page:overflow-hidden
            group-data-[dms=true]/page:pb-[30px] group-data-[dms=true]/page:[mask-image:none]
            max-[701px]:group-data-[dms=true]/page:pb-5 min-w-0
          "
          style={{ "--feed-top-fade": `${topFade()}px` }}
          onScroll={(event) =>
            setTopFade(Math.min(20, Math.max(0, event.currentTarget.scrollTop)))
          }
        >
          {props.children}
        </main>
        <aside data-sidebar="right" class="relative max-[1251px]:hidden group-data-[dms=true]/page:hidden">
          <div class="
            [&>button]:relative [&>button]:isolate [&>button]:-my-[1.5px] [&>button]:flex [&>button]:size-11
            [&>button]:items-center [&>button]:justify-center [&>button]:rounded-[5px] [&>button]:bg-[#202020]
            flex justify-end gap-[15px]
          ">
            <button aria-label="Notifications">
              <Bell size={24} />
            </button>
            <AccountControls />
          </div>
        </aside>
        <LegalNav />
      </div>
    </SocialContext.Provider>
  );
}
