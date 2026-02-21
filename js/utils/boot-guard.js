// js/utils/boot-guard.js
// ✅ ZERO-ERROR BOOT GUARD (production-safe)
// - Prevents blank screens
// - Shows friendly crash overlay
// - Captures syntax/import/runtime errors
// - Optional SW cleanup (unregister only)

const BOOT_FLAG = "__NEON_BOOTED__";
const SW_CLEANUP_FLAG = "__NEON_SW_CLEANED__";

function safeString(v) {
  try { return String(v); } catch { return "[unprintable]"; }
}

function truncate(str, n = 1200) {
  str = safeString(str);
  return str.length > n ? str.slice(0, n) + "…(truncated)" : str;
}

function ensureOverlay() {
  let el = document.getElementById("neon-crash-overlay");
  if (el) return el;

  el = document.createElement("div");
  el.id = "neon-crash-overlay";
  el.style.cssText = `
    position:fixed;inset:0;z-index:999999;
    background:rgba(0,0,0,.72);
    display:none;align-items:center;justify-content:center;
    padding:16px;
  `;
  el.innerHTML = `
    <div style="
      width:min(720px, 100%);
      background:#121826;
      border:1px solid rgba(255,255,255,.12);
      border-radius:16px;
      padding:16px;
      color:#e5e7eb;
      font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;
      box-shadow:0 16px 40px rgba(0,0,0,.45);
    ">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
        <div>
          <div style="font-size:18px;font-weight:700;color:#fb7185;">Failed to load application</div>
          <div style="font-size:12px;opacity:.85;margin-top:2px;">This is a safe error screen (no data leaked). Share the details with admin.</div>
        </div>
        <button id="neon-crash-close" style="
          background:rgba(255,255,255,.08);
          border:1px solid rgba(255,255,255,.12);
          color:#e5e7eb;
          border-radius:10px;
          padding:8px 10px;
          cursor:pointer;
        ">Close</button>
      </div>

      <div style="margin-top:12px;display:grid;gap:10px;">
        <div style="padding:10px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);">
          <div style="font-size:12px;opacity:.75;margin-bottom:6px;">Error Details</div>
          <pre id="neon-crash-text" style="white-space:pre-wrap;word-break:break-word;margin:0;font-size:12px;line-height:1.35;"></pre>
        </div>

        <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;">
          <button id="neon-crash-copy" style="
            background:#22c55e;
            border:0;color:#06210f;
            border-radius:10px;padding:10px 12px;
            cursor:pointer;font-weight:700;
          ">Copy</button>
          <button id="neon-crash-reload" style="
            background:rgba(255,255,255,.08);
            border:1px solid rgba(255,255,255,.12);
            color:#e5e7eb;
            border-radius:10px;padding:10px 12px;
            cursor:pointer;font-weight:700;
          ">Reload</button>
          <button id="neon-crash-clear" style="
            background:#ef4444;border:0;color:#fff;
            border-radius:10px;padding:10px 12px;
            cursor:pointer;font-weight:700;
          ">Disable Cache & Retry</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(el);

  el.querySelector("#neon-crash-close").onclick = () => (el.style.display = "none");
  el.querySelector("#neon-crash-reload").onclick = () => location.reload();

  el.querySelector("#neon-crash-copy").onclick = async () => {
    const txt = el.querySelector("#neon-crash-text")?.textContent || "";
    try { await navigator.clipboard.writeText(txt); } catch {}
  };

  el.querySelector("#neon-crash-clear").onclick = async () => {
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    } catch {}
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
    } catch {}
    location.reload();
  };

  return el;
}

export function showCrash(err, context = {}) {
  try {
    const overlay = ensureOverlay();
    const pre = overlay.querySelector("#neon-crash-text");

    const payload = {
      when: new Date().toISOString(),
      url: location.href,
      userAgent: navigator.userAgent,
      context,
      error: {
        name: err?.name,
        message: truncate(err?.message || err),
        stack: truncate(err?.stack || "")
      }
    };

    pre.textContent = JSON.stringify(payload, null, 2);
    overlay.style.display = "flex";
  } catch (e) {
    console.error("Crash overlay failed", e);
  }
}

export function installGlobalGuards() {
  if (window[BOOT_FLAG]) return;
  window[BOOT_FLAG] = true;

  window.addEventListener("error", (ev) => {
    const err = ev?.error || new Error(ev?.message || "Unknown error");
    showCrash(err, { type: "window.error", file: ev?.filename, line: ev?.lineno, col: ev?.colno });
  });

  window.addEventListener("unhandledrejection", (ev) => {
    const err = ev?.reason || new Error("Unhandled promise rejection");
    showCrash(err, { type: "unhandledrejection" });
  });
}

export async function cleanupOldServiceWorkersOnce() {
  try {
    if (!("serviceWorker" in navigator)) return;
    if (localStorage.getItem(SW_CLEANUP_FLAG) === "1") return;

    const regs = await navigator.serviceWorker.getRegistrations();
    if (regs?.length) await Promise.all(regs.map(r => r.unregister()));

    localStorage.setItem(SW_CLEANUP_FLAG, "1");
  } catch {
    // silent by design
  }
}

export async function safeImport(path, label = path) {
  try {
    return await import(path);
  } catch (err) {
    showCrash(err, { type: "import", label, path });
    throw err;
  }
}

export async function safeBoot(fn, opts = {}) {
  installGlobalGuards();

  if (opts.cleanupSW) {
    await cleanupOldServiceWorkersOnce();
  }

  try {
    if (document.readyState === "loading") {
      await new Promise(res => document.addEventListener("DOMContentLoaded", res, { once: true }));
    }
    await fn();
  } catch (err) {
    showCrash(err, { type: "boot" });
    throw err;
  }
}
