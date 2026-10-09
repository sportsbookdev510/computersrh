import {icon, escapeHtml as e} from './ui.mjs';

/** Shared pixel desktop chrome for the application and access screens.
 * ``barExtra`` and ``statusExtra`` are trusted HTML for the title bar (before the monogram) and the end of the
 * status bar; the game guide uses them for Back to island and the music control. Other windows leave them empty. */
export function desktopWindow(state,{index='access',aside=null,right='',title='Early Access',status='computersrh.xyz',className='',barExtra='',statusExtra='',returnHref='/'}={}) {
  const single=aside===null;
  // Local game returns leave the site's SPA; other windows keep their home destination.
  const back=['/play','/preview/plaza32/'].includes(returnHref)?returnHref:'/';
  const returnLink=(back==='/preview/plaza32/'?'':' data-route')+' href="'+back+'"';
  const interior=single?`<div class="window-interior access-interior">${right}</div>`:`<div class="window-interior"><aside class="journey-aside">${aside}</aside><div class="journey-right">${right}</div></div>`;
  return `<section class="page-shell journey-shell${single?' access-shell':''}${className?' '+e(className):''}" data-step="${e(index)}" aria-label="${e(title)}"><div class="desktop-window${single?' access-window':''} ${state.windowExpanded?'is-expanded':''}"><header class="window-bar"><div class="window-controls"><a class="window-control close"${returnLink} aria-label="Close ${e(title)}">${icon('close')}</a><a class="window-control minimize"${returnLink} aria-label="Minimize ${e(title)}"><span></span></a><button class="window-control expand" data-action="expand-window" data-window-title="${e(title)}" type="button" aria-label="${state.windowExpanded?'Restore':'Expand'} ${e(title)}" aria-pressed="${Boolean(state.windowExpanded)}"><span></span></button></div><h1${/^[A-Z]{2,4}$/.test(title)?' class="is-acronym"':''}>${e(title)}</h1>${barExtra}<span class="window-monogram" aria-hidden="true">RH</span></header>${interior}<footer class="window-status"><span>${e(status)}</span><span>${icon('feather','chain-feather')} Robinhood Chain</span>${statusExtra}</footer></div><a class="back-link"${returnLink}>${icon('back')} Back to island</a></section>`;
}
