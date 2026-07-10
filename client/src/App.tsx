import { useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar.tsx";
import { Topbar } from "./components/Topbar.tsx";
import { ToastProvider } from "./components/ui.tsx";
import { themeVars, DEFAULT_ACCENT, type ThemeKey } from "./theme.ts";
import { TITLES, SUBS, type Section } from "./nav.ts";
import { api } from "./api.ts";

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
  const [section, setSection] = useState<Section>("home");
  const [theme, setTheme] = useState<ThemeKey>("parchment");
  const [accent, setAccent] = useState<string>(DEFAULT_ACCENT);
  const [loaded, setLoaded] = useState(false);

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

  const navigate = (s: Section) => setSection(s);

  const page = (() => {
    switch (section) {
      case "home": return <Home navigate={navigate} />;
      case "dashboard": return <Dashboard navigate={navigate} />;
      case "catalog": return <Catalog />;
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
    <ToastProvider>
      <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: "'IBM Plex Sans', system-ui, sans-serif", ...themeVars(theme, accent) }}>
        <Sidebar section={section} accent={accent} onNavigate={navigate} />
        <main style={{ flex: 1, height: "100vh", overflowY: "auto", display: "flex", flexDirection: "column" }}>
          <Topbar title={TITLES[section]} subtitle={SUBS[section]} accent={accent} theme={theme} onTheme={changeTheme} onAccent={changeAccent} />
          <div style={{ padding: "26px 34px 52px", flex: 1 }}>{page}</div>
        </main>
      </div>
    </ToastProvider>
  );
}
