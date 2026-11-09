import { useState } from "react";
import { NavigationSidebar } from "@/components/layout/navigation-sidebar";
import { AccountSidebar } from "@/components/layout/account-sidebar";
import type { Page } from "@/components/layout/navigation";
import { Feed } from "@/features/feed/feed";
import { useFeed } from "@/features/feed/use-feed";

export function App() {
  const [activePage, setActivePage] = useState<Page>("Feed");
  const feed = useFeed();

  return (
    <main className="grid min-h-svh grid-cols-[4rem_minmax(0,1fr)_4rem] divide-x divide-border lg:grid-cols-[13rem_minmax(0,1fr)_22rem]">
      <NavigationSidebar activePage={activePage} onNavigate={setActivePage} />
      <section
        aria-label="Main content"
        className="min-w-0 px-5 py-4 sm:px-10 sm:py-6 lg:px-12"
      >
        {activePage === "Feed" && <Feed feed={feed} />}
      </section>
      <AccountSidebar onNavigate={setActivePage} />
    </main>
  );
}

export default App;
