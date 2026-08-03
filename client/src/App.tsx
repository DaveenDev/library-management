import { useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar.tsx";
import { Topbar } from "./components/Topbar.tsx";
import { ToastProvider } from "./components/ui.tsx";
import { AuthProvider, useAuth } from "./auth.tsx";
import { themeVars, DEFAULT_ACCENT, type ThemeKey } from "./theme.ts";
import { TITLES, SUBS, type Section } from "./nav.ts";
import { api } from "./api.ts";

import { Login } from "./pages/Login.tsx";
import { Home } from "./pages/Home.tsx";
import { Dashboard } from "./pages/Dashboard.tsx";
import { Catalog } from "./pages/Catalog.tsx";
import { Borrowers } from "./pages/Borrowers.tsx";
import { Circulation } from "./pages/Circulation.tsx";
import { Reservations } from "./pages/Reservations.tsx";
import { Fines } from "./pages/Fines.tsx";
import { Reports } from "./pages/Reports.tsx";
import { Labels } from "./pages/Labels.tsx";
import { Settings } from "./pages/Settings.tsx";
import { UserManagement } from "./pages/UserManagement.tsx";

export interface PageProps {
  navigate: (s: Section) => void;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Authenticated />
      </AuthProvider>
    </ToastProvider>
  );
}

/**
 * Nothing below the login form should mount before the session is known —
 * every page fetches on mount, and doing that without a session would just
 * produce a screenful of 401s.
 */
function Authenticated() {
  const { user, checking } = useAuth();
  if (checking) return <Splash />;
  if (!user) return <Login />;
  // Keyed on the account so a different user never inherits the previous
  // one's loaded pages or form state.
  return <Workspace key={user.id} />;
}

function Splash() {
  return (
    <div
      style={{
        ...themeVars("parchment", DEFAULT_ACCENT),
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        fontSize: "14px",
        color: "#8a8069",
      }}
    >
      <span role="status">Loading…</span>
    </div>
  );
}

function Workspace() {
  const [section, setSection] = useState<Section>("home");
  const [theme, setTheme] = useState<ThemeKey>("parchment");
  const [accent, setAccent] = useState<string>(DEFAULT_ACCENT);
  const [loaded, setLoaded] = useState(false);
  const [catalogQuery, setCatalogQuery] = useState<{ text: string; nonce: number } | undefined>(undefined);
  const [navOpen, setNavOpen] = useState(false);

  // load persisted appearance
  useEffect(() => {
    api.settings()
      .then((s) => {
        if (s.theme) setTheme(s.theme as ThemeKey);
        if (s.accent) setAccent(s.accent);
      })
      .catch(() => { /* server may not be up yet */ })
      .finally(() => setLoaded(true));
  }, []);

  const persist = (patch: { theme?: ThemeKey; accent?: string }) => {
    if (!loaded) return;
    api.saveSettings(patch).catch(() => {});
  };
  const changeTheme = (t: ThemeKey) => { setTheme(t); persist({ theme: t }); };
  const changeAccent = (c: string) => { setAccent(c); persist({ accent: c }); };

  // Picking a destination closes the drawer; above the breakpoint there is
  // no drawer and this does nothing.
  const navigate = (s: Section) => { setSection(s); setNavOpen(false); };

  const runGlobalSearch = (query: string) => {
    setCatalogQuery({ text: query, nonce: Date.now() });
    setSection("catalog");
    setNavOpen(false);
  };

  const page = (() => {
    switch (section) {
      case "home": return <Home navigate={navigate} />;
      case "dashboard": return <Dashboard navigate={navigate} />;
      case "catalog": return <Catalog initialQuery={catalogQuery} />;
      case "borrowers": return <Borrowers />;
      case "circulation": return <Circulation />;
      case "reservations": return <Reservations />;
      case "fines": return <Fines />;
      case "reports": return <Reports />;
      case "labels": return <Labels />;
      case "settings": return <Settings />;
      case "userManagement": return <UserManagement />;
    }
  })();

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: "'IBM Plex Sans', system-ui, sans-serif", ...themeVars(theme, accent) }}>
      <Sidebar section={section} accent={accent} onNavigate={navigate} open={navOpen} onClose={() => setNavOpen(false)} />
      <main style={{ flex: 1, minWidth: 0, height: "100vh", overflowY: "auto", display: "flex", flexDirection: "column" }}>
        <Topbar title={TITLES[section]} subtitle={SUBS[section]} accent={accent} theme={theme} onTheme={changeTheme} onAccent={changeAccent} onSearch={runGlobalSearch} onOpenNav={() => setNavOpen(true)} />
        <div className="lm-page" style={{ flex: 1 }}>{page}</div>
      </main>
    </div>
  );
}
