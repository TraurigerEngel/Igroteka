(function(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) api.install(root);
})(typeof window !== 'undefined' ? window : null, function() {
  'use strict';

  const blockedPlain = new Set(['f3', 'f5', 'f6', 'f7', 'f10', 'f11', 'f12']);
  const blockedAccel = new Set(['r', 'p', 's', 'o', 'l', 'u', 'n', 't', 'w', 'd', 'h', 'j', 'k', 'f', 'e', 'g']);
  const blockedAccelShift = new Set(['r', 'i', 'j', 'c', 'n', 't', 'w', 'o', 'b', 'g', 'delete']);
  const blockedAlt = new Set(['arrowleft', 'arrowright', 'home']);

  function keyOf(event) {
    return String(event && event.key || '').toLowerCase();
  }

  function shouldBlockBrowserShortcut(event) {
    const key = keyOf(event);
    if (blockedPlain.has(key)) return true;

    if (event && event.altKey && !event.ctrlKey && !event.metaKey) {
      return blockedAlt.has(key);
    }

    const accelerator = !!(event && (event.ctrlKey || event.metaKey));
    if (!accelerator || (event && event.altKey)) return false;

    if (event && event.shiftKey) return blockedAccelShift.has(key);
    return blockedAccel.has(key);
  }

  function install(win) {
    if (!win || !win.document || win.__igrotekaBrowserGuardInstalled) return;
    Object.defineProperty(win, '__igrotekaBrowserGuardInstalled', {
      value: true,
      configurable: false,
      enumerable: false,
      writable: false
    });

    const doc = win.document;

    // WebView2's default Edge menu (Back / Refresh / Save as / Print / More tools)
    // is not part of Igroteka. Prevent only the browser default; application
    // contextmenu handlers still receive the event and can render their own menus.
    doc.addEventListener('contextmenu', event => {
      event.preventDefault();
    }, true);

    // Keep normal editing shortcuts (Ctrl+C/X/V/A/Z/Y) and Igroteka shortcuts,
    // while suppressing browser navigation/reload/print/save/devtools accelerators.
    doc.addEventListener('keydown', event => {
      if (!shouldBlockBrowserShortcut(event)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }, true);

    // Browser back/forward mouse buttons and middle-click navigation are not app UI.
    for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'auxclick', 'click']) {
      doc.addEventListener(type, event => {
        if (event.button !== 1 && event.button !== 3 && event.button !== 4) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }, true);
    }
  }

  return { install, shouldBlockBrowserShortcut };
});
