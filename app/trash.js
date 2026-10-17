if(search){
  search.addEventListener("input",()=>{
    currentPage=1;
    render();
    scheduleSaveUI();
  });
}
function readTrash(){
  if(trashCache!==null)return trashCache;
  try{
    const raw=db.getTrashSync();
    const arr=JSON.parse(raw);
    trashCache=Array.isArray(arr)?arr:[];
    persistedTrashJSON=raw||JSON.stringify(trashCache);
    return trashCache;
  }catch(e){
    trashCache=[];
    return trashCache;
  }
}
function applyDatabaseState(state){
  if(!state || typeof state!=='object')throw new Error('База данных вернула некорректное состояние.');
  const nextGames=JSON.parse(String(state.games??'[]'));
  const nextTrash=JSON.parse(String(state.trash??'[]'));
  if(!Array.isArray(nextGames)||!Array.isArray(nextTrash))throw new Error('База данных вернула некорректные данные.');
  games=migrateGameStatuses(nextGames.map(item=>({...item})));
  gamesDirty=false;
  persistedGamesJSON=String(state.games??'[]');
  trashCache=nextTrash;
  persistedTrashJSON=String(state.trash??'[]');
  filteredCache=null;sortedRowsCache=null;
}

let trashDeactivationTimer=null;
let trashActivationTimer=null;
let trashVisualState={count:null};
let trashIndicatorDeferred=false;
let trashIndicatorHydrating=true;
const TRASH_PHASE_MS=1040;
const TRASH_BUTTON_FADE_MS=980;

function clearTrashAnimationTimers(){
  if(trashDeactivationTimer){clearTimeout(trashDeactivationTimer);trashDeactivationTimer=null;}
  if(trashActivationTimer){clearTimeout(trashActivationTimer);trashActivationTimer=null;}
}
function resetTrashMotionClasses(btn){
  btn.classList.remove('trash-transition-in','trash-transition-out','trash-dot-enter','trash-dot-exit','trash-fade-out');
}
function closeBackdropAnimated(id,afterClose=null){
  const modal=$(id);if(!modal)return;
  clearTimeout(modal._closeTimer);
  modal.classList.remove('closing','show');
  if(typeof afterClose==='function')afterClose();
}
function finalizeTrashInactive(){
  const btn=$("trashData");if(!btn)return;
  clearTrashAnimationTimers();
  resetTrashMotionClasses(btn);
  btn.classList.remove('has-items');
  btn.disabled=true;
  btn.setAttribute('aria-label','Корзина пуста');
  trashVisualState.count=0;
}
function animateTrashDeactivation(){
  trashIndicatorDeferred=false;
  const btn=$("trashData");if(!btn)return;
  clearTrashAnimationTimers();
  btn.disabled=false;
  resetTrashMotionClasses(btn);
  btn.classList.add('has-items','trash-transition-out','trash-dot-exit');

  const startButtonFade=()=>{
    btn.classList.remove('trash-dot-exit');
    btn.classList.add('trash-fade-out');
    const onEnd=(e)=>{
      if(e.propertyName!=='opacity' && e.propertyName!=='background-color' && e.propertyName!=='border-color')return;
      btn.removeEventListener('transitionend',onEnd);
      finalizeTrashInactive();
    };
    btn.addEventListener('transitionend',onEnd);
    trashDeactivationTimer=setTimeout(()=>{
      btn.removeEventListener('transitionend',onEnd);
      finalizeTrashInactive();
    },TRASH_BUTTON_FADE_MS+180);
  };

  btn.addEventListener('animationend',function onDotEnd(e){
    if(e.animationName!=='trashDotAppearV849')return;
    btn.removeEventListener('animationend',onDotEnd);
    startButtonFade();
  },{once:false});
}
function animateTrashActivation(){
  const btn=$("trashData");if(!btn)return;
  clearTrashAnimationTimers();
  btn.disabled=false;
  resetTrashMotionClasses(btn);
  // Phase 1: smoothly enter the active button state with no dot yet.
  btn.classList.add('has-items','trash-transition-in');
  trashActivationTimer=setTimeout(()=>{
    btn.classList.remove('trash-transition-in');
    btn.classList.add('trash-dot-enter');
    trashActivationTimer=setTimeout(()=>{
      btn.classList.remove('trash-dot-enter');
      trashVisualState.count=readTrash().length;
    },TRASH_PHASE_MS);
  },TRASH_PHASE_MS);
}
function updateTrashIndicator(previousCount=trashVisualState.count){
  const btn=$("trashData");if(!btn)return;
  const count=readTrash().length;
  if(trashIndicatorHydrating){
    clearTrashAnimationTimers();
    resetTrashMotionClasses(btn);
    if(count===0){
      btn.classList.remove('has-items');
      btn.disabled=true;
      btn.setAttribute('aria-label','Корзина пуста');
        }else{
      btn.classList.add('has-items');
      btn.disabled=false;
      btn.setAttribute('aria-label',`Корзина: ${count} ${count===1?'игра':'игр'}`);
      btn.removeAttribute('title');
    }
    trashVisualState.count=count;
    return;
  }
  if(count===0){
    if(previousCount>0 && btn.classList.contains('has-items')){
      animateTrashDeactivation();
    }else if(!btn.classList.contains('trash-transition-out')){
      finalizeTrashInactive();
    }
  }else{
    const hadItems=btn.classList.contains('has-items');
    btn.disabled=false;
    btn.setAttribute('aria-label',`Корзина: ${count} ${count===1?'игра':'игр'}`);
    btn.removeAttribute('title');
    if(previousCount===0 || previousCount===null || !hadItems)animateTrashActivation();
    else btn.classList.add('has-items');
    trashVisualState.count=count;
  }
}
function renderTrash(){
  const box=$("trashList");if(!box)return;
  const arr=readTrash();
  if(!trashIndicatorDeferred) updateTrashIndicator();
  if(!arr.length){box.innerHTML='<div class="trash-empty">Корзина пуста.</div>';return}
  box.innerHTML=arr.map(item=>{
    const meta=item.favorite?"Избранное":(item.rating||"Запланировано");
    const id=Number(item.id);
    const metaClass=clsForRating(meta);
    return `<div class="trash-item"><div class="trash-info"><div class="trash-name">${esc(item.game||"Без названия")}</div><div class="trash-meta ${metaClass}">${esc(meta)}</div></div><div class="trash-actions"><button type="button" data-restore-trash="${Number.isInteger(id)?id:""}">Восстановить</button><button type="button" class="danger" data-delete-trash="${Number.isInteger(id)?id:""}">Удалить навсегда</button></div></div>`;
  }).join("");
}
$("trashData").onclick=openTrash;

$("trashList").addEventListener("click",e=>{
  const restore=e.target.closest("[data-restore-trash]");
  if(restore){
    e.preventDefault();
    restoreFromTrash(restore.dataset.restoreTrash);
    return;
  }
  const remove=e.target.closest("[data-delete-trash]");
  if(remove){
    e.preventDefault();
    permanentlyDeleteFromTrash(remove.dataset.deleteTrash);
  }
});
$("emptyTrash").onclick=emptyTrash;
$("closeTrash").onclick=closeTrash;
$("closeTrash2").onclick=closeTrash;

function openTrash(){
  renderTrash();
  trashModalController?.open();
}
function closeTrash(){
  trashModalController?.close();
}
function closeTrashAnimated(afterClose=null){ trashModalController?.close(); if(typeof afterClose==="function") setTimeout(afterClose,220); }
function findTrashItemById(id){
  const numericId=Number(id);
  return readTrash().find(item=>Number(item.id)===numericId)||null;
}

async function restoreFromTrash(id){
  const trashId=Number(id);
  const item=findTrashItemById(trashId);
  if(!item)return;
  try{
    const result=await db.restoreTrash(trashId);
    if(!result?.ok)throw new Error(result?.error||"Не удалось восстановить игру.");
    applyDatabaseState({games:result.games,trash:result.trash});
    refreshDuplicateSet();currentPage=1;render();renderTrash();
    if(readTrash().length===0)closeTrashAnimated(()=>animateTrashDeactivation());
    toastMsg(`«${item.game}» восстановлена`);
  }catch(e){
    console.error("Не удалось восстановить игру:",e);
    toastMsg(String(e?.message||"Не удалось восстановить игру"),"error");
  }
}

async function permanentlyDeleteFromTrash(id){
  const trashId=Number(id);
  const item=findTrashItemById(trashId);
  if(!item)return;
  if(!await openConfirmDialog({title:"Удалить игру навсегда?",subtitle:"Отменить это действие нельзя",message:`«${item.game}» будет окончательно удалена из корзины.`,confirmLabel:"Удалить навсегда",danger:true}))return;
  try{
    const result=await db.permanentlyDeleteTrash(trashId);
    if(!result?.ok)throw new Error(result?.error||"Не удалось удалить игру из корзины.");
    applyDatabaseState({games:result.games,trash:result.trash});
    renderTrash();
    if(readTrash().length===0)closeTrashAnimated(()=>animateTrashDeactivation());
    toastMsg(`«${item.game}» окончательно удалена`);
  }catch(e){
    console.error("Не удалось окончательно удалить игру:",e);
    toastMsg(String(e?.message||"Не удалось удалить игру из корзины"),"error");
  }
}

async function emptyTrash(){
  const arr=readTrash();if(!arr.length)return;
  if(!await openConfirmDialog({title:"Очистить корзину?",subtitle:"Все удалённые игры будут уничтожены",message:`Будет окончательно удалено игр: ${arr.length}. Восстановление после этого невозможно.`,confirmLabel:"Очистить корзину",danger:true}))return;
  try{
    const result=await db.emptyTrash();
    if(!result?.ok)throw new Error(result?.error||"Не удалось очистить корзину.");
    applyDatabaseState({games:result.games,trash:result.trash});
    renderTrash();
    closeTrashAnimated(()=>animateTrashDeactivation());
    toastMsg("Корзина очищена");
  }catch(e){
    console.error("Не удалось очистить корзину:",e);
    toastMsg(String(e?.message||"Не удалось очистить корзину"),"error");
  }
}

async function deleteGameAtIndex(i){
  if(!Number.isInteger(i)||!games[i])return false;
  const removed={...games[i]};
  const gameId=Number(removed.id);
  if(!Number.isInteger(gameId)||gameId<=0){
    toastMsg("Не удалось определить игру для удаления","error");
    return false;
  }
  try{
    const result=await db.moveGameToTrash(gameId);
    if(!result?.ok)throw new Error(result?.error||"Не удалось переместить игру в корзину.");
    applyDatabaseState({games:result.games,trash:result.trash});
    refreshDuplicateSet();currentPage=1;render();renderTrash();
    toastMsg(`«${removed.game}» удалена`);
    return true;
  }catch(e){
    console.error("Не удалось удалить игру:",e);
    toastMsg(String(e?.message||"Не удалось удалить игру. Игра не удалена"),"error");
    return false;
  }
}

document.addEventListener("click",async e=>{
  if(e.target.dataset.fav!==undefined){
    const i=+e.target.dataset.fav;
    if(games[i]){
      const next=!games[i].favorite;
      if(next && games[i].rating!=="Понравилось"){
        return;
      }else{
        const beforeFavorite=games[i].favorite;
        const beforeRating=games[i].rating;
        const beforeModified=games[i].lastModified;
        games[i].favorite=next;
        games[i].rating=next?"Избранное":"Понравилось";
        gamesDirty=true;
        games[i].lastModified=new Date().toISOString();
        games[i].lastModifiedReason=next?"Добавлено в избранное":"Убрано из избранного";
        if(!(await save())){games[i].favorite=beforeFavorite;games[i].rating=beforeRating;games[i].lastModified=beforeModified;gamesDirty=true;return;}
        render();
      }
    }
    return;
  }
});

$("add").onclick=openModal;
$("addGameRow").onclick=addEntryRow;
$("cancelAdd").onclick=closeModal;
$("closeAdd").onclick=closeModal;
$("saveAdd").onclick=addGame;
$("modal").addEventListener("click",e=>{
  if(e.target===$("modal"))closeModal();
});



