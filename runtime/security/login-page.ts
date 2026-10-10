import { loginIllustration } from "./login-illustration"

const escape = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!)

/** A native form keeps login accessible and independent of the authenticated app bundle. */
export function loginPage(
  prefix: string,
  mode: "basic" | "oidc",
  returnTo: string,
  error = "",
  status = 200,
): Response {
  return new Response(
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Sign in · Celery Insights</title>
  <style>
    :root {
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color-scheme: light dark;
      color: light-dark(#20281e, #edf1e8);
      background: light-dark(#fafbf7, #171c18);
      font-synthesis: none;
      -webkit-font-smoothing: antialiased;
      --muted: light-dark(#6a7364, #a0ab99);
      --border: light-dark(#dce1d5, #3b4437);
      --primary: #a9cc54;
    }
    * { box-sizing: border-box; }
    body { margin: 0; }
    .layout { display: grid; min-height: 100svh; grid-template-columns: 1fr 1fr; }
    .sign-in-panel { display: flex; flex-direction: column; padding: 40px 48px 28px; }
    .brand { display: inline-flex; align-items: center; gap: 11px; font-size: 17px; font-weight: 650; letter-spacing: -.5px; }
    .brand svg { width: 32px; height: 32px; }
    .form-area { display: flex; flex: 1; align-items: center; justify-content: center; padding: 64px 0; }
    .form-content { width: 100%; max-width: 352px; }
    .eyebrow { margin: 0 0 16px; color: var(--muted); font-size: 11px; font-weight: 600; letter-spacing: 1.8px; text-transform: uppercase; }
    h1 { margin: 0; font-size: 32px; line-height: 1.2; font-weight: 600; letter-spacing: -1.2px; }
    .intro { margin: 12px 0 32px; color: var(--muted); font-size: 14px; line-height: 1.65; }
    .field { margin-bottom: 20px; }
    label { display: block; margin-bottom: 8px; font-size: 13px; font-weight: 550; }
    input { width: 100%; height: 44px; padding: 10px 13px; border: 1px solid var(--border); border-radius: 7px; background: light-dark(#fff, #1d241e); color: inherit; font: inherit; font-size: 14px; box-shadow: 0 1px 2px #00000004; transition: border-color .15s; }
    input::placeholder { color: var(--muted); opacity: .7; }
    input:hover { border-color: light-dark(#adb7a2, #647557); }
    .signin { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; min-height: 44px; padding: 11px 16px; margin-top: 26px; border: 1px solid #9aba4c; border-radius: 7px; background: var(--primary); color: #202b14; font: inherit; font-size: 14px; font-weight: 600; text-decoration: none; cursor: pointer; transition: background .15s; }
    .signin:hover { background: #b6d76b; }
    .signin svg { width: 16px; height: 16px; flex-shrink: 0; }
    :focus-visible { outline: 3px solid light-dark(#789a3b, #a9cc54); outline-offset: 3px; }
    .help { margin: 24px 0 0; color: var(--muted); text-align: center; font-size: 12px; line-height: 1.7; }
    .error { padding: 12px 14px; margin: 0 0 24px; border: 1px solid light-dark(#f2c9c2, #703c33); border-radius: 7px; background: light-dark(#fff4f1, #35221e); color: light-dark(#a33526, #ffb4a5); font-size: 13px; line-height: 1.5; }
    .footer { color: var(--muted); font-size: 11px; line-height: 1.6; }
    .visual-panel { display: flex; flex-direction: column; justify-content: center; overflow: hidden; position: relative; margin: 12px 12px 12px 0; border-radius: 16px; background: radial-gradient(ellipse at 50% 38%, #2b402b 0, #1d3025 45%, #14271f 100%); color: #f1f5e9; padding: 56px clamp(32px, 5vw, 88px); }
    .visual-panel::before { content: ""; position: absolute; inset: 12px; border: 1px solid #c9e99a0c; border-radius: 10px; pointer-events: none; }
    .visual-content { width: 100%; max-width: 560px; margin: auto; }
    .task-graph { display: block; width: calc(100% + 48px); max-height: 460px; margin: -24px -24px 32px; }
    .visual-copy { max-width: 420px; }
    .visual-copy .eyebrow { color: #a9cc54; }
    h2 { font-size: clamp(30px, 3vw, 44px); line-height: 1.15; font-weight: 500; letter-spacing: -1.5px; margin: 0 0 20px; }
    h2 span { color: #b6ce9f; }
    .visual-description { color: #aebdaa; font-size: 14px; line-height: 1.8; margin: 0; max-width: 340px; }
    @media (min-width: 1600px) { .visual-content { max-width: 640px; } .task-graph { max-height: 520px; margin-bottom: 48px; } }
    @media (max-width: 960px) { .sign-in-panel { padding: 32px; } .visual-panel { padding: 40px 28px; } .task-graph { margin-bottom: 24px; } }
    @media (max-width: 767px) { .layout { grid-template-columns: 1fr; } .visual-panel { display: none; } .sign-in-panel { min-height: 100svh; padding: 28px 24px 24px; } .form-area { padding: 56px 0; } .footer { text-align: center; } h1 { font-size: 30px; } }
    @media (prefers-reduced-motion: reduce) { input, .signin { transition: none; } }
  </style>
</head>
<body>
  <main class="layout">
    <section class="sign-in-panel" aria-labelledby="sign-in-title">
      <div class="brand">
        <svg viewBox="0 0 104 104" fill="none" aria-hidden="true" focusable="false"><rect width="104" height="104" rx="25" fill="#A9CC54"/><path fill="#161918" d="M17 24.5h56v20H17z"/><path fill="white" d="M17 59.5h70v20H17z"/></svg>
        <span>Celery Insights</span>
      </div>
      <div class="form-area">
        <div class="form-content">
          <p class="eyebrow">Your cluster, in focus</p>
          <h1 id="sign-in-title">Welcome back</h1>
          <p class="intro">${mode === "basic" ? "Sign in to your Celery Insights workspace." : "Sign in with your organization’s identity provider."}</p>
          ${error ? `<p class="error" role="alert">${escape(error)}</p>` : ""}
          ${
            mode === "basic"
              ? `<form method="post" action="${escape(prefix)}/api/auth/login">
            <input type="hidden" name="returnTo" value="${escape(returnTo)}">
            <div class="field"><label for="username">Username</label><input id="username" name="username" autocomplete="username" placeholder="Enter your username" required maxlength="64" autocapitalize="none" spellcheck="false"></div>
            <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" placeholder="Enter your password" required maxlength="4096"></div>
            <button class="signin" type="submit">Sign in <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          </form>`
              : `<a class="signin" href="${escape(prefix)}/api/auth/oidc?returnTo=${escape(encodeURIComponent(returnTo))}">Sign in with your identity provider <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg></a>`
          }
          <p class="help">Need access? Contact your administrator.</p>
        </div>
      </div>
      <footer class="footer">Celery Insights · Open-source task monitoring</footer>
    </section>
    <aside class="visual-panel" aria-label="About Celery Insights">
      <div class="visual-content">
        ${loginIllustration}
        <div class="visual-copy">
          <p class="eyebrow">From queued to complete</p>
          <h2>Every task has a story.<br><span>See the whole picture.</span></h2>
          <p class="visual-description">Follow your tasks, understand your workers, and make sense of every workflow. All in one place.</p>
        </div>
      </div>
    </aside>
  </main>
</body>
</html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
        "Referrer-Policy": "same-origin",
        "X-Content-Type-Options": "nosniff",
      },
    },
  )
}

/** A new same-origin document ends the IdP POST redirect chain before entering the app. */
export function loginComplete(destination: string, headers: Headers): Response {
  headers.set("Content-Type", "text/html; charset=utf-8")
  headers.set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'")
  headers.set("Referrer-Policy", "same-origin")
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${escape(destination)}"><title>Signed in · Celery Insights</title></head><body><p>Signed in. <a href="${escape(destination)}">Continue to Celery Insights</a></p></body></html>`,
    { status: 200, headers },
  )
}
