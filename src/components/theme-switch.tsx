"use client";

import { useEffect, useState } from "react";
import { type Theme, THEME_COOKIE } from "@/lib/theme";
import { Icon, type IconName } from "./icon";
import styles from "./switch.module.css";

// Same as NoorAI Lab Studio's ThemeSwitch (apps/web/src/components/shell/ThemeSwitch.tsx),
// with the English labels written in (the tracker has no translations yet).
const OPTIONS: { value: Theme; icon: IconName; label: string }[] = [
  { value: "light", icon: "sun", label: "Light" },
  { value: "dark", icon: "moon", label: "Dark" },
  { value: "system", icon: "computer", label: "System" },
];

const ONE_YEAR = 60 * 60 * 24 * 365;
const darkQuery = "(prefers-color-scheme: dark)";

function apply(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia(darkQuery).matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}

function remember(theme: Theme) {
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
}

/** Light, dark or the same as this computer. Changes at once; remembered in a cookie. */
export function ThemeSwitch({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);

  // Follow the computer's setting while "system" is chosen.
  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia(darkQuery);
    const follow = () => apply("system");
    media.addEventListener("change", follow);
    return () => media.removeEventListener("change", follow);
  }, [theme]);

  function choose(next: Theme) {
    setTheme(next);
    apply(next);
    remember(next);
  }

  return (
    <div className={styles.group} role="group" aria-label="Theme">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={styles.option}
          aria-pressed={theme === option.value}
          onClick={() => choose(option.value)}
        >
          <Icon name={option.icon} size={18} />
          {option.label}
        </button>
      ))}
    </div>
  );
}
