import { Check, ChevronDown } from "lucide-react";
import { useThemeSelection } from "@/components/theme-provider";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

const themes = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

export function ThemeSelector() {
  const { theme, selectTheme, confirmation } = useThemeSelection();
  const mobile = useIsMobile();
  if (mobile) {
    return (
      <div className="flex items-center gap-2">
        <span>Theme</span>
        <Drawer showSwipeHandle>
          <DrawerTrigger
            render={<Button variant="outline" />}
            aria-label="Choose theme"
          >
            {themes.find((option) => option.value === theme)?.label}
            <ChevronDown aria-hidden="true" />
          </DrawerTrigger>
          <DrawerContent aria-describedby={undefined}>
            <DrawerHeader>
              <DrawerTitle>Theme</DrawerTitle>
            </DrawerHeader>
            <div className="overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {themes.map(({ value, label }) => {
                const button = (
                  <Button
                    key={value}
                    variant="ghost"
                    className="min-h-12 w-full justify-between text-base"
                    onClick={() => selectTheme(value)}
                    aria-pressed={theme === value}
                  >
                    {label}
                    {theme === value && <Check aria-hidden="true" />}
                  </Button>
                );
                return value === "light" && theme !== "light" ? (
                  button
                ) : (
                  <DrawerClose key={value} render={button} />
                );
              })}
            </div>
            {confirmation}
          </DrawerContent>
        </Drawer>
      </div>
    );
  }
  return (
    <label className="flex items-center gap-2">
      Theme
      <NativeSelect
        value={theme}
        onChange={(event) => {
          const value = event.target.value;
          if (value === "light" || value === "dark" || value === "system")
            selectTheme(value);
        }}
      >
        {themes.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </NativeSelect>
      {confirmation}
    </label>
  );
}
