/* Igroteka standalone modal system. */
(() => {
  const controllers = new Map();
  const FOCUSABLE = 'button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';
  const openControllers = () => [...controllers.values()].filter(c => c.isOpen());
  const updateLock = () => {
    const locked = openControllers().length > 0;
    document.documentElement.classList.toggle('modal-open', locked);
    document.body.classList.toggle('modal-open', locked);
  };

  function bind(id, overlay, dialog) {
    if (!overlay || !dialog) return null;
    if (controllers.has(id)) return controllers.get(id);
    let closeTimer = null;
    let previousFocus = null;
    let opening = false;
    const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const controller = {
      id,
      overlay,
      dialog,
      isOpen: () => overlay.classList.contains('open'),
      open(preferredFocus = null) {
        clearTimeout(closeTimer);
        overlay.classList.remove('closing');
        previousFocus = document.activeElement;
        overlay.classList.add('open');
        if (overlay.classList.contains('modal-backdrop')) overlay.classList.add('show');
        overlay.setAttribute('aria-hidden', 'false');
        updateLock();
        opening = true;
        requestAnimationFrame(() => {
          const target = preferredFocus || dialog.querySelector(FOCUSABLE);
          target?.focus?.({ preventScroll: true });
          opening = false;
        });
      },
      close({ restoreFocus = true, immediate = false, blurRestoredFocus = false } = {}) {
        if (!controller.isOpen() && !overlay.classList.contains('closing')) return;
        clearTimeout(closeTimer);
        overlay.classList.add('closing');
        const finish = () => {
          overlay.classList.remove('open', 'closing', 'show');
          overlay.setAttribute('aria-hidden', 'true');
          updateLock();
          if (restoreFocus && previousFocus?.isConnected) {
            previousFocus.focus?.({ preventScroll: true });
            if (blurRestoredFocus) previousFocus.blur?.();
          }
          previousFocus = null;
        };
        if (immediate || reduced()) finish();
        else closeTimer = setTimeout(finish, 220);
      },
      toggle() { controller.isOpen() ? controller.close() : controller.open(); }
    };
    overlay.addEventListener('click', e => { if (e.target === overlay) controller.close(); });
    controllers.set(id, controller);
    return controller;
  }

  const hasVisibleDialog = () => [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].some(el => {
    if (el.getAttribute('aria-hidden') === 'true') return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && (el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  });
  const clearEscapeFocus = () => {
    const blurIfDismissed = () => {
      if (!hasVisibleDialog()) document.activeElement?.blur?.();
    };
    requestAnimationFrame(blurIfDismissed);
    setTimeout(blurIfDismissed, 0);
    setTimeout(blurIfDismissed, 250);
  };

  document.addEventListener('keydown', e => {
    const current = openControllers().at(-1);
    if (e.key === 'Escape') {
      const hadDialog = Boolean(current) || hasVisibleDialog();
      if (!hadDialog) return;
      e.preventDefault();
      if (current) current.close({ blurRestoredFocus: true });
      // Esc is a dismissal action. After the modal finishes closing, make sure
      // the restored page element does not retain a focus ring. This runs after
      // project-specific Escape handlers as well, not just IgrotekaModal controllers.
      clearEscapeFocus();
      return;
    }
  }, true);



  // Igroteka themed alert/confirm dialogs. These replace native browser dialogs
  // while keeping the same async interaction style everywhere in the app.
  function ensureDialogStyles(){
    if(document.getElementById('igroteka-dialog-runtime-style')) return;
    const style=document.createElement('style');
    style.id='igroteka-dialog-runtime-style';
    style.textContent=`
      .igroteka-native-dialog-layer{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:22px;background:rgba(3,4,7,.62);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .18s ease,visibility 0s linear .18s}
      .igroteka-native-dialog-layer.open{opacity:1;visibility:visible;pointer-events:auto;transition:opacity .18s ease,visibility 0s linear 0s}
      .igroteka-native-dialog{width:min(520px,calc(100vw - 44px));border:1px solid #2a2331;border-radius:16px;background:linear-gradient(180deg,rgba(20,17,27,.985),rgba(11,10,16,.99));box-shadow:0 24px 70px rgba(0,0,0,.58),0 0 0 1px rgba(185,92,255,.05),0 0 42px rgba(145,80,220,.08);color:#f1edf5;font-family:"Inter",sans-serif;overflow:hidden;transform:translateY(8px) scale(.985);transition:transform .18s cubic-bezier(.22,.61,.36,1)}
      .igroteka-native-dialog-layer.open .igroteka-native-dialog{transform:translateY(0) scale(1)}
      .igroteka-native-dialog-head{display:flex;align-items:center;padding:15px 17px 13px;border-bottom:1px solid rgba(65,54,75,.75)}
      .igroteka-native-dialog-title{font-size:14px;font-weight:650;letter-spacing:.01em}
      .igroteka-native-dialog-body{padding:17px;color:#d5cddd;font-size:13px;line-height:1.52;white-space:pre-wrap;word-break:break-word}
      .igroteka-native-dialog-path{margin-top:10px;padding:10px 11px;border:1px solid rgba(65,54,75,.78);border-radius:10px;background:#0c0b10;color:#b9a9c4;font-size:11px;line-height:1.45;word-break:break-all}
      .igroteka-native-dialog-actions{display:flex;justify-content:flex-end;align-items:center;gap:8px;padding:0 17px 16px}
      .igroteka-native-dialog-btn{height:34px;border:1px solid #332b3c;background:#131018;color:#d9d1de;border-radius:10px;padding:0 13px;cursor:pointer;font:inherit;font-size:12px;line-height:1;transition:background-color .14s ease,border-color .14s ease,color .14s ease,transform .09s ease}
      .igroteka-native-dialog-btn:hover{transform:translateY(-1px);border-color:#4a3c56;background:#191420}
      .igroteka-native-dialog-btn.primary{border-color:#67427f;background:#241530;color:#f0e8f5}
      .igroteka-native-dialog-btn.primary:hover{border-color:#8a5ca8;background:#301a40}
      .igroteka-native-dialog-btn.success{border-color:#456957;background:#14231c;color:#dff5e8}
      .igroteka-native-dialog-btn.success:hover{border-color:#5b8c70;background:#183025}
      .igroteka-native-dialog-btn.danger{border-color:#6f3d4d;background:#24141a;color:#f3dbe2}
      .igroteka-native-dialog-btn.danger:hover{border-color:#98576a;background:#311821}
      .igroteka-native-dialog-btn.copy{margin-right:auto}
      html.igroteka-dialog-open,body.igroteka-dialog-open{overflow:hidden!important}
    `;
    document.head.appendChild(style);
  }

  function normalizeDialogText(value){ return String(value ?? ''); }
  function createDialog(options={}){
    ensureDialogStyles();
    const layer=document.createElement('div'); layer.className='igroteka-native-dialog-layer'; layer.setAttribute('role','presentation');
    const dialog=document.createElement('section'); dialog.className='igroteka-native-dialog'; dialog.setAttribute('role','dialog'); dialog.setAttribute('aria-modal','true');
    const head=document.createElement('div'); head.className='igroteka-native-dialog-head';
    const title=document.createElement('div'); title.className='igroteka-native-dialog-title'; title.textContent=options.title || 'Игротека';
    head.append(title);
    const body=document.createElement('div'); body.className='igroteka-native-dialog-body'; body.textContent=normalizeDialogText(options.message);
    const actions=document.createElement('div'); actions.className='igroteka-native-dialog-actions';
    if(options.copyText){
      const copy=document.createElement('button'); copy.type='button'; copy.className='igroteka-native-dialog-btn copy'; copy.textContent='Копировать путь';
      copy.addEventListener('click',async()=>{
        try{
          const text=String(options.copyText);
          let copied=false;
          if(window.igrotekaRuntime?.copyText){ copied=window.igrotekaRuntime.copyText(text)===true; }
          if(!copied && navigator.clipboard?.writeText){ await navigator.clipboard.writeText(text); copied=true; }
          if(!copied) throw new Error('clipboard write failed');
          copy.textContent='Скопировано';
          setTimeout(()=>{copy.textContent='Копировать путь'},1200);
        }catch{
          copy.textContent='Не удалось скопировать';
          setTimeout(()=>{copy.textContent='Копировать путь'},1400);
        }
      });
      actions.appendChild(copy);
    }
    const cancel=options.confirm ? document.createElement('button') : null;
    if(cancel){ cancel.type='button'; cancel.className='igroteka-native-dialog-btn'; cancel.textContent=options.cancelText||'Отмена'; actions.appendChild(cancel); }
    const ok=document.createElement('button'); ok.type='button'; ok.className=`igroteka-native-dialog-btn ${options.type==='danger'?'danger':options.type==='success'?'success':'primary'}`; ok.textContent=options.confirm ? (options.okText||'Подтвердить') : (options.okText||'OK'); actions.appendChild(ok);
    dialog.append(head,body,actions); layer.appendChild(dialog); document.body.appendChild(layer);
    document.documentElement.classList.add('igroteka-dialog-open'); document.body.classList.add('igroteka-dialog-open');
    let closed=false;
    const finish=(value)=>{ if(closed)return; closed=true; layer.classList.remove('open'); document.documentElement.classList.remove('igroteka-dialog-open'); document.body.classList.remove('igroteka-dialog-open'); setTimeout(()=>layer.remove(),190); resolvePromise(value); };
    let resolvePromise;
    const promise=new Promise(resolve=>{ resolvePromise=resolve; });
    const onKey=e=>{ if(e.key==='Escape'){ e.preventDefault(); finish(options.confirm?false:undefined); } else if(e.key==='Enter'){ e.preventDefault(); finish(true); } };
    const onBackdrop=e=>{ if(e.target===layer) finish(options.confirm?false:undefined); };
    layer.addEventListener('click',onBackdrop);
    layer.addEventListener('keydown',onKey,true);
    ok.addEventListener('click',()=>finish(true));
    cancel?.addEventListener('click',()=>finish(false));
    requestAnimationFrame(()=>{layer.classList.add('open');ok.focus({preventScroll:true});});
    return promise;
  }
  window.IgrotekaDialog={
    alert(message,options={}){ return createDialog({...options,confirm:false,message}); },
    confirm(message,options={}){ return createDialog({...options,confirm:true,message}); }
  };

  window.IgrotekaModal = { bind, get: id => controllers.get(id) || null };
})();
