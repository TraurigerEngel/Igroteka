(() => {
  'use strict';

  const tauri = window.__TAURI__;
  if (!tauri?.core?.invoke) {
    console.error('[Igroteka] Tauri API is unavailable.');
    return;
  }
  const invoke = tauri.core.invoke;

  document.addEventListener('keydown', event => {
    if (event.key === 'Tab') { event.preventDefault(); event.stopPropagation(); }
    if (event.key === 'Escape') setTimeout(() => { try { document.activeElement?.blur?.(); } catch {} }, 0);
  }, true);
  for (const type of ['pointerdown','pointerup','mousedown','mouseup','auxclick','click']) {
    document.addEventListener(type, event => {
      if (event.button === 1) { event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation(); }
    }, true);
  }

  document.documentElement.style.setProperty('background', '#020203', 'important');
  document.documentElement.style.setProperty('color-scheme', 'dark', 'important');

  let persistenceQueue = Promise.resolve();
  let persistenceError = null;
  let pendingPersistenceCount = 0;

  function reportPersistenceError(error) {
    persistenceError = error instanceof Error ? error : new Error(String(error));
    console.error('[Igroteka] SQLite persistence failed:', persistenceError);
    try {
      window.IgrotekaDialog?.alert?.(`Не удалось сохранить изменения в SQLite:\n${persistenceError.message}`, {
        title:'Ошибка сохранения', type:'danger'
      });
    } catch {}
  }

  function queuePersistence(task) {
    pendingPersistenceCount += 1;
    const run = persistenceQueue.then(task);
    persistenceQueue = run.then(
      result => {
        persistenceError = null;
        return result;
      },
      error => {
        reportPersistenceError(error);
        return undefined;
      }
    ).finally(() => {
      pendingPersistenceCount -= 1;
    });
    return run;
  }

  function enqueuePersistence(task) {
    const run = queuePersistence(task);
    void run.catch(() => {});
    return persistenceQueue;
  }

  async function flushPersistence() {
    await persistenceQueue;
    if (persistenceError) throw persistenceError;
  }

  // Minimal standalone runtime helpers used by the current Igroteka UI.
  window.igrotekaRuntime = {
    copyText: text => {
      try { navigator.clipboard?.writeText?.(String(text ?? '')); return true; }
      catch { return false; }
    }
  };

  function installTitlebar() {
    const host = document.getElementById('igrotekaCustomTitlebar');
    if (!host || host.dataset.bound === 'true') return;
    const min = host.querySelector('.ig-titlebar-min');
    const close = host.querySelector('.ig-titlebar-close');
    if (!min || !close) throw new Error('Static Igroteka titlebar is incomplete.');
    host.dataset.bound = 'true';
    // If WebView2 delivers a click to the titlebar itself just outside the
    // button's box, route that narrow edge to the existing guarded close.
    // Native Windows non-client border clicks cannot be recovered here.
    host.addEventListener('click', event => {
      if (event.button !== 0 || !event.isTrusted) return;
      if (event.target.closest?.('button')) return;
      const rect = close.getBoundingClientRect();
      if (event.clientX >= rect.left - 2 && event.clientX <= rect.right + 2 &&
          event.clientY >= rect.top - 2 && event.clientY <= rect.bottom + 2) {
        close.click();
      }
    }, true);
    min.addEventListener('click', () => {
      void invoke('window_minimize').catch(error => console.error('[Igroteka] minimize failed:', error));
    });
    // Close immediately when no writes are pending. Do not silently swallow
    // clicks while SQLite is busy; show a bounded, explicit recovery path.
    let closing = false;
    close.addEventListener('click', async () => {
      if (closing) return;
      closing = true;
      const previousTitle = close.title;
      close.setAttribute('aria-busy', 'true');
      close.title = 'Закрытие Игротеки…';
      try {
        const pendingAtClick = pendingPersistenceCount;
        console.info('[Igroteka] close requested; pending SQLite writes:', pendingAtClick);
        let saveProblem = persistenceError;
        let timeoutId;
        if (!saveProblem && pendingAtClick > 0) {
          try {
            await Promise.race([
              flushPersistence(),
              new Promise((_, reject) => {
                timeoutId = window.setTimeout(() => reject(new Error('Сохранение SQLite выполняется слишком долго.')), 800);
              })
            ]);
          } catch (error) {
            saveProblem = error;
          } finally {
            window.clearTimeout(timeoutId);
          }
        }
        if (saveProblem) {
          console.warn('[Igroteka] close requires unsaved-data confirmation:', saveProblem);
          const confirm = window.IgrotekaDialog?.confirm;
          if (typeof confirm !== 'function') {
            console.error('[Igroteka] Cannot confirm close: dialog runtime is unavailable.');
            window.alert('Не удалось сохранить изменения. Закрытие отменено, чтобы не потерять данные.');
            return;
          }
          const approved = await confirm(
            'Не удалось завершить сохранение данных. Закрыть Игротеку без сохранения последних изменений?',
            { title: 'Сохранение не завершено', type: 'danger', okText: 'Закрыть без сохранения', cancelText: 'Отмена' }
          );
          if (approved !== true) return;
        }
        // Native close must run on the first click when there are no writes.
        await invoke('window_close');
      } catch (error) {
        console.error('[Igroteka] native close failed:', error);
        try {
          await window.IgrotekaDialog?.alert?.(`Не удалось закрыть окно:\n${String(error?.message || error)}`, {
            title:'Ошибка закрытия', type:'danger'
          });
        } catch (dialogError) {
          console.error('[Igroteka] close error dialog failed:', dialogError);
        }
      } finally {
        close.removeAttribute('aria-busy');
        close.title = previousTitle;
        closing = false;
      }
    });
  }

  const STARTUP_HOLD_MS = 980;
  const STARTUP_FADE_MS = 630;
  let startupMarkedReady = false;
  let startupReadyPromise = null;
  window.igrotekaStartup = Object.freeze({
    markReady: () => {
      if (startupReadyPromise) return startupReadyPromise;
      startupReadyPromise = (async () => {
        if (startupMarkedReady) return;
        await new Promise(resolve => window.setTimeout(resolve, STARTUP_HOLD_MS));
        // Prime the canonical particle canvas behind the still-opaque splash.
        // Its first painted frame will fade in together with the library.
        document.dispatchEvent(new Event('igroteka:particles-prime'));
        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);
        document.documentElement.dataset.igrotekaStartup = 'revealing';
        await new Promise(resolve => window.setTimeout(resolve, STARTUP_FADE_MS));
        document.documentElement.dataset.igrotekaStartup = 'ready';
        startupMarkedReady = true;
        document.dispatchEvent(new Event('igroteka:startup-complete'));
      })();
      return startupReadyPromise;
    }
  });

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }

  function resultState(gamesRaw, trashRaw) {
    return {ok:true, games:gamesRaw, trash:trashRaw};
  }

  function validArray(raw) {
    const value = JSON.parse(String(raw || '[]'));
    if (!Array.isArray(value)) throw new Error('Некорректные данные.');
    return value;
  }

  function makeDatabase(seed) {
    let gamesRaw = String(seed.games || '[]');
    let trashRaw = String(seed.trash || '[]');
    let uiRaw = seed.ui == null ? null : String(seed.ui);
    const parse = raw => { try { return JSON.parse(raw || '[]'); } catch { return []; } };
    const persistUI = () => {
      const ui = uiRaw || '{}';
      return enqueuePersistence(() => invoke('persist_games_ui', {ui}));
    };
    const commitDestructive = async (nextGames, nextTrash, reason) => {
      const nextGamesRaw = JSON.stringify(nextGames);
      const nextTrashRaw = JSON.stringify(nextTrash);
      await flushPersistence();
      await invoke('persist_games_state', {games:nextGamesRaw, trash:nextTrashRaw, ui:uiRaw, reason});
      gamesRaw = nextGamesRaw;
      trashRaw = nextTrashRaw;
      persistenceError = null;
      return resultState(gamesRaw, trashRaw);
    };

    return {
      getGamesSync: () => gamesRaw,
      replaceGamesConfirmed: async raw => {
        try {
          const nextGamesRaw = JSON.stringify(validArray(raw));
          const result = await queuePersistence(() => invoke('persist_games_state', {
            games:nextGamesRaw,
            trash:trashRaw,
            ui:uiRaw,
            reason:'Изменён список игр'
          }));
          if (!result?.ok) throw new Error(result?.error || 'SQLite persistence was not confirmed.');
          gamesRaw = nextGamesRaw;
          return {ok:true};
        } catch (e) {
          return {ok:false,error:String(e?.message || e)};
        }
      },
      getTrashSync: () => trashRaw,
      getUISync: () => uiRaw,
      replaceUISync: raw => {
        try {
          const value = JSON.parse(String(raw ?? '{}'));
          if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Некорректные настройки интерфейса.');
          uiRaw = JSON.stringify(value);
          persistUI();
          return {ok:true};
        } catch (e) { return {ok:false,error:e.message}; }
      },
      moveGameToTrash: async id => {
        const games = parse(gamesRaw), trash = parse(trashRaw), n = Number(id), i = games.findIndex(x => Number(x.id) === n);
        if (i < 0) return {ok:false,error:'Игра не найдена.'};
        const [item] = games.splice(i,1);
        const nextId = Math.max(0,...trash.map(x => Number(x.id)||0)) + 1;
        trash.push({...item,id:nextId,deleted_at:new Date().toISOString()});
        try { return await commitDestructive(games,trash,'Игра перемещена в корзину'); }
        catch (e) { return {ok:false,error:String(e?.message||e)}; }
      },
      restoreTrash: async id => {
        const games = parse(gamesRaw), trash = parse(trashRaw), n = Number(id), i = trash.findIndex(x => Number(x.id) === n);
        if (i < 0) return {ok:false,error:'Запись не найдена.'};
        const [item] = trash.splice(i,1);
        if (games.some(g => String(g.game).trim().toLowerCase() === String(item.game).trim().toLowerCase())) return {ok:false,error:`«${item.game}» уже есть в списке.`};
        const nextId = Math.max(0,...games.map(x => Number(x.id)||0)) + 1;
        games.push({...item,id:nextId});
        try { return await commitDestructive(games,trash,'Игра восстановлена из корзины'); }
        catch (e) { return {ok:false,error:String(e?.message||e)}; }
      },
      permanentlyDeleteTrash: async id => {
        const trash = parse(trashRaw), n = Number(id), next = trash.filter(x => Number(x.id) !== n);
        if (next.length === trash.length) return {ok:false,error:'Запись не найдена.'};
        try { return await commitDestructive(parse(gamesRaw),next,'Игра окончательно удалена из корзины'); }
        catch (e) { return {ok:false,error:String(e?.message||e)}; }
      },
      emptyTrash: async () => {
        try { return await commitDestructive(parse(gamesRaw),[],'Очищена корзина Игротеки'); }
        catch (e) { return {ok:false,error:String(e?.message||e)}; }
      },
    };
  }

  async function boot() {
    installTitlebar();
    const seed = await invoke('library_state');
    window.igrotekaDatabase = makeDatabase(seed);
    for (const file of ['core.js','games.js','trash.js','runtime.js']) await loadScript(file);
  }

  const start = () => boot().catch(error => {
    console.error('[Igroteka] bootstrap failed', error);
    const message = String(error?.message || error || 'Неизвестная ошибка');
    const shell = document.createElement('main');
    shell.setAttribute('role','alert');
    Object.assign(shell.style,{
      minHeight:'100vh',display:'grid',placeItems:'center',padding:'72px 28px 32px',
      boxSizing:'border-box',color:'#eee7f3',font:'14px/1.5 Inter,system-ui',
      background:'#020203'
    });
    const card = document.createElement('section');
    Object.assign(card.style,{
      width:'min(680px,100%)',padding:'24px 26px',border:'1px solid #4c374f',
      borderRadius:'14px',background:'#121017',boxShadow:'0 18px 55px rgba(0,0,0,.32)'
    });
    const title = document.createElement('h1');
    title.textContent = 'Не удалось открыть Игротеку';
    Object.assign(title.style,{margin:'0 0 10px',fontSize:'20px',lineHeight:'1.2'});
    const text = document.createElement('p');
    text.textContent = 'База данных не была открыта или восстановлена. Рабочие данные не перезаписывались.';
    Object.assign(text.style,{margin:'0 0 12px',color:'#cfc6d6'});
    const detail = document.createElement('pre');
    detail.textContent = message;
    Object.assign(detail.style,{
      margin:'0',padding:'12px 14px',whiteSpace:'pre-wrap',overflowWrap:'anywhere',
      borderRadius:'9px',background:'#0c0a10',border:'1px solid #30283a',color:'#ffb7c0',
      font:'12px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace'
    });
    card.append(title,text,detail);
    shell.append(card);
    for (const child of [...document.body.children]) {
      if (child.id !== 'igrotekaCustomTitlebar') child.remove();
    }
    document.body.appendChild(shell);
    document.documentElement.classList.remove('app-loading');
    void window.igrotekaStartup?.markReady?.();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
