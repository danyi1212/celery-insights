/** Decorative task graph, embedded so sign-in never depends on external assets. */
export const loginIllustration = `<svg class="task-graph" viewBox="0 0 640 460" fill="none" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#A9CC54" opacity=".16"/></pattern>
    <linearGradient id="connection" x1="120" y1="230" x2="550" y2="230" gradientUnits="userSpaceOnUse"><stop stop-color="#A9CC54"/><stop offset="1" stop-color="#A9CC54" stop-opacity=".25"/></linearGradient>
  </defs>
  <rect width="640" height="460" fill="url(#dots)"/>
  <circle cx="324" cy="226" r="185" stroke="#A9CC54" stroke-opacity=".07"/>
  <circle cx="324" cy="226" r="134" stroke="#A9CC54" stroke-opacity=".1"/>
  <g stroke="url(#connection)" stroke-width="1.5">
    <path d="M180 232H240Q264 232 264 208V127Q264 103 288 103H344"/>
    <path d="M180 232H344"/>
    <path d="M180 232H240Q264 232 264 256V335Q264 359 288 359H344"/>
    <path d="M500 103H526Q550 103 550 127V335Q550 359 526 359H500"/>
    <path d="M500 232H582"/>
  </g>
  <g fill="#C9E99A"><circle cx="222" cy="232" r="4"/><circle cx="304" cy="103" r="4"/><circle cx="308" cy="359" r="4"/><circle cx="550" cy="186" r="4"/></g>
  <g transform="translate(38 169)">
    <rect x="0" y="6" width="144" height="122" rx="16" fill="#101E19" stroke="#3D5141"/>
    <rect width="144" height="122" rx="16" fill="#24392D" stroke="#789653"/>
    <rect x="18" y="18" width="34" height="34" rx="9" fill="#A9CC54"/>
    <path d="M27 28H43M27 35H43M27 42H37" stroke="#21321E" stroke-width="2" stroke-linecap="round"/>
    <text x="18" y="78" fill="#F2F6EA" font-size="15" font-weight="600">Task queue</text>
    <g fill="#A9CC54"><rect x="18" y="94" width="24" height="5" rx="2.5"/><rect x="48" y="94" width="24" height="5" rx="2.5" opacity=".65"/><rect x="78" y="94" width="24" height="5" rx="2.5" opacity=".3"/></g>
  </g>
  <g transform="translate(344 65)">
    <rect width="156" height="76" rx="12" fill="#213329" stroke="#49613E"/>
    <circle cx="25" cy="27" r="5" fill="#A9CC54"/>
    <text x="40" y="32" fill="#E5EDDF" font-size="13" font-weight="500">worker.01</text>
    <path d="M20 56H45L51 47L59 62L67 51L73 56H136" stroke="#A9CC54" stroke-width="1.5" stroke-linejoin="round"/>
  </g>
  <g transform="translate(344 194)">
    <rect width="156" height="76" rx="12" fill="#293E2E" stroke="#87A75D"/>
    <circle cx="25" cy="27" r="5" fill="#C8E58C"/>
    <text x="40" y="32" fill="#F2F6EA" font-size="13" font-weight="500">worker.02</text>
    <path d="M20 56H36L42 50L50 63L58 43L66 56H89L95 51L101 56H136" stroke="#C8E58C" stroke-width="1.5" stroke-linejoin="round"/>
  </g>
  <g transform="translate(344 321)">
    <rect width="156" height="76" rx="12" fill="#213329" stroke="#49613E"/>
    <circle cx="25" cy="27" r="5" fill="#A9CC54"/>
    <text x="40" y="32" fill="#E5EDDF" font-size="13" font-weight="500">worker.03</text>
    <path d="M20 56H57L63 49L71 62L79 53L85 56H136" stroke="#A9CC54" stroke-width="1.5" stroke-linejoin="round"/>
  </g>
  <circle cx="582" cy="232" r="15" fill="#A9CC54"/>
  <path d="M575 232L580 237L589 227" stroke="#20311B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <g transform="translate(58 54) rotate(-5)">
    <rect width="172" height="43" rx="9" fill="#24392D" stroke="#40573E"/>
    <circle cx="21" cy="22" r="4" fill="#A9CC54"/>
    <text x="35" y="26" fill="#C7D6BD" font-size="12" font-family="ui-monospace,monospace">reports.generate</text>
  </g>
  <g transform="translate(92 365) rotate(4)">
    <rect width="184" height="43" rx="9" fill="#24392D" stroke="#40573E"/>
    <path d="M16 22L20 26L27 18" stroke="#A9CC54" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="37" y="26" fill="#C7D6BD" font-size="12" font-family="ui-monospace,monospace">orders.process</text>
  </g>
</svg>`
