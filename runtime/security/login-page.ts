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
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in · Celery Insights</title><style>
:root{font:16px system-ui;color-scheme:light dark}body{margin:0;min-height:100vh;display:grid;place-items:center;background:light-dark(#f8fafc,#111827);color:light-dark(#0f172a,#f1f5f9)}main{box-sizing:border-box;width:min(420px,calc(100% - 32px));padding:32px;border:1px solid light-dark(#e2e8f0,#334155);border-radius:16px;background:light-dark(white,#1e293b)}h1{font-size:24px;margin:0 0 8px}p{line-height:1.5}label{display:block;margin:20px 0 8px}input,button{box-sizing:border-box;width:100%;font:inherit;padding:12px;border-radius:8px}input{border:1px solid #94a3b8}button{margin-top:24px;background:#2563eb;color:white;border:0;cursor:pointer}a{color:#2563eb}.signin{display:block;margin-top:24px;padding:12px;background:#2563eb;color:white;border-radius:8px;text-align:center;text-decoration:none}.error{color:light-dark(#b91c1c,#fca5a5)}:focus-visible{outline:3px solid #60a5fa;outline-offset:3px}</style></head><body><main><h1>Celery Insights</h1><p>Sign in to your installation.</p>${error ? `<p class="error" role="alert">${escape(error)}</p>` : ""}${mode === "basic" ? `<form method="post" action="${escape(prefix)}/api/auth/login"><input type="hidden" name="returnTo" value="${escape(returnTo)}"><label for="username">Username</label><input id="username" name="username" autocomplete="username" required maxlength="64" autofocus><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="4096"><button type="submit">Sign in</button></form>` : `<a class="signin" href="${escape(prefix)}/api/auth/oidc?returnTo=${escape(encodeURIComponent(returnTo))}">Sign in with your identity provider</a>`}</main></body></html>`,
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
