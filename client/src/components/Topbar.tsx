import { useState, type CSSProperties } from "react";
import { Icon } from "../icons.tsx";
import { THEMES, ACCENTS, type ThemeKey } from "../theme.ts";

export function Topbar({
  title, subtitle, accent, theme, onTheme, onAccent,
}: {
  title: string; subtitle: string; accent: string; theme: ThemeKey;
  onTheme: (t: ThemeKey) => void; onAccent: (c: string) => void;
}) {
  const [showPanel, setShowPanel] = useState(false);
  const avatarStyle: CSSProperties = { width: "36px", height: "36px", borderRadius: "50%", background: accent, color: "var(--bg-page, #f4eede)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: "14px", fontFamily: "Spectral, serif", flex: "none" };
  const squareBtn: CSSProperties = { width: "36px", height: "36px", borderRadius: "9px", border: "1px solid var(--border-input, #ddd2b8)", background: "var(--bg-card, #fbf7ee)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };

  return (
    <header style={{ position: "sticky", top: 0, zIndex: 5, background: "rgba(244,238,222,.88)", backdropFilter: "blur(9px)", borderBottom: "1px solid #e2dac3", padding: "10px 34px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "24px" }}>
      <div style={{ minWidth: 0, display: "flex", alignItems: "baseline", gap: "12px" }}>
        <h1 style={{ margin: 0, fontFamily: "Spectral,serif", fontWeight: 600, fontSize: "21px", color: "#2a2620", letterSpacing: "-.01em", whiteSpace: "nowrap" }}>{title}</h1>
        <p style={{ margin: 0, fontSize: "12.5px", color: "#8a8069", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{subtitle}</p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "13px", flex: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "9px", background: "var(--bg-card, #fbf7ee)", border: "1px solid var(--border-input, #ddd2b8)", borderRadius: "9px", padding: "7px 14px", width: "270px" }}>
          <Icon name="search" color="#a89d82" size={16} />
          <span style={{ fontSize: "13.5px", color: "#a89d82" }}>Search the whole system…</span>
        </div>
        <button style={{ ...squareBtn, position: "relative" }}>
          <Icon name="bell" color="#6f6653" size={17} />
          <span style={{ position: "absolute", top: "9px", right: "10px", width: "7px", height: "7px", borderRadius: "50%", background: "#a4472f", border: "1.5px solid var(--bg-card, #fbf7ee)" }} />
        </button>
        <div style={{ position: "relative" }}>
          <button title="Appearance" onClick={() => setShowPanel((v) => !v)} style={squareBtn}>
            <span style={{ width: "18px", height: "18px", borderRadius: "50%", background: accent, border: "2px solid var(--bg-input, #fffdf7)", boxShadow: "0 0 0 1px var(--border-input, #ddd2b8)" }} />
          </button>
          {showPanel && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setShowPanel(false)} />
              <div style={{ position: "absolute", top: "50px", right: 0, zIndex: 41, background: "var(--bg-card, #fbf7ee)", border: "1px solid var(--border-card, #e4dcc6)", borderRadius: "13px", boxShadow: "0 16px 40px rgba(30,26,20,.22)", padding: "16px 18px", width: "230px" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "#a89d82", marginBottom: "9px" }}>Theme</div>
                <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
                  {(Object.keys(THEMES) as ThemeKey[]).map((key) => (
                    <button key={key} title={key} onClick={() => onTheme(key)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "5px", background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
                      <span style={{ width: "30px", height: "30px", borderRadius: "50%", background: THEMES[key].swatch, border: "2px solid var(--border-input, #ddd2b8)", boxShadow: theme === key ? `0 0 0 2px var(--bg-card,#fbf7ee), 0 0 0 4px ${accent}` : "none" }} />
                      <span style={{ fontSize: "10.5px", color: "#6f6653", textTransform: "capitalize" }}>{key}</span>
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: "11px", fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", color: "#a89d82", marginBottom: "9px" }}>Accent</div>
                <div style={{ display: "flex", gap: "10px" }}>
                  {ACCENTS.map((ac) => (
                    <button key={ac.key} onClick={() => onAccent(ac.color)} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
                      <span style={{ width: "26px", height: "26px", borderRadius: "50%", background: ac.color, display: "block", boxShadow: accent === ac.color ? `0 0 0 2px var(--bg-card,#fbf7ee), 0 0 0 4px ${ac.color}` : "none" }} />
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
        <div style={avatarStyle}>BH</div>
      </div>
    </header>
  );
}
