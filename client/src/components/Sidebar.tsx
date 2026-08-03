import type { CSSProperties } from "react";
import { Icon, type IconName } from "../icons.tsx";
import type { Section } from "../nav.ts";
import { NAV_ITEMS, SECTION_PERMISSION, SETTINGS_ITEMS } from "../nav.ts";
import { useAuth } from "../auth.tsx";

export function Sidebar({
  section, accent, onNavigate,
}: {
  section: Section; accent: string; onNavigate: (s: Section) => void;
}) {
  const { user, can, signOut } = useAuth();
  const brandStyle: CSSProperties = { width: "38px", height: "38px", borderRadius: "10px", background: accent, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--bg-page, #f4eede)", fontFamily: "Spectral, serif", fontWeight: 700, fontSize: "20px", flex: "none" };
  const avatarStyle: CSSProperties = { width: "36px", height: "36px", borderRadius: "50%", background: accent, color: "var(--bg-page, #f4eede)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: "14px", fontFamily: "Spectral, serif", flex: "none" };

  const navBtn = (active: boolean, indent = false): CSSProperties => ({
    display: "flex", alignItems: "center", gap: indent ? "11px" : "12px", width: "100%",
    padding: indent ? "6px 13px 6px 32px" : "7px 13px", border: "none", borderRadius: "9px", cursor: "pointer",
    fontFamily: "inherit", fontSize: indent ? "13.5px" : "14px", fontWeight: active ? 600 : 500, textAlign: "left",
    color: active ? "#2a2620" : "#6b6353",
    background: active ? "#f6f1e4" : "transparent",
    boxShadow: active ? `inset 3px 0 0 ${accent}` : "none",
    transition: "background .15s",
  });

  const sectionLabel: CSSProperties = { fontSize: "10.5px", fontWeight: 600, letterSpacing: ".11em", textTransform: "uppercase", color: "#a89d82", padding: "2px 12px 8px" };

  return (
    <aside style={{ width: "216px", flex: "none", height: "100vh", background: "var(--bg-sidebar, #eae1cb)", borderRight: "1px solid var(--border-sidebar, #dbd0b5)", display: "flex", flexDirection: "column", padding: "20px 11px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "4px 10px 22px" }}>
        <div style={brandStyle}>L</div>
        <div>
          <div style={{ fontFamily: "Spectral,serif", fontWeight: 600, fontSize: "19px", color: "#2a2620", lineHeight: 1 }}>Lumen</div>
          <div style={{ fontSize: "10.5px", color: "#8a8069", letterSpacing: ".11em", textTransform: "uppercase", marginTop: "3px" }}>Library System</div>
        </div>
      </div>

      <div style={sectionLabel}>Main Menu</div>
      <nav style={{ display: "flex", flexDirection: "column", gap: "3px", flex: 1, minHeight: 0, overflowY: "auto", margin: "0 -4px", padding: "0 4px" }}>
        {NAV_ITEMS.map(([key, label, icon]) => {
          const active = section === key;
          return (
            <button key={key} className="lm-hover" style={navBtn(active)} onClick={() => onNavigate(key)}>
              <Icon name={icon as IconName} color={active ? accent : "#8a8069"} size={18} />
              <span>{label}</span>
            </button>
          );
        })}
        <div style={{ ...sectionLabel, padding: "14px 12px 2px" }}>Settings</div>
        {SETTINGS_ITEMS.filter(([key]) => {
          const needed = SECTION_PERMISSION[key];
          return !needed || can(needed);
        }).map(([key, label, icon]) => {
          const active = section === key;
          return (
            <button key={key} className="lm-hover" style={navBtn(active, true)} onClick={() => onNavigate(key)}>
              <Icon name={icon as IconName} color={active ? accent : "#8a8069"} size={15} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      <div style={{ marginTop: "14px", flex: "none", display: "flex", alignItems: "center", gap: "11px", padding: "12px", background: "var(--bg-soft, #f3edda)", border: "1px solid var(--border-input, #ddd2b8)", borderRadius: "11px" }}>
        <div style={avatarStyle} aria-hidden="true">{user?.initials}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: "13.5px", fontWeight: 600, color: "#2a2620", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.name}</div>
          <div style={{ fontSize: "11.5px", color: "#8a8069" }}>{user?.role}</div>
        </div>
        <button
          onClick={signOut}
          title="Sign out"
          style={{ width: "30px", height: "30px", flex: "none", borderRadius: "8px", border: "1px solid var(--border-input, #ddd2b8)", background: "var(--bg-input, #fffdf7)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
        >
          <Icon name="signOut" color="#6f6653" size={15} />
        </button>
      </div>
    </aside>
  );
}
