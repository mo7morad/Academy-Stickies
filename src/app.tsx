import type { JSX } from "preact";
import { useCallback, useEffect, useState } from "preact/hooks";
import type { Me } from "../shared/types";
import { getMe, logout as apiLogout } from "./api";
import { HeaderActions } from "./components/HeaderActions";
import { Icon } from "./components/Icon";
import { Nav } from "./components/Nav";
import { Sheet } from "./components/Sheet";
import { Spinner } from "./components/controls";
import { navigate, useHashRoute } from "./router";
import { GiveSticky } from "./views/GiveSticky";
import { Login } from "./views/Login";
import { Mentors } from "./views/Mentors";
import { Roster } from "./views/Roster";
import { Wall } from "./views/Wall";

type Theme = "light" | "dark";

function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      localStorage.setItem("theme", next);
      return next;
    });
  }, []);

  return { theme, toggle };
}

/** Plain anchors so the tabs are real, keyboard-navigable links. */
function DirectoryTabs({ active }: { active: "roster" | "mentors" }) {
  return (
    <nav class="tabs" aria-label="Directory">
      <div class="tabs__inner">
        <a
          class="tabs__tab"
          href="#/"
          aria-current={active === "roster" ? "page" : undefined}
        >
          Learners
        </a>
        <a
          class="tabs__tab"
          href="#/mentors"
          aria-current={active === "mentors" ? "page" : undefined}
        >
          Mentors
        </a>
      </div>
    </nav>
  );
}

export function App() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);
  const route = useHashRoute();
  const { theme, toggle } = useTheme();
  const [give, setGive] = useState<{ open: boolean; recipient?: string }>({
    open: false,
  });
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    getMe()
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  const openGive = useCallback((recipient?: string) => {
    setGive({ open: true, recipient });
  }, []);

  const onCreated = useCallback(() => {
    setGive({ open: false });
    setRefresh((r) => r + 1);
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setMe(null);
    navigate("/");
  }, []);

  if (me === undefined) {
    return (
      <div class="center-screen">
        <div class="login-logo">🗒️</div>
        <Spinner />
      </div>
    );
  }

  if (me === null) return <Login />;

  let content: JSX.Element;
  if (route.name === "roster" || route.name === "mentors") {
    const onMentors = route.name === "mentors";
    content = (
      <>
        <Nav
          title="Academy"
          subtitle={onMentors ? "Our mentors" : "Sticky notes between us"}
          right={
            <HeaderActions theme={theme} onToggleTheme={toggle} onLogout={logout} />
          }
        />
        <DirectoryTabs active={route.name} />
        {onMentors ? (
          <Mentors />
        ) : (
          <Roster refreshSignal={refresh} onGive={openGive} />
        )}
      </>
    );
  } else {
    const memberId = route.name === "me" ? me.id : (route.id ?? me.id);
    content = (
      <Wall
        me={me}
        memberId={memberId}
        refreshSignal={refresh}
        onGive={openGive}
        onMeChange={setMe}
        onLogout={logout}
        theme={theme}
        onToggleTheme={toggle}
      />
    );
  }

  return (
    <>
      {content}

      <footer class="app-footer">
        Made by <a href="#/m/mo7morad">Morad</a>, <a href="#/m/javhoir">John</a>, and <a href="#/m/keneth">Ken</a>
      </footer>

      <button class="fab" onClick={() => openGive()} aria-label="New sticky">
        <Icon name="plus" size={20} />
        New Sticky
      </button>

      {give.open && (
        <Sheet title="New Sticky" onClose={() => setGive({ open: false })}>
          <GiveSticky
            me={me}
            prefillRecipientId={give.recipient}
            onCreated={onCreated}
          />
        </Sheet>
      )}
    </>
  );
}
