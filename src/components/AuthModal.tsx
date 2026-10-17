import React, { useState } from "react";
import { useAuth, PublicUser } from "../lib/authContext";
import { showToast } from "../lib/toast";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { login } = useAuth();
  const [tab, setTab] = useState<"signin" | "register">("signin");

  // Form states
  const [loginId, setLoginId] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (tab === "signin") {
        if (!loginId.trim() || !password) {
          throw new Error("Please enter your username/email and password.");
        }

        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ login: loginId.trim(), password }),
        });

        const data = await res.json() as { error?: string; message?: string; user?: PublicUser; token?: string };
        if (!res.ok) {
          throw new Error(data.message || data.error || "Login failed.");
        }

        if (data.token && data.user) {
          login(data.token, data.user);
          showToast(`Welcome back, ${data.user.username}!`);
          onSuccess?.();
          onClose();
        }
      } else {
        // Register
        if (!regUsername.trim() || !regEmail.trim() || !password) {
          throw new Error("All fields are required.");
        }

        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: regUsername.trim(),
            email: regEmail.trim(),
            password,
          }),
        });

        const data = await res.json() as { error?: string; message?: string; user?: PublicUser; token?: string };
        if (!res.ok) {
          throw new Error(data.message || data.error || "Registration failed.");
        }

        if (data.token && data.user) {
          login(data.token, data.user);
          showToast(`Account created! Welcome, ${data.user.username}!`);
          onSuccess?.();
          onClose();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`modal-overlay ${isOpen ? "open" : ""}`} onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 420,
          width: "90%",
          padding: 24,
          borderRadius: "var(--radius)",
          background: "var(--color-bg-2)",
          border: "1px solid var(--border)",
          boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
        }}
      >
        <div className="modal-header" style={{ marginBottom: 18 }}>
          <div className="modal-title" style={{ fontSize: 18, fontWeight: 600 }}>
            {tab === "signin" ? "Sign In to PostTrack" : "Create PostTrack Account"}
          </div>
          <button className="modal-close" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: "flex",
            background: "var(--color-bg)",
            borderRadius: 8,
            padding: 3,
            marginBottom: 20,
            border: "1px solid var(--border)",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setTab("signin");
              setError(null);
            }}
            style={{
              flex: 1,
              padding: "8px 12px",
              fontSize: 13,
              fontWeight: 500,
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              background: tab === "signin" ? "var(--color-bg-3)" : "transparent",
              color: tab === "signin" ? "var(--accent)" : "var(--text-2)",
              transition: "all 0.2s ease",
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("register");
              setError(null);
            }}
            style={{
              flex: 1,
              padding: "8px 12px",
              fontSize: 13,
              fontWeight: 500,
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              background: tab === "register" ? "var(--color-bg-3)" : "transparent",
              color: tab === "register" ? "var(--accent)" : "var(--text-2)",
              transition: "all 0.2s ease",
            }}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div
            style={{
              background: "rgba(248, 113, 113, 0.12)",
              border: "1px solid rgba(248, 113, 113, 0.3)",
              color: "#f87171",
              padding: "10px 14px",
              borderRadius: 8,
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {tab === "signin" ? (
            <div>
              <label style={{ display: "block", fontSize: 12, color: "var(--text-2)", marginBottom: 6 }}>
                Username or Email
              </label>
              <input
                type="text"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="e.g. ranit or user@example.com"
                required
                autoFocus
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  background: "var(--color-bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  color: "var(--text)",
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          ) : (
            <>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "var(--text-2)", marginBottom: 6 }}>
                  Username
                </label>
                <input
                  type="text"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder="e.g. alex_ship"
                  required
                  autoFocus
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    background: "var(--color-bg)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--text)",
                    fontSize: 14,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "var(--text-2)", marginBottom: 6 }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    background: "var(--color-bg)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--text)",
                    fontSize: 14,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </>
          )}

          <div>
            <label style={{ display: "block", fontSize: 12, color: "var(--text-2)", marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: "100%",
                padding: "10px 14px",
                background: "var(--color-bg)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text)",
                fontSize: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 10,
              padding: "12px",
              background: "var(--accent)",
              color: "#14120b",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              transition: "opacity 0.2s",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Processing..." : tab === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
};
