'use strict';
(() => {
  const theme = 'library';
  const state = { select:null, shell:null, trigger:null, menu:null, items:[], active:-1 };
  let menuCounter = 0;

  const isEligible = select => select instanceof HTMLSelectElement
    && !select.hidden
    && !select.multiple
    && select.dataset.igrotekaNativeSelect !== '1'
    && !select.closest('[hidden]');

  const labelFor = select => {
    const explicit = select.getAttribute('aria-label');
    if (explicit) return explicit;
    const label = select.closest('label');
    if (label) {
      for (const node of label.childNodes) {
        if (node === select) break;
        if (node.nodeType === Node.TEXT_NODE) {
          const text = String(node.textContent || '').trim();
          if (text) return text;
        }
      }
    }
    return 'Выбор';
  };

  const kindFor = select => {
    if (select.classList.contains('rating-select')) return 'rating-table';
    if (select.classList.contains('game-entry-rating')) return 'rating-entry';
    return 'field';
  };

  const selectedOption = select => select.options[select.selectedIndex] || null;

  function sync(select) {
    const shell = select._igrotekaSelectShell;
    const trigger = select._igrotekaSelectTrigger;
    if (!shell || !trigger) return;
    const option = selectedOption(select);
    const label = trigger.querySelector('.igroteka-select-label');
    if (label) label.textContent = option?.textContent?.trim() || '';
    trigger.disabled = Boolean(select.disabled);
    trigger.setAttribute('aria-label', `${labelFor(select)}: ${option?.textContent?.trim() || 'не выбрано'}`);
    shell.dataset.empty = option ? '0' : '1';
    if (state.select === select) renderMenu(select);
  }

  function menuItemClasses(option) {
    return ['igroteka-select-option', ...option.classList].join(' ');
  }

  function renderMenu(select) {
    if (state.select !== select || !state.menu) return;
    const menu = state.menu;
    menu.textContent = '';
    state.items = [];
    let selectedVisibleIndex = -1;
    [...select.options].forEach((option, optionIndex) => {
      if (option.hidden) return;
      const item = document.createElement('button');
      item.type = 'button';
      item.className = menuItemClasses(option);
      item.setAttribute('role', 'option');
      item.setAttribute('value', option.value);
      item.dataset.optionIndex = String(optionIndex);
      item.textContent = option.textContent || '';
      item.disabled = option.disabled;
      const selected = optionIndex === select.selectedIndex;
      item.setAttribute('aria-selected', selected ? 'true' : 'false');
      if (selected) selectedVisibleIndex = state.items.length;
      item.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        if (option.disabled) return;
        select.selectedIndex = optionIndex;
        select.dispatchEvent(new Event('change', { bubbles:true }));
        sync(select);
        closeMenu({ restoreFocus:true });
      });
      menu.appendChild(item);
      state.items.push(item);
    });
    state.active = selectedVisibleIndex >= 0 ? selectedVisibleIndex : (state.items.length ? 0 : -1);
    if (state.active >= 0) state.items[state.active].dataset.active = '1';
    positionMenu();
  }

  function positionMenu() {
    if (!state.menu || !state.trigger) return;
    const rect = state.trigger.getBoundingClientRect();
    const menu = state.menu;
    const gap = 5;
    const edge = 8;
    const width = Math.max(rect.width, 110);
    menu.style.width = `${Math.round(width)}px`;
    menu.style.left = '0px';
    menu.style.top = `${Math.round(rect.bottom + gap)}px`;

    // Theme Preview 1 Hotfix 3: center every themed dropdown on its trigger.
    // CSS may enforce a larger min-width than the trigger (rating menus do), so
    // measure the rendered menu first and clamp the centered position to viewport edges.
    const measuredWidth = menu.getBoundingClientRect().width;
    const centeredLeft = rect.left + (rect.width - measuredWidth) / 2;
    const maxLeft = Math.max(edge, window.innerWidth - measuredWidth - edge);
    menu.style.left = `${Math.round(Math.max(edge, Math.min(centeredLeft, maxLeft)))}px`;

    const menuRect = menu.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - edge;
    const above = rect.top - edge;
    if (menuRect.height > below && above > below) {
      menu.style.top = `${Math.round(Math.max(edge, rect.top - menuRect.height - gap))}px`;
      menu.dataset.side = 'top';
    } else {
      menu.dataset.side = 'bottom';
    }
  }

  function focusActive() {
    if (state.active < 0 || !state.items[state.active]) return;
    state.items.forEach(item => delete item.dataset.active);
    const item = state.items[state.active];
    item.dataset.active = '1';
    item.focus({ preventScroll:true });
    item.scrollIntoView({ block:'nearest' });
  }

  function moveActive(delta) {
    if (!state.items.length) return;
    let next = state.active;
    for (let attempts = 0; attempts < state.items.length; attempts++) {
      next = (next + delta + state.items.length) % state.items.length;
      if (!state.items[next].disabled) break;
    }
    state.active = next;
    focusActive();
  }

  function closeMenu({ restoreFocus=false } = {}) {
    if (!state.select) return;
    const trigger = state.trigger;
    state.shell?.removeAttribute('data-open');
    trigger?.setAttribute('aria-expanded', 'false');
    state.menu?.remove();
    state.select = null;
    state.shell = null;
    state.trigger = null;
    state.menu = null;
    state.items = [];
    state.active = -1;
    if (restoreFocus && trigger?.isConnected) trigger.focus({ preventScroll:true });
  }

  function openMenu(select, { focusList=false, direction=1 } = {}) {
    if (select.disabled) return;
    if (state.select === select) {
      if (focusList) focusActive();
      return;
    }
    closeMenu();
    const shell = select._igrotekaSelectShell;
    const trigger = select._igrotekaSelectTrigger;
    if (!shell || !trigger) return;
    const menu = document.createElement('div');
    const kind = kindFor(select);
    menu.className = `igroteka-select-menu igroteka-select-theme-${theme} igroteka-select-menu-${kind}`;
    menu.id = `igroteka-select-menu-${++menuCounter}`;
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-label', labelFor(select));
    document.body.appendChild(menu);
    state.select = select;
    state.shell = shell;
    state.trigger = trigger;
    state.menu = menu;
    shell.dataset.open = '1';
    trigger.setAttribute('aria-expanded', 'true');
    trigger.setAttribute('aria-controls', menu.id);
    renderMenu(select);
    if (focusList && state.items.length) {
      if (direction < 0) state.active = state.items.length - 1;
      focusActive();
    }
  }

  function onTriggerKeydown(event, select) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopImmediatePropagation();
      openMenu(select, { focusList:true, direction:event.key === 'ArrowUp' ? -1 : 1 });
      return;
    }
    if (event.key === 'Escape' && state.select === select) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeMenu({ restoreFocus:true });
    }
  }

  function onMenuKeydown(event) {
    if (!state.menu?.contains(event.target)) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopImmediatePropagation();
      moveActive(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      event.stopImmediatePropagation();
      state.active = event.key === 'Home' ? 0 : state.items.length - 1;
      focusActive();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeMenu({ restoreFocus:true });
      return;
    }
    if (event.key === 'Tab') closeMenu();
  }

  function enhance(select) {
    if (!isEligible(select) || select.dataset.igrotekaThemedSelect === '1') return;
    select.dataset.igrotekaThemedSelect = '1';
    const kind = kindFor(select);
    const shell = document.createElement('span');
    shell.className = `igroteka-select-shell igroteka-select-${kind} igroteka-select-theme-${theme}`;
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'igroteka-select-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    const label = document.createElement('span');
    label.className = 'igroteka-select-label';
    trigger.append(label);
    select.insertAdjacentElement('afterend', shell);
    shell.appendChild(trigger);
    select.classList.add('igroteka-native-select-source');
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');
    select._igrotekaSelectShell = shell;
    select._igrotekaSelectTrigger = trigger;
    trigger.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      if (state.select === select) closeMenu({ restoreFocus:true });
      else openMenu(select);
    });
    trigger.addEventListener('keydown', event => onTriggerKeydown(event, select));
    select.addEventListener('change', () => sync(select));
    select.addEventListener('focus', () => trigger.focus({ preventScroll:true }));
    const observer = new MutationObserver(() => sync(select));
    observer.observe(select, { childList:true, subtree:true, attributes:true, attributeFilter:['disabled','class','hidden'] });
    select._igrotekaSelectObserver = observer;
    sync(select);
  }

  function scan(root=document) {
    if (root instanceof HTMLSelectElement) enhance(root);
    root.querySelectorAll?.('select').forEach(enhance);
  }

  document.addEventListener('pointerdown', event => {
    if (!state.select) return;
    if (state.menu?.contains(event.target) || state.trigger?.contains(event.target)) return;
    closeMenu();
  }, true);
  document.addEventListener('keydown', onMenuKeydown, true);
  window.addEventListener('resize', positionMenu, { passive:true });
  window.addEventListener('scroll', positionMenu, { passive:true, capture:true });
  window.addEventListener('blur', () => closeMenu());

  const start = () => {
    scan(document);
    new MutationObserver(records => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof Element) scan(node);
        }
      }
      if (state.select && (!state.select.isConnected || state.select.hidden || state.select.closest('[hidden]'))) closeMenu();
    }).observe(document.documentElement, { childList:true, subtree:true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
