function hasResettableState(){
  return Boolean(search.value.trim()||quickFilter||sort.value!=="game-asc"||currentPage!==1);
}
function hasResetAnimation(){
  const button=$("reset");
  return Boolean(button&&(button.classList.contains("reset-press")||button.classList.contains("reset-fade-out")));
}
function updateResetButtonState(){
  const button=$("reset");
  if(!button)return;
  const enabled=hasResettableState()||resetAnimationRunning||hasResetAnimation();
  button.disabled=!enabled;
  button.setAttribute("aria-disabled",String(!enabled));
}
let resetAnimationRunning=false;
let resetAnimationTimer=null;
let resetPressSafetyTimer=null;
const RESET_BUTTON_FADE_MS=780;
function finishResetButtonAnimation(){
  const button=$("reset");
  if(resetAnimationTimer){window.clearTimeout(resetAnimationTimer);resetAnimationTimer=null;}
  if(resetPressSafetyTimer){window.clearTimeout(resetPressSafetyTimer);resetPressSafetyTimer=null;}
  if(!button){resetAnimationRunning=false;return;}
  button.classList.remove("reset-press","reset-fade-out");
  button.disabled=true;
  button.setAttribute("aria-disabled","true");
  resetAnimationRunning=false;
  updateResetButtonState();
}
function startResetButtonFade(){
  const button=$("reset");
  if(!button||!resetAnimationRunning||button.classList.contains("reset-fade-out"))return;
  if(resetPressSafetyTimer){window.clearTimeout(resetPressSafetyTimer);resetPressSafetyTimer=null;}
  if(resetAnimationTimer){window.clearTimeout(resetAnimationTimer);resetAnimationTimer=null;}
  // Kinoteka v1.1 Stable: transition from the fully active frame to the
  // exact disabled frame, then set disabled only when the fade has finished.
  button.classList.remove("reset-press","reset-fade-out");
  void button.offsetWidth;
  button.classList.add("reset-fade-out");
  if(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches){
    window.requestAnimationFrame(()=>finishResetButtonAnimation());
    return;
  }
  const onEnd=(event)=>{
    if(event.target!==button)return;
    if(event.propertyName!=="opacity"||event.elapsedTime<0.70)return;
    button.removeEventListener("transitionend",onEnd);
    finishResetButtonAnimation();
  };
  button.addEventListener("transitionend",onEnd);
  resetAnimationTimer=window.setTimeout(()=>{
    button.removeEventListener("transitionend",onEnd);
    if(resetAnimationRunning&&button.classList.contains("reset-fade-out"))finishResetButtonAnimation();
  },RESET_BUTTON_FADE_MS+180);
}
function playResetButtonAnimation(){
  const button=$("reset");
  if(!button||resetAnimationRunning||!hasResettableState())return false;
  resetAnimationRunning=true;
  button.disabled=false;
  button.setAttribute("aria-disabled","false");
  button.classList.remove("reset-press","reset-fade-out");
  void button.offsetWidth;
  button.classList.add("reset-press");
  if(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches){
    window.requestAnimationFrame(()=>startResetButtonFade());
  }else{
    // In case a WebView2 compositor does not dispatch animationend.
    resetPressSafetyTimer=window.setTimeout(()=>startResetButtonFade(),1100);
  }
  return true;
}
const resetButton=$("reset");
if(resetButton){
  resetButton.addEventListener("animationend",event=>{
    if(event.target===resetButton&&event.animationName==="resetFilterButtonV832")startResetButtonFade();
  });
  resetButton.onclick=()=>{
    if(resetAnimationRunning||!playResetButtonAnimation())return;
    search.value="";
    quickFilter="";
    sort.value="game-asc";
    currentPage=1;
    saveUI();
    render();
    // Keep the control enabled until its active-to-disabled fade completes.
    resetButton.disabled=false;
    resetButton.setAttribute("aria-disabled","false");
  };
}

document.addEventListener("keydown",e=>{if(e.ctrlKey&&!e.altKey&&!e.metaKey&&e.code==="KeyZ"){const resetButton=$("reset");if(resetButton&&!resetButton.disabled){e.preventDefault();e.stopPropagation();resetButton.click();}else{e.preventDefault();e.stopPropagation();}return;}if(e.key==="Escape"){if($("trashModal").classList.contains("show"))closeTrash();else if($("modal").classList.contains("show"))closeModal();else if(search.value){search.value="";currentPage=1;saveUI();render();search.focus();}if(!(e.target===search&&search.value)){const active=document.activeElement;if(active&&active!==document.body&&typeof active.blur==="function")active.blur();}requestAnimationFrame(()=>document.activeElement?.blur?.());return;}const target=e.target,editing=target&&(target.tagName==="INPUT"||target.tagName==="TEXTAREA"||target.tagName==="SELECT"||target.isContentEditable);if((e.code==="Slash"||e.key==="/")&&!editing&&!e.ctrlKey&&!e.altKey&&!e.metaKey){e.preventDefault();e.stopPropagation();search.focus();search.select();}});

async function load(){
  loadUI();
  updateResetButtonState();
  let restoredFromDb=null;
  try{
    const raw=db.getGamesSync();
    persistedGamesJSON=raw||"[]";
    const parsedGames=JSON.parse(raw||"[]");
    if(Array.isArray(parsedGames))restoredFromDb=migrateGameStatuses(parsedGames.map(x=>({...x})));
    const trashRaw=db.getTrashSync();
    try{const parsedTrash=JSON.parse(trashRaw||"[]");trashCache=Array.isArray(parsedTrash)?parsedTrash:[];persistedTrashJSON=trashRaw||"[]"}catch(e){trashCache=[];persistedTrashJSON="[]"}
    const uiRaw=db.getUISync();
    if(uiRaw!==null)persistedUIJSON=uiRaw;
  }catch(e){
    console.error("Не удалось прочитать локальную базу Игротеки:",e);
    toastMsg("Не удалось загрузить локальную базу Игротеки.","error");
  }
  games=restoredFromDb||[];
  gamesDirty=false;
  refreshDuplicateSet();
  currentPage=1;
  render();
}
load().then(()=>{
  trashIndicatorHydrating=false;
  updateTrashIndicator();
}).finally(async()=>{
  try{
    if(document.fonts?.load){
      await Promise.race([
        Promise.all([
          document.fonts.load('400 16px "Inter"'),
          document.fonts.load('500 16px "Inter"'),
          document.fonts.load('600 16px "Inter"'),
          document.fonts.load('700 16px "Inter"')
        ]),
        new Promise(resolve=>setTimeout(resolve,1200))
      ]);
    }
    if(document.fonts?.ready)await document.fonts.ready;
  }catch(e){console.warn("Font readiness check:",e);}
  requestAnimationFrame(() => {
    document.documentElement.classList.remove("app-loading");
    void window.igrotekaStartup?.markReady?.();
  });
});

/* Igroteka — interaction focus recovery */
(()=>{
  const editable='input:not([disabled]):not([readonly]),textarea:not([disabled]):not([readonly]),select:not([disabled]),[contenteditable="true"]';
  document.addEventListener('pointerdown',e=>{
    const el=e.target.closest?.(editable);
    if(!el)return;
    requestAnimationFrame(()=>{
      if(document.activeElement!==el && !el.disabled && !el.readOnly) el.focus({preventScroll:true});
    });
  },true);
})();
