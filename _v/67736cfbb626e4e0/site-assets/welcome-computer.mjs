/** Small vector artwork: no bitmap, video, WebGL context or animation loop. */
export function welcomeComputer() {
  return `<div class="welcome-computer">
    <svg viewBox="0 0 480 370" role="img" aria-label="A cream pixel computer with a softly blinking mint cursor" focusable="false" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="welcome-case" x2="0" y2="1"><stop stop-color="#fff4dc"/><stop offset="1" stop-color="#f0cbd1"/></linearGradient>
        <linearGradient id="welcome-glass" x2="0" y2="1"><stop stop-color="#071b30"/><stop offset="1" stop-color="#0c2639"/></linearGradient>
        <radialGradient id="welcome-halo"><stop stop-color="#b4a0ed" stop-opacity=".13"/><stop offset="1" stop-color="#b4a0ed" stop-opacity="0"/></radialGradient>
      </defs>
      <ellipse cx="240" cy="183" rx="207" ry="165" fill="url(#welcome-halo)"/>
      <g class="computer-sparkles" fill="#cdb4ee" shape-rendering="crispEdges" aria-hidden="true">
        <path d="M48 133h5v-5h5v5h5v5h-5v5h-5v-5h-5z"/>
        <path d="M416 78h4v-4h4v4h4v4h-4v4h-4v-4h-4z" fill="#ffefd1"/>
        <path d="M405 273h5v5h-5zM77 268h4v4h-4z" opacity=".45"/>
      </g>
      <path d="M126 338h234v6H126zM143 344h200v4H143z" fill="#060e2b" opacity=".46"/>
      <g class="computer-float" shape-rendering="crispEdges">
        <path d="M213 260h70v44h-70z" fill="#a28bc2"/>
        <path d="M214 264h55v34h-55z" fill="#f1d5d5"/>
        <path d="M223 264h9v30h-9z" fill="#fff0da"/>
        <path d="M192 295h95v7h14v12H177v-12h15z" fill="#8d7bbb"/>
        <path d="M190 291h90v7h14v9H177v-9h13z" fill="#ffe7d6"/>
        <path d="M102 62h281v9h12v196h-10v12H102v-9H89V74h13z" fill="#060f2e"/>
        <path d="M101 56h275v10h12v191h-12v13H101v-10H88V69h13z" fill="#8a70b7"/>
        <path d="M104 52h260v8h12v190h-12v12H104v-8H92V64h12z" fill="url(#welcome-case)"/>
        <path d="M104 52h260v8H111v8H98v182h-6V64h12z" fill="#fff9e3"/>
        <path d="M111 254h253v-10h12v6h-12v12H104v-8h-6v-7h13z" fill="#d4afd0"/>
        <path d="M121 77h225v7h10v139h-10v7H121v-7h-10V88h10z" fill="#9a83b7"/>
        <path d="M126 84h216v7h9v126h-9v8H126v-8h-9V94h9z" fill="#08112d"/>
        <g class="computer-screen">
          <path d="M130 91h208v6h7v115h-7v7H130v-7h-7V99h7z" fill="url(#welcome-glass)"/>
          <path d="M135 99h160v3H135z" fill="#4cffcf" opacity=".11"/>
          <path d="M128 103h4v103h-4z" fill="#8ca9ae" opacity=".11"/>
          <g class="computer-prompt" fill="#4effca">
            <path d="M177 131h11v11h11v11h11v11h-11v11h-11v11h-11v-11h11v-11h11v-11h-11v-11h-11z"/>
            <path class="computer-cursor" d="M228 175h44v11h-44z"/>
          </g>
          <path d="M139 204h22v3h-22zM167 204h9v3h-9z" fill="#4effca" opacity=".18"/>
        </g>
        <g fill="#b598bb"><path d="M117 241h33v3h-33zM117 247h33v3h-33z"/></g>
        <path d="M337 238h16v14h-16z" fill="#9c86b1"/>
        <path d="M340 240h11v8h-11z" fill="#30c797"/>
        <path class="computer-power" d="M340 240h11v6h-11z" fill="#7bffcf"/>
        <path d="M117 315h235v7h13v18H104v-17h13z" fill="#8271ae"/>
        <path d="M117 310h227v7h13v16H104v-16h13z" fill="#f2d4d4"/>
        <path d="M117 310h227v5H117v7h-13v-5h13z" fill="#fff3dc"/>
        <path d="M117 320h22v5h-22zM145 320h22v5h-22zM173 320h22v5h-22zM201 320h22v5h-22zM229 320h22v5h-22zM257 320h22v5h-22zM285 320h22v5h-22zM313 320h22v5h-22z" fill="#bca5c4"/>
        <path d="M176 328h108v3H176z" fill="#957eaf"/>
      </g>
    </svg>
  </div>`;
}
