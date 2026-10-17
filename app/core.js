const ratings=["Понравилось","Нормально","Не понравилось","Прохожу","Запланировано","Избранное"];
const selectableRatings=ratings.filter(v=>v!=="Избранное");
function migrateGameStatuses(arr){
  return arr.map(item=>{
    const copy={...item};
    if(!copy.rating) copy.rating="Запланировано";
    // «Избранное» — это переход из «Понравилось» по звезде.
    if(Boolean(copy.favorite) && copy.rating==="Понравилось") copy.rating="Избранное";
    else if(copy.rating!=="Избранное") copy.favorite=false;
    copy.favorite=copy.rating==="Избранное";
    delete copy.status;
    return copy;
  });
}
const ratingOrder={"Понравилось":1,"Нормально":2,"Не понравилось":3,"Прохожу":4,"Запланировано":5,"Избранное":6,"":99};
let games=[];
let statActiveCache=null;
let currentPage=1;
let quickFilter="";
const PAGE_SIZE=25;
let pageSize=PAGE_SIZE;

const db=window.igrotekaDatabase;
if(!db)throw new Error("Локальная база Игротеки недоступна.");

const $=id=>document.getElementById(id);
const search=$("search");
const sort=$("sort"),tbody=$("tbody");
const pagination=$("pagination"),tableWrap=$("tableWrap"),emptyResults=$("emptyResults");
const statValues={
  total:$("totalCount"),
  liked:$("liked"),
  normal:$("normalCount"),
  disliked:$("disliked"),
  inProgress:$("inProgress"),
  planned:$("planned"),
  favorite:$("favoriteCount")
};
const statCards=document.querySelectorAll(".stat-card");
let statValuesRenderCache={total:null,liked:null,normal:null,disliked:null,inProgress:null,planned:null,favorite:null};

function norm(s){
  return String(s??"").replace(/[\u00A0\u2007\u202F]/g," ")
    .replace(/[‘’`]/g,"'").replace(/\s+/g," ").trim().toLocaleLowerCase("ru");
}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
// Кэш нормализованных названий: поиск/фильтрация/дубликаты больше не
// нормализуют одно и то же название заново при каждом render().
const gameNameNormCache=new WeakMap();
function gameNorm(game){
  if(!game || typeof game!=="object")return norm(game?.game);
  const cached=gameNameNormCache.get(game);
  if(cached!==undefined)return cached;
  const value=norm(game.game);
  gameNameNormCache.set(game,value);
  return value;
}

let filteredCache=null;
let sortedRowsCache=null;
let persistedGamesJSON=null;
let persistedTrashJSON=null;
let persistedUIJSON=null;
let trashCache=null;
let searchQueryCache={raw:null,q:"",words:[]};
let gamesDirty=true;

// Новые записи получают следующий положительный SQLite ID до сохранения.
// Это сохраняет естественный порядок строк (старые записи → новые) и делает
// проверку round-trip строго детерминированной даже для только что добавленных игр.
function nextProvisionalGameId(offset=0){
  let maxId=0;
  for(const item of games){
    const id=Number(item?.id);
    if(Number.isInteger(id) && id>maxId)maxId=id;
  }
  return maxId+(1+offset);
}

function gamesPersistenceJSON(){
  return JSON.stringify(games.map(item=>({
    id:Number.isInteger(Number(item?.id))?Number(item.id):null,
    game:String(item?.game??"").trim(),
    rating:item?.rating||"Запланировано",
    favorite:Boolean(item?.favorite),
    last_modified:item?.last_modified??item?.lastModified??null,
    last_modified_reason:item?.last_modified_reason??item?.lastModifiedReason??null,
    extra_json:item?.extra_json??null
  })));
}

async function save(){
  try{
    if(!gamesDirty){
      return true;
    }
    const raw=gamesPersistenceJSON();
    if(raw!==persistedGamesJSON){
      const result=await db.replaceGamesConfirmed(raw);
      if(!result?.ok)throw new Error(result?.error||"SQLite не подтвердил сохранение.");
      persistedGamesJSON=raw;
      filteredCache=null;
      sortedRowsCache=null;
      gamesDirty=gamesPersistenceJSON()!==raw;
    } else {
      gamesDirty=gamesPersistenceJSON()!==persistedGamesJSON;
    }
    return true;
  }catch(e){
    console.error("Не удалось сохранить базу:",e);
    toastMsg("Не удалось сохранить изменения. Проверьте свободное место на диске","error");
    return false;
  }
}
function uiState(){return {search:search.value,sort:sort.value,quickFilter}}

let saveUITimer=null;
function saveUI(){
  try{
    const raw=JSON.stringify(uiState());
    if(raw===persistedUIJSON)return true;
    const result=db.replaceUISync(raw);
    if(!result?.ok || db.getUISync()!==raw)throw new Error("Проверка настроек интерфейса не пройдена.");
    persistedUIJSON=raw;
    return true;
  }catch(e){
    console.warn("Не удалось сохранить настройки интерфейса:",e);
    return false;
  }
}
function scheduleSaveUI(){
  clearTimeout(saveUITimer);
  saveUITimer=setTimeout(()=>{saveUI();saveUITimer=null},250);
}
function loadUI(){try{const raw=db.getUISync();pageSize=PAGE_SIZE;quickFilter="";if(!raw)return;const u=JSON.parse(raw)||{};search.value=u.search||"";sort.value=u.sort||"game-asc"}catch(e){pageSize=PAGE_SIZE;quickFilter="";console.warn("Не удалось восстановить настройки интерфейса:",e)}}

function positionToastStack(stack){
  if(!stack) return;
  const main=document.querySelector("main.wrap");
  const table=document.getElementById("tableWrap");
  if(!main) return;

  const gap=18;
  const edge=28;
  const maxWidth=320;
  const minRailWidth=180;
  const mainRect=main.getBoundingClientRect();
  const tableRect=table?.getBoundingClientRect?.() ?? null;
  const railAnchorRight=tableRect?.right ?? mainRect.right;
  const available=Math.floor(window.innerWidth-edge-(railAnchorRight+gap));
  const hasSideRail=available>=minRailWidth;

  stack.classList.toggle("toast-flow",!hasSideRail);
  stack.classList.toggle("toast-side-rail",hasSideRail);

  if(hasSideRail){
    const width=Math.min(maxWidth,available);
    const top=Math.max(48,Math.min(tableRect?.top ?? mainRect.top,window.innerHeight-120));
    stack.style.position="fixed";
    stack.style.left=`${Math.round(railAnchorRight+gap)}px`;
    stack.style.right="auto";
    stack.style.top=`${Math.round(top)}px`;
    stack.style.bottom="auto";
    stack.style.width=`${Math.round(width)}px`;
    stack.style.maxWidth=`${Math.round(width)}px`;
    if(stack.parentElement!==document.body) document.body.appendChild(stack);
  }else{
    stack.style.position="relative";
    stack.style.left="";
    stack.style.right="";
    stack.style.top="";
    stack.style.bottom="";
    stack.style.width="";
    stack.style.maxWidth="";
    if(table && stack.parentElement!==table.parentElement) table.parentElement.insertBefore(stack,table);
  }
}
function toastMsg(msg,type="success"){
  msg=String(msg??"").replace(/[.。]+$/g,"");
  if(type===true) type="warning";
  if(type===false||!type) type="success";
  if(!["success","info","warning","error"].includes(type)) type="success";
  let stack=document.getElementById("toastStack");
  if(!stack){
    stack=document.createElement("div");
    stack.id="toastStack";
    document.body.appendChild(stack);
  }
  positionToastStack(stack);

  const item=document.createElement("div");
  item.className=`toast-stack-item ${type}`;
  const icon=document.createElement("span");
  icon.className="toast-icon";
  icon.setAttribute("aria-hidden","true");
  icon.textContent={success:"✓",info:"i",warning:"!",error:"×"}[type];
  const text=document.createElement("span");
  text.className="toast-text";
  text.textContent=msg;
  item.append(icon,text);
  stack.appendChild(item);

  requestAnimationFrame(()=>item.classList.add("show"));

  setTimeout(()=>{
    item.classList.remove("show");
    setTimeout(()=>{item.remove();if(!stack.children.length)stack.remove();},220);
  },type==="error"?3600:2800);
}

window.addEventListener("resize",()=>{
  const stack=document.getElementById("toastStack");
  if(stack) positionToastStack(stack);
});
window.addEventListener("scroll",()=>{
  const stack=document.getElementById("toastStack");
  if(stack && stack.classList.contains("toast-side-rail")) positionToastStack(stack);
},{passive:true});

function openConfirmDialog({title,subtitle="",message="",confirmLabel="Подтвердить",cancelLabel="Отмена",danger=false}){
  const backdrop=$("confirmModal");
  const dialog=$("confirmDialog");
  if(!backdrop||!dialog)return Promise.resolve(false);
  $("confirmTitle").textContent=title;
  $("confirmSubtitle").textContent=subtitle;
  $("confirmMessage").textContent=message;
  const confirmButton=$("confirmAction");
  confirmButton.textContent=confirmLabel;
  confirmButton.classList.toggle("danger",Boolean(danger));
  const cancelButton=$("cancelConfirm");
  let settled=false;
  return new Promise(resolve=>{
    const finish=value=>{
      if(settled)return;
      settled=true;
      cleanup();
      window.IgrotekaModal?.get("igroteka-confirm")?.close();
      resolve(value);
    };
    const onConfirm=()=>finish(true);
    const onCancel=()=>finish(false);
    const onBackdrop=e=>{if(e.target===backdrop)finish(false)};
    const closeButton=$("closeConfirm");
    const observer=new MutationObserver(()=>{
      if(!backdrop.classList.contains("open")&&!backdrop.classList.contains("closing")&&!settled)finish(false);
    });
    const cleanup=()=>{
      confirmButton.removeEventListener("click",onConfirm);
      cancelButton.removeEventListener("click",onCancel);
      backdrop.removeEventListener("click",onBackdrop);
      closeButton?.removeEventListener("click",onCancel);
      observer.disconnect();
      backdrop._confirmFinish=null;
    };
    confirmButton.addEventListener("click",onConfirm);
    cancelButton.addEventListener("click",onCancel);
    backdrop.addEventListener("click",onBackdrop);
    closeButton?.addEventListener("click",onCancel);
    observer.observe(backdrop,{attributes:true,attributeFilter:["class"]});
    backdrop._confirmFinish=onCancel;
    window.IgrotekaModal?.get("igroteka-confirm")?.open();
  });
}
const addGameModalController = window.IgrotekaModal?.bind("add-game", document.getElementById("modal"), document.querySelector("#modal .modal"));
const trashModalController = window.IgrotekaModal?.bind("games-trash", document.getElementById("trashModal"), document.querySelector("#trashModal .modal"));
window.IgrotekaModal?.bind("igroteka-confirm", document.getElementById("confirmModal"), document.querySelector("#confirmModal .modal"));

function updateModalScrollLock(){
  const open=document.querySelector(".modal-backdrop.show,.modal-backdrop.open");
  document.documentElement.classList.toggle("modal-open",Boolean(open));
  document.body.classList.toggle("modal-open",Boolean(open));
}
const modalScrollObserver=new MutationObserver(updateModalScrollLock);
modalScrollObserver.observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:["class"]});
updateModalScrollLock();
const ratingOptionLabel={"Понравилось":"Понравилось","Нормально":"Нормально","Не понравилось":"Не понравилось","Прохожу":"Прохожу","Запланировано":"Запланировано","Избранное":"Избранное"};
const ratingOptionClass={"Понравилось":"rating-liked","Нормально":"rating-normal","Не понравилось":"rating-disliked","Прохожу":"rating-in-progress","Запланировано":"rating-planned","Избранное":"rating-favorite"};
const ratingOptionMap=new Map(selectableRatings.map(v=>[v,`<option class="${ratingOptionClass[v]||""}" value="${esc(v)}">${esc(ratingOptionLabel[v]||v)}</option>`]));
const ratingOptions=selectableRatings.map(v=>ratingOptionMap.get(v)).join("");
function ratingOptionList(){return ratingOptions;}
const ratingOptionCache=new Map();
for(const rating of ratings){
  const selected=rating;
  const options=selectableRatings.map(v=>{const label=ratingOptionLabel[v]||v;return `<option class="${ratingOptionClass[v]||""}" value="${esc(v)}"${v===selected?" selected":""}>${esc(label)}</option>`}).join("");
  ratingOptionCache.set(rating,selected==="Избранное"
    ? `<option class="rating-favorite" value="Избранное" selected hidden>Избранное</option>${options}`
    : options);
}
function selectOptions(values,current){
  if(values===ratings)return ratingOptionCache.get(current)||ratingOptionCache.get("Запланировано");
  return values.map(v=>`<option class="${ratingOptionClass[v]||""}" value="${esc(v)}"${v===current?" selected":""}>${esc(v)}</option>`).join("");
}
function clsForRating(v){
  return {"Понравилось":"rating-liked","Нормально":"rating-normal","Не понравилось":"rating-disliked","Прохожу":"rating-in-progress","Запланировано":"rating-planned","Избранное":"rating-favorite"}[v]||"";
}

let duplicateNameSet=new Set();

function duplicateGroups(){
  const groups=new Map();
  games.forEach((g,i)=>{
    const key=gameNorm(g);
    if(!key)return;
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(i);
  });
  return [...groups.entries()]
    .filter(([,indices])=>indices.length>1)
    .map(([name,indices])=>({name,indices}));
}

function refreshDuplicateSet(){
  duplicateNameSet=new Set(duplicateGroups().map(g=>g.name));
  filteredCache=null;
}

async function update(i,key,value){
  if(!games[i]||key!=="rating")return;
  const before={...games[i]};
  games[i].rating=value||"Запланировано";
  games[i].favorite=games[i].rating==="Избранное";
  gamesDirty=true;
  games[i].lastModifiedReason="Изменена оценка";
  games[i].lastModified=new Date().toISOString();
  if(!(await save())){
    games[i]=before;
    gamesDirty=true;
    filteredCache=null;
    render();
    return;
  }
  // Оценка не меняет имена игр, поэтому пересчёт набора дубликатов здесь не нужен.
  // Сбрасываем только кэш фильтрации: результат фильтра может зависеть от оценки.
  filteredCache=null;
  render();
}
