/*
 * Minimal Lucide icon subset used dynamically by Igroteka.
 * SVG paths follow the Lucide icon set; rendering is intentionally kept local
 * so the app does not require a runtime CDN dependency.
 */
(() => {
  const icons = {
    x: [['path',{d:'M18 6 6 18'}],['path',{d:'m6 6 12 12'}]],
    'chevron-left': [['path',{d:'m15 18-6-6 6-6'}]],
    'chevron-right': [['path',{d:'m9 18 6-6-6-6'}]],
    'chevrons-left': [['path',{d:'m11 17-5-5 5-5'}],['path',{d:'m18 17-5-5 5-5'}]],
    'chevrons-right': [['path',{d:'m13 17 5-5-5-5'}],['path',{d:'m6 17 5-5-5-5'}]],
    star: [['path',{d:'M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.1 2.1 0 0 0 1.58 1.148l5.166.752a.53.53 0 0 1 .294.904l-3.738 3.644a2.1 2.1 0 0 0-.605 1.86l.882 5.143a.53.53 0 0 1-.769.56l-4.618-2.428a2.1 2.1 0 0 0-1.956 0l-4.618 2.428a.53.53 0 0 1-.769-.56l.882-5.143a2.1 2.1 0 0 0-.605-1.86L2.2 9.778a.53.53 0 0 1 .294-.904l5.166-.752a2.1 2.1 0 0 0 1.58-1.148z'}]],
  };

  function esc(value) {
    return String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  window.lucideSvg = function(name, options = {}) {
    const nodes = icons[name];
    if (!nodes) return '';
    const size = Number(options.size || 18);
    const strokeWidth = Number(options.strokeWidth || 2);
    const cls = options.className ? ` lucide-icon ${esc(options.className)}` : ' lucide-icon';
    const attrs = `class="lucide lucide-${esc(name)}${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"`; 
    const children = nodes.map(([tag, attrsObj]) => `<${tag} ${Object.entries(attrsObj).map(([k,v]) => `${k}="${esc(v)}"`).join(' ')}></${tag}>`).join('');
    return `<svg ${attrs}>${children}</svg>`;
  };
})();
