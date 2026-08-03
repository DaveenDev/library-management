import { useId, useState, type FormEvent } from "react";
import { useAuth } from "../auth.tsx";
import { LIBRARY } from "../branding.ts";
import { DEFAULT_ACCENT, inputStyle, labelStyle, primaryBtnWide, themeVars } from "../theme.ts";
import { errorMessage } from "../lib/errors.ts";

export function Login() {
  const { signIn } = useAuth();
  const emailId = useId();
  const passwordId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(errorMessage(err, "Could not sign in"));
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        ...themeVars("parchment", DEFAULT_ACCENT),
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: "100%",
          maxWidth: "400px",
          background: "var(--bg-card, #fbf7ee)",
          border: "1px solid var(--border-card, #e4dcc6)",
          borderRadius: "16px",
          padding: "32px 30px",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
          boxShadow: "0 18px 48px rgba(30,26,20,.12)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            aria-hidden="true"
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "11px",
              background: "var(--accent, #3d6b53)",
              color: "var(--bg-page, #f4eede)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "Spectral, serif",
              fontWeight: 700,
              fontSize: "21px",
              flex: "none",
            }}
          >
            {LIBRARY.name.charAt(0)}
          </div>
          <div>
            <h1 style={{ margin: 0, fontFamily: "Spectral,serif", fontSize: "22px", fontWeight: 600, color: "#2a2620" }}>
              {LIBRARY.name}
            </h1>
            <p style={{ margin: "2px 0 0", fontSize: "12.5px", color: "#8a8069" }}>Staff sign-in</p>
          </div>
        </div>

        {error && (
          // Assertive rather than polite: the user has just pressed a button
          // and is waiting on this specific answer.
          <div
            role="alert"
            style={{
              background: "#f3e0d8",
              color: "#a4472f",
              borderRadius: "9px",
              padding: "11px 14px",
              fontSize: "13.5px",
            }}
          >
            {error}
          </div>
        )}

        <div>
          <label htmlFor={emailId} style={labelStyle}>
            Email
          </label>
          <input
            id={emailId}
            type="email"
            name="email"
            autoComplete="username"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={`name@${LIBRARY.emailDomain}`}
            style={inputStyle}
          />
        </div>

        <div>
          <label htmlFor={passwordId} style={labelStyle}>
            Password
          </label>
          <input
            id={passwordId}
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
        </div>

        <button type="submit" disabled={submitting} style={{ ...primaryBtnWide, opacity: submitting ? 0.6 : 1 }}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>

        <p style={{ margin: 0, fontSize: "12px", color: "#a89d82", textAlign: "center" }}>
          Lost your password? An administrator can set a new one from User Management.
        </p>
      </form>
    </div>
  );
}
