export function showToast(msg: string, type: "success" | "error" = "success"): void {
  if (typeof document === "undefined") return;

  const container =
    document.querySelector(".toast-container") ||
    (() => {
      const c = document.createElement("div");
      c.className = "toast-container";
      document.body.appendChild(c);
      return c;
    })();

  const t = document.createElement("div");
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${type === "success" ? "✓" : "×"}</span><span>${msg}</span>`;
  container.appendChild(t);

  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transform = "translateX(20px)";
    t.style.transition = "all 0.3s ease";
    setTimeout(() => t.remove(), 300);
  }, 3000);
}
