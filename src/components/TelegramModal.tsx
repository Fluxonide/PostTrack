import React, { useState, useEffect, useCallback } from "react";
import { FaTelegramPlane, FaCheckCircle, FaCopy, FaExternalLinkAlt } from "react-icons/fa";
import { useAuth } from "../lib/authContext";
import { showToast } from "../lib/toast";

interface TelegramModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface LinkData {
  code: string;
  deepLink: string;
  command: string;
  botConfigured: boolean;
  botUsername: string | null;
}

export const TelegramModal: React.FC<TelegramModalProps> = ({ isOpen, onClose }) => {
  const { user, token, refreshUser } = useAuth();
  const [linkData, setLinkData] = useState<LinkData | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchLinkCode = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/telegram/link-code", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json() as LinkData;
        setLinkData(data);
      }
    } catch {
      showToast("Could not generate link code.", "error");
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Initial load when opened
  useEffect(() => {
    if (isOpen && !user?.telegramConnected) {
      fetchLinkCode();
    }
  }, [isOpen, user?.telegramConnected, fetchLinkCode]);

  // Poll for connection while modal is open and not connected
  useEffect(() => {
    if (!isOpen || !token || user?.telegramConnected) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/telegram/status", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json() as { connected: boolean; telegramUsername: string | null };
          if (data.connected) {
            await refreshUser();
            showToast("Telegram connected successfully!");
          }
        }
      } catch {
        // Ignore polling errors
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [isOpen, token, user?.telegramConnected, refreshUser]);

  const handleCopy = () => {
    if (!linkData?.command) return;
    navigator.clipboard.writeText(linkData.command);
    setCopied(true);
    showToast("Command copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDisconnect = async () => {
    if (!token) return;
    setDisconnecting(true);
    try {
      const res = await fetch("/api/telegram/disconnect", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        await refreshUser();
        showToast("Telegram disconnected.");
        fetchLinkCode();
      }
    } catch {
      showToast("Error disconnecting Telegram.", "error");
    } finally {
      setDisconnecting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`modal-overlay ${isOpen ? "open" : ""}`} onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 460,
          width: "90%",
          padding: 24,
          borderRadius: "var(--radius)",
          background: "var(--color-bg-2)",
          border: "1px solid var(--border)",
          boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
        }}
      >
        <div className="modal-header" style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FaTelegramPlane size={22} style={{ color: "#229ED9" }} />
            <div className="modal-title" style={{ fontSize: 18, fontWeight: 600 }}>
              Telegram Live Notifications
            </div>
          </div>
          <button className="modal-close" onClick={onClose} title="Close">
            ✕
          </button>
        </div>

        {user?.telegramConnected ? (
          <div style={{ textAlign: "center", padding: "16px 8px" }}>
            <div style={{ marginBottom: 16 }}>
              <FaCheckCircle size={44} style={{ color: "var(--color-success)" }} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
              Telegram Connected!
            </h3>
            <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.5, marginBottom: 20 }}>
              Connected as{" "}
              <strong style={{ color: "var(--accent)" }}>
                {user.telegramUsername ? `@${user.telegramUsername}` : "Linked User"}
              </strong>
              . You will receive real-time push alerts whenever your tracked parcels have new activity or milestones.
            </p>

            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              style={{
                padding: "8px 16px",
                background: "rgba(248, 113, 113, 0.12)",
                color: "#f87171",
                border: "1px solid rgba(248, 113, 113, 0.3)",
                borderRadius: 8,
                fontSize: 13,
                cursor: disconnecting ? "not-allowed" : "pointer",
              }}
            >
              {disconnecting ? "Disconnecting..." : "Disconnect Telegram"}
            </button>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.5, marginBottom: 16 }}>
              Connect your Telegram account to receive instant delivery updates, out-for-delivery scans, and status changes directly in your chat.
            </p>

            {loading ? (
              <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text-3)", fontSize: 13 }}>
                Generating connection code...
              </div>
            ) : linkData ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Primary Button: Open in Telegram */}
                <a
                  href={linkData.deepLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: "12px",
                    background: "#229ED9",
                    color: "#fff",
                    borderRadius: 8,
                    textDecoration: "none",
                    fontWeight: 600,
                    fontSize: 14,
                    transition: "opacity 0.2s",
                  }}
                >
                  <FaTelegramPlane size={18} />
                  <span>Open in Telegram</span>
                  <FaExternalLinkAlt size={12} style={{ opacity: 0.8 }} />
                </a>

                {/* Or copy start command */}
                <div style={{ textAlign: "center", fontSize: 12, color: "var(--text-3)" }}>
                  — OR send this start command in the bot —
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "var(--color-bg)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    padding: "8px 12px",
                  }}
                >
                  <code
                    style={{
                      fontFamily: "var(--mono)",
                      fontSize: 13,
                      color: "var(--accent)",
                      wordBreak: "break-all",
                    }}
                  >
                    {linkData.command}
                  </code>
                  <button
                    onClick={handleCopy}
                    style={{
                      background: "none",
                      border: "none",
                      color: copied ? "var(--color-success)" : "var(--text-2)",
                      cursor: "pointer",
                      padding: "4px 8px",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 12,
                    }}
                    title="Copy command"
                  >
                    <FaCopy size={13} />
                    <span>{copied ? "Copied!" : "Copy"}</span>
                  </button>
                </div>

                {/* Steps guide */}
                <div
                  style={{
                    background: "var(--color-surface)",
                    borderRadius: 8,
                    padding: "12px 14px",
                    border: "1px solid var(--border)",
                    fontSize: 12,
                    color: "var(--text-2)",
                    lineHeight: 1.6,
                  }}
                >
                  <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
                    Quick Connection Steps:
                  </div>
                  <div>1. Tap <strong>Open in Telegram</strong> above.</div>
                  <div>2. Tap <strong>Start</strong> in the chat (or paste the command).</div>
                  <div>3. This dialog will automatically confirm your connection!</div>
                </div>
              </div>
            ) : (
              <div style={{ color: "#f87171", fontSize: 13 }}>
                Unable to load Telegram link. Please try again.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
