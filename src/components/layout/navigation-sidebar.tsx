import { Button } from "@/components/ui/button";
import { navigation, type Page } from "./navigation";

export function NavigationSidebar({
  activePage,
  onNavigate: setActivePage,
}: {
  activePage: Page;
  onNavigate: (page: Page) => void;
}) {
  return (
    <aside aria-label="Sidebar" className="min-w-0 p-2 lg:p-3">
      <div className="flex flex-col items-start gap-4">
        <Button
          variant="ghost"
          className="h-auto w-fit max-w-full justify-start p-1 lg:px-3"
          aria-label="Ysocial home"
          onClick={() => setActivePage("Feed")}
        >
          <img
            src="/favicon.png"
            alt="Ysocial"
            width={48}
            height={48}
            className="lg:hidden"
          />
          <img
            src="/logo.png"
            alt="Ysocial"
            width={1708}
            height={644}
            className="hidden h-auto w-32 object-contain object-left lg:block"
          />
        </Button>
        <nav
          aria-label="Main navigation"
          className="flex w-full flex-col gap-1"
        >
          {navigation.map(({ label, icon: Icon }) => (
            <Button
              key={label}
              variant="ghost"
              className={`h-10 w-full justify-start gap-3 px-3 ${activePage === label ? "font-bold" : "font-medium"}`}
              aria-label={label}
              aria-current={activePage === label ? "page" : undefined}
              onClick={() => setActivePage(label)}
            >
              <Icon
                className="size-5"
                strokeWidth={activePage === label ? 2.75 : 2}
              />
              <span className="hidden lg:inline">{label}</span>
            </Button>
          ))}
        </nav>
      </div>
    </aside>
  );
}
