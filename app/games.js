const ADD_ROW_DEFAULT_RATING="Запланировано";
let addRowUid=0;

function addRowTemplate(index){
  const uid=++addRowUid;
  const row=document.createElement("div");
  row.className="game-entry-row";
  row.dataset.rowUid=String(uid);
  row.innerHTML=`
    <div class="game-entry-main">
      <input class="game-entry-name" type="text" autocomplete="off" placeholder="Название игры" aria-label="Название игры ${index}">
      <div class="game-entry-rating-wrap"><select class="game-entry-rating" aria-label="Оценка игры ${index}">${ratingOptionList()}<option class="rating-favorite" value="Избранное" hidden>Избранное</option></select></div>
    </div>
    <label class="game-entry-favorite">
      <input class="game-entry-favorite-input" type="checkbox" aria-label="Добавить в избранное для игры ${index}">
      <span aria-hidden="true">${lucideSvg("star",{size:16})}</span>
    </label>
    ${index>1?`<button type="button" class="game-entry-remove" aria-label="Удалить строку">${lucideSvg('x',{size:16})}</button>`:''}
    <div class="game-entry-error" aria-live="polite"></div>`;
  const input=row.querySelector('.game-entry-name');
  const rating=row.querySelector('.game-entry-rating');
  rating.value=ADD_ROW_DEFAULT_RATING;
  input.addEventListener('input',()=>validateAddRows(false));
  rating.addEventListener('change',()=>{
    syncEntryRatingClass(rating);
    const favorite=row.querySelector('.game-entry-favorite-input');
    if(favorite){
      favorite.checked=rating.value==="Избранное";
      syncEntryFavoriteState(row);
    }
  });
  const remove=row.querySelector('.game-entry-remove');
  if(remove)remove.addEventListener('click',()=>{row.remove();renumberAddRows();validateAddRows(false);});
  const favorite=row.querySelector('.game-entry-favorite-input');
  if(favorite)favorite.addEventListener('change',()=>{
    if(favorite.checked){
      if(rating.value!=="Понравилось") { favorite.checked=false; return; }
      rating.value="Избранное";
    }else if(rating.value==="Избранное"){
      rating.value="Понравилось";
    }
    syncEntryRatingClass(rating);
    syncEntryFavoriteState(row);
  });
  syncEntryRatingClass(rating);
  syncEntryFavoriteState(row);
  return row;
}

function syncEntryRatingClass(select){
  select.classList.remove('rating-liked','rating-normal','rating-disliked','rating-in-progress','rating-planned','rating-favorite');
  const cls=clsForRating(select.value);
  if(cls)select.classList.add(cls);
  syncRatingMarker(select);
}

function syncRatingMarker(select){
  const wrap=select?.closest('.rating-center,.game-entry-rating-wrap');
  if(!wrap)return;
  wrap.classList.remove('rating-dot-liked','rating-dot-normal','rating-dot-disliked','rating-dot-in-progress','rating-dot-planned','rating-dot-favorite');
  const cls=clsForRating(select.value);
  if(cls)wrap.classList.add(`rating-dot-${cls.replace('rating-','')}`);
}


function syncEntryFavoriteState(row){
  const favorite=row?.querySelector('.game-entry-favorite-input');
  const rating=row?.querySelector('.game-entry-rating');
  if(!favorite||!rating)return;
  favorite.checked=rating.value==="Избранное";
  favorite.disabled=rating.value!=="Понравилось" && rating.value!=="Избранное";
  row.classList.toggle("is-favorite",favorite.checked);
}

function renumberAddRows(){
  const rows=[...document.querySelectorAll('#gameEntries .game-entry-row')];
  rows.forEach((row,i)=>{
    const n=i+1;
    const input=row.querySelector('.game-entry-name');
    const rating=row.querySelector('.game-entry-rating');
    const favorite=row.querySelector('.game-entry-favorite-input');
    if(input){input.setAttribute('aria-label',`Название игры ${n}`);}
    if(rating){rating.setAttribute('aria-label',`Оценка игры ${n}`);}
    if(favorite){favorite.setAttribute('aria-label',`Добавить в избранное для игры ${n}`);}
    const remove=row.querySelector('.game-entry-remove');
    if(remove)remove.setAttribute('aria-label',`Удалить строку ${n}`);
  });
}

function getAddRows(){
  return [...document.querySelectorAll('#gameEntries .game-entry-row')].map(row=>({
    row,
    name:row.querySelector('.game-entry-name')?.value.trim()||"",
    rating:row.querySelector('.game-entry-rating')?.value||ADD_ROW_DEFAULT_RATING,
    favorite:Boolean(row.querySelector('.game-entry-favorite-input')?.checked),
    error:row.querySelector('.game-entry-error')
  }));
}

function validateAddRows(showMessages=true){
  const rows=getAddRows();
  const existing=new Set(games.map(g=>gameNorm(g)).filter(Boolean));
  const seen=new Map();
  let valid=true;
  rows.forEach(item=>{
    const key=norm(item.name);
    if(item.error){item.error.textContent="";item.error.className="game-entry-error";}
    item.row.classList.remove('has-error');
    if(!item.name)return;
    let message="";
    if(existing.has(key))message="Эта игра уже есть в списке.";
    else if(seen.has(key))message="Эта игра уже указана выше.";
    if(message){
      valid=false;
      if(showMessages&&item.error){item.error.textContent=message;item.error.classList.add('show');item.row.classList.add('has-error');}
    }else{
      seen.set(key,true);
    }
  });
  const unnamed=rows.find(item=>!item.name);
  if(showMessages&&unnamed){
    valid=false;
    unnamed.row.classList.add('has-error');
    if(unnamed.error){unnamed.error.textContent="Введите название игры.";unnamed.error.classList.add('show');}
    unnamed.row.querySelector('.game-entry-name')?.focus();
  }
  const global=$('dupBox');
  if(global){global.textContent="";global.classList.remove('show');}
  return valid && rows.length>0;
}

function closeBackdropAnimated(id,afterClose=null){
  const modal=$(id);if(!modal)return;
  clearTimeout(modal._closeTimer);
  modal.classList.remove('closing','show');
  if(typeof afterClose==='function')afterClose();
}

function openModal(){
  const list=$("gameEntries");
  list.innerHTML="";
  list.appendChild(addRowTemplate(1));
  renumberAddRows();
  $("dupBox").className="dup-box";
  $("dupBox").textContent="";
  addGameModalController?.open(document.querySelector("#gameEntries .game-entry-name"));
}

function addEntryRow(){
  const list=$("gameEntries");
  const row=addRowTemplate(list.children.length+1);
  list.appendChild(row);
  renumberAddRows();
  row.querySelector('.game-entry-name')?.focus();
}

function closeModal(){
  addGameModalController?.close();
}

async function addGame(){
  const rows=getAddRows();
  if(!validateAddRows(true))return;
  const addedItems=rows.map((item,index)=>({
    id:nextProvisionalGameId(index),
    game:item.name,
    rating:item.favorite?"Избранное":item.rating,
    favorite:item.favorite,
    lastModified:new Date().toISOString(),
    lastModifiedReason:"Добавлена"
  }));
  games.push(...addedItems);
  gamesDirty=true;
  if(!(await save())){
    games.splice(games.length-addedItems.length,addedItems.length);
    gamesDirty=true;
    return;
  }
  refreshDuplicateSet();
  currentPage=1;
  closeModal();
  render();
  toastMsg(addedItems.length===1?`«${addedItems[0].game}» добавлена.`:`Добавлено игр: ${addedItems.length}.`);
}


function getSortedRows(){
  const sortKey=sort.value;
  if(sortedRowsCache && sortedRowsCache.games===games && sortedRowsCache.sort===sortKey)return sortedRowsCache.rows;
  const rows=games.map((g,i)=>({g,i,name:gameNorm(g)}));
  rows.sort((a,b)=>{
    if(sortKey==="rating")return (ratingOrder[a.g.rating]??90)-(ratingOrder[b.g.rating]??90)||a.name.localeCompare(b.name,"ru");
    return (sortKey==="game-desc"?-1:1)*a.name.localeCompare(b.name,"ru");
  });
  sortedRowsCache={games,sort:sortKey,rows};
  return rows;
}
function filtered(){
  const rawSearch=search.value;
  let q,searchWords;
  if(searchQueryCache.raw===rawSearch){
    q=searchQueryCache.q; searchWords=searchQueryCache.words;
  }else{
    q=norm(rawSearch);
    searchWords=q?q.split(/\s+/).filter(Boolean):[];
    searchQueryCache={raw:rawSearch,q,words:searchWords};
  }
  const key=`${q}\u0000${sort.value}\u0000${quickFilter}`;
  if(filteredCache && filteredCache.games===games && filteredCache.key===key){
    return filteredCache.rows;
  }
  const source=getSortedRows();
  const rows=[];
  for(const row of source){
    const g=row.g;
    const quickOk=!quickFilter || (quickFilter==="favorite" ? Boolean(g.favorite) : g.rating===quickFilter);
    const searchOk=!searchWords.length||searchWords.every(word=>row.name.includes(word));
    if(quickOk && searchOk)rows.push(row);
  }
  filteredCache={games,key,rows};
  return rows;
}
let tableRenderCacheKey="";
function renderPagination(totalPages){
  if(!pagination)return;
  if(totalPages<=1){
    pagination.innerHTML="";
    return;
  }
  pagination.innerHTML=`<button type="button" class="pageBtn pageFirst" data-page="1" ${currentPage===1?'disabled':''} aria-label="Первая страница" ><span class="pageIcon" aria-hidden="true">${lucideSvg('chevrons-left',{size:18})}</span></button><button type="button" class="pageBtn pagePrev" data-page="${currentPage-1}" ${currentPage===1?'disabled':''} aria-label="Предыдущая страница" ><span class="pageIcon" aria-hidden="true">${lucideSvg('chevron-left',{size:18})}</span></button><span class="pageIndicator"><span class="pageCurrent">${currentPage}</span><span class="pageSeparator">/</span><span class="pageTotal">${totalPages}</span></span><button type="button" class="pageBtn pageNext" data-page="${currentPage+1}" ${currentPage===totalPages?'disabled':''} aria-label="Следующая страница" ><span class="pageIcon" aria-hidden="true">${lucideSvg('chevron-right',{size:18})}</span></button><button type="button" class="pageBtn pageLast" data-page="${totalPages}" ${currentPage===totalPages?'disabled':''} aria-label="Последняя страница" ><span class="pageIcon" aria-hidden="true">${lucideSvg('chevrons-right',{size:18})}</span></button>`;
}

pagination.addEventListener("click",e=>{
  const btn=e.target.closest(".pageBtn:not([disabled])");
  if(!btn || !pagination.contains(btn))return;
  currentPage=Number(btn.dataset.page);
  render();
  const searchEl=document.getElementById('search');
  if(searchEl){
    // After pagination, align the search field to the top of the content area,
    // Keep the search field aligned below the fixed title bar after pagination.
    const topInset=Math.max(0,parseFloat(getComputedStyle(document.body).paddingTop)||0);
    const target=Math.max(0,window.scrollY+searchEl.getBoundingClientRect().top-topInset-6);
    window.scrollTo({top:target,behavior:'smooth'});
  }
});

function render(){
  const allRows=filtered();
  const filteredTotal=allRows.length;
  const totalPages=Math.max(1,Math.ceil(filteredTotal/pageSize));
  if(currentPage>totalPages)currentPage=totalPages;
  const pageRows=allRows.slice((currentPage-1)*pageSize,currentPage*pageSize);
  if(tableWrap) tableWrap.hidden=pageRows.length===0;
  if(emptyResults) emptyResults.hidden=pageRows.length!==0;

  const dupKeys=duplicateNameSet;
  let identityKey="",tableKey="";
  for(const {g,i,name} of pageRows){
    identityKey+=(identityKey?"\u0001":"")+`${i}|${name}`;
    tableKey+=(tableKey?"\u0001":"")+`${i}|${name}|${g.rating??""}|${g.favorite?1:0}`;
  }

  const rowClassName=(g,name)=>{
    const rowClasses=[];
    if(dupKeys.has(name))rowClasses.push("dup-row");
    if(g.rating==="Понравилось")rowClasses.push("rating-liked");
    else if(g.rating==="Нормально")rowClasses.push("rating-normal");
    else if(g.rating==="Не понравилось")rowClasses.push("rating-disliked");
    else if(g.rating==="Запланировано")rowClasses.push("rating-planned");
    else if(g.rating==="Прохожу")rowClasses.push("rating-in-progress");
    else if(g.rating==="Избранное")rowClasses.push("rating-favorite");
    if(g.favorite)rowClasses.push("favorite-row");
    return rowClasses.join(" ");
  };

  if(tableKey!==tableRenderCacheKey){
    const previousRows=[...tbody.querySelectorAll("tr")];
    const previousIdentity=previousRows.map(tr=>{
      const input=tr.querySelector(".game-name");
      return input?`${input.dataset.i}|${input.value}`:"";
    }).join("\u0001");

    if(pageRows.length && previousIdentity===identityKey && previousRows.length===pageRows.length){
      pageRows.forEach(({g,i,name},index)=>{
        const tr=previousRows[index];
        tr.className=rowClassName(g,name);
        const input=tr.querySelector(".game-name");
        if(input){
          input.value=g.game;
          input.removeAttribute("title");
        }
        const select=tr.querySelector(".rating-select");
        if(select){
          select.className=`rating-select ${clsForRating(g.rating)}`;
          select.value=g.rating||"";
          syncRatingMarker(select);
        }
        const fav=tr.querySelector(".favorite-btn");
        if(fav){
          fav.classList.toggle("on",Boolean(g.favorite));
          fav.disabled=!g.favorite && g.rating!=="Понравилось";
          fav.dataset.fav=String(i);
          fav.removeAttribute("title");
          fav.textContent=g.favorite?"★":"☆";
        }
      });
    }else{
      tbody.innerHTML="";
      if(!pageRows.length){
        tbody.innerHTML='<tr><td colspan="3" class="empty">Ничего не найдено</td></tr>';
      }else{
        const fragment=document.createDocumentFragment();
        for(const {g,i,name} of pageRows){
          const tr=document.createElement("tr");
          tr.className=rowClassName(g,name);
          tr.innerHTML=`
        <td class="title"><input class="game-name" data-i="${i}" data-k="game" value="${esc(g.game)}" readonly ></td>
        <td class="rating-cell"><div class="rating-center"><span class="rating-dot rating-dot-left" aria-hidden="true"></span><select class="rating-select ${clsForRating(g.rating)}" data-i="${i}" data-k="rating" aria-label="Оценка игры ${esc(g.game)}">${selectOptions(ratings,g.rating)}</select><span class="rating-dot rating-dot-right" aria-hidden="true"></span></div></td>
        <td><button type="button" class="favorite-btn ${g.favorite?"on":""}" data-fav="${i}" ${!g.favorite && g.rating!=="Понравилось"?"disabled":""} aria-label="${g.favorite?"Убрать из избранного":"Добавить в избранное"}">${g.favorite?"★":"☆"}</button></td>`;
          fragment.appendChild(tr);
        }
        tbody.appendChild(fragment);
        tbody.querySelectorAll(".rating-select").forEach(syncRatingMarker);
      }
    }
    tableRenderCacheKey=tableKey;
  }

  const currentSearch=norm(search.value);
  let statCounts=null;
  let statTotal=games.length;
  {
    const words=currentSearch?currentSearch.split(/\s+/).filter(Boolean):[];
    const counts={"Понравилось":0,"Нормально":0,"Не понравилось":0,"Прохожу":0,"Запланировано":0,"Избранное":0,favorite:0};
    statTotal=0;
    for(const g of games){
      const name=gameNorm(g);
      if(words.length && !words.every(word=>name.includes(word)))continue;
      const rating=String(g.rating??"").trim();
      if(Object.prototype.hasOwnProperty.call(counts,rating))counts[rating]++;
      if(Boolean(g.favorite))counts.favorite++;
      statTotal++;
    }
    statCounts=counts;
  }
  const nextStatValues={
    total:statTotal,
    liked:statCounts["Понравилось"],
    normal:statCounts["Нормально"],
    disliked:statCounts["Не понравилось"],
    inProgress:statCounts["Прохожу"],
    planned:statCounts["Запланировано"],
    favorite:statCounts.favorite
  };
  for(const key of Object.keys(nextStatValues)){
    const value=nextStatValues[key];
    if(statValuesRenderCache[key]!==value){
      statValues[key].textContent=value;
      statValuesRenderCache[key]=value;
    }
  }

  renderPagination(totalPages);
  if(typeof updateResetButtonState==="function")updateResetButtonState();
  const activeStatKey=quickFilter;
  if(activeStatKey!==statActiveCache){
    statCards.forEach(card=>{
      const target=card.dataset.filterAll ? "" : (card.dataset.filterFavorite ? "favorite" : (card.dataset.filterRating || ""));
      card.classList.toggle("active", activeStatKey===target);
    });
    statActiveCache=activeStatKey;
  }
  if(quickStats.classList.contains("stat-init")){
    requestAnimationFrame(()=>quickStats.classList.remove("stat-init"));
  }
}

function triggerRowShine(row){
  if(!row || !tbody.contains(row) || !tableWrap || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)return;
  tableWrap.querySelectorAll(".row-shine-layer").forEach(node=>node.remove());
  const rowRect=row.getBoundingClientRect();
  const wrapRect=tableWrap.getBoundingClientRect();
  const layer=document.createElement("div");
  layer.className="row-shine-js-layer";
  let shineColor="#d7ccdf";
  const ratingSelect=row.querySelector(".rating-select");
  if(ratingSelect){
    const computedColor=getComputedStyle(ratingSelect).color;
    if(computedColor)shineColor=computedColor;
  }else if(row.classList.contains("favorite-row")){
    shineColor=getComputedStyle(row).getPropertyValue("--favorite").trim() || "#FFC94D";
  }
  // CSS zoom scales getBoundingClientRect() values, but absolute-positioned
  // children still receive coordinates in the zoomed element's CSS pixels.
  // Convert viewport deltas back to CSS pixels so the shine layer stays
  // exactly inside the clicked row at 50%/other page zoom levels.
  const zoomRaw=getComputedStyle(document.body).zoom;
  const zoom=Number.parseFloat(zoomRaw)>0?Number.parseFloat(zoomRaw):1;
  const left=(rowRect.left-wrapRect.left+tableWrap.scrollLeft)/zoom;
  const top=(rowRect.top-wrapRect.top+tableWrap.scrollTop)/zoom;
  const width=rowRect.width/zoom;
  const height=rowRect.height/zoom;
  const match=shineColor.match(/rgba?\(([^)]+)\)/);
  const rgb=match ? match[1].split(',').slice(0,3).map(x=>x.trim()).join(',') : null;
  const shineGradient=rgb
    ? `linear-gradient(105deg,transparent 0%,transparent 31%,rgba(${rgb},0) 43%,rgba(${rgb},0.82) 50%,rgba(${rgb},0) 57%,transparent 69%,transparent 100%)`
    : `linear-gradient(105deg,transparent 0%,transparent 31%,${shineColor}00 43%,${shineColor}D1 50%,${shineColor}00 57%,transparent 69%,transparent 100%)`;
  // Keep the clipping layer fixed to the exact row bounds. Only the inner beam moves,
  // so the animated light can never paint outside the table row even with body zoom.
  const beam=document.createElement("div");
  beam.className="row-shine-js-beam";
  Object.assign(layer.style,{left:`${left}px`,top:`${top}px`,width:`${width}px`,height:`${height}px`,position:"absolute",pointerEvents:"none",zIndex:"10000",overflow:"hidden",clipPath:"inset(0)",background:"transparent",opacity:"0"});
  Object.assign(beam.style,{position:"absolute",left:"0",top:"0",width:"42%",height:"100%",pointerEvents:"none",background:shineGradient,transform:"translateX(-125%) skewX(-10deg)"});
  layer.appendChild(beam);
  tableWrap.appendChild(layer);
  const opacityAnimation=layer.animate(
    [{opacity:0},{opacity:.18,offset:.12},{opacity:1,offset:.5},{opacity:.45,offset:.78},{opacity:0}],
    {duration:1450,easing:"cubic-bezier(.22,.61,.36,1)",fill:"forwards"}
  );
  const beamAnimation=beam.animate(
    [{transform:"translateX(-125%) skewX(-10deg)"},{transform:"translateX(315%) skewX(-10deg)"}],
    {duration:1450,easing:"cubic-bezier(.22,.61,.36,1)",fill:"forwards"}
  );
  Promise.allSettled([opacityAnimation.finished,beamAnimation.finished]).finally(()=>{if(layer.isConnected)layer.remove()});
}

tbody.addEventListener("change",async e=>{
  const select=e.target.closest(".rating-select");
  if(!select || !tbody.contains(select))return;
  const index=Number(select.dataset.i);
  if(!Number.isInteger(index))return;
  syncEntryRatingClass(select);
  syncRatingMarker(select);
  await update(index,"rating",select.value);
});


tbody.addEventListener("mousedown",e=>{
  if(e.button!==0)return;
  const row=e.target.closest("tr");
  const nameInput=e.target.closest(".game-name");
  if(row && tbody.contains(row) && nameInput && tbody.contains(nameInput)){
    triggerRowShine(row);
    e.preventDefault();
    nameInput.blur();
    const selection=window.getSelection();
    if(selection)selection.removeAllRanges();
  }
});

function selectGameRow(row){
  tbody.querySelectorAll('tr[data-selected="1"]').forEach(r=>{if(r!==row)r.removeAttribute("data-selected")});
  if(row)row.dataset.selected="1";
}

async function copyGameNameFromRow(row){
  if(!row || !tbody.contains(row))return false;
  const nameInput=row.querySelector(".game-name");
  if(!nameInput)return false;
  const text=String(nameInput.value||"");
  try{
    if(typeof window.igrotekaRuntime?.copyText === "function") {
      const copied=window.igrotekaRuntime.copyText(text);
      if(copied!==true)throw new Error("native clipboard write failed");
    } else if(navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else {
      const helper=document.createElement("textarea");
      helper.value=text;helper.setAttribute("readonly","");
      helper.style.position="fixed";helper.style.opacity="0";helper.style.pointerEvents="none";
      document.body.appendChild(helper);helper.focus();helper.select();
      if(!document.execCommand("copy"))throw new Error("copy command failed");
      helper.remove();
    }
    nameInput.blur();
    const selection=window.getSelection();
    if(selection)selection.removeAllRanges();
    selectGameRow(row);
    toastMsg(`«${text}» скопировано.`,"info");
    return true;
  }catch(err){
    nameInput.blur();
    const selection=window.getSelection();
    if(selection)selection.removeAllRanges();
    console.warn("Не удалось скопировать название игры:",err);
    return false;
  }
}

tbody.addEventListener("click",async e=>{
  const row=e.target.closest("tr");
  if(!row || !tbody.contains(row))return;
  const nameInput=e.target.closest(".game-name");
  if(nameInput){
    e.preventDefault();
    e.stopPropagation();
    await copyGameNameFromRow(row);
    return;
  }
  if(e.target.closest("button,select,textarea,a"))return;
  e.preventDefault();
  e.stopPropagation();
  selectGameRow(row);
  await copyGameNameFromRow(row);
});

function animateContextDelete(row,index){
  if(!row || row.dataset.deleting === "1" || !tbody.contains(row) || !row.querySelector(".game-name"))return;
  row.dataset.deleting="1";
  const rows=[...tbody.querySelectorAll("tr")];
  const positions=new Map();
  for(const r of rows){
    if(r===row)continue;
    const key=r.querySelector(".game-name")?.value;
    if(key)positions.set(key,r.getBoundingClientRect().top);
  }

  row.classList.add("row-context-delete");
  const cells=[...row.children];
  const reduceMotion=window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const duration=reduceMotion?120:680;
  const animations=cells.map((cell)=>cell.animate(
    [
      {opacity:1,transform:"scaleY(1)",filter:"none"},
      {opacity:.82,transform:"scaleY(.985)",filter:"brightness(1.02)",offset:0.16},
      {opacity:0,transform:"scaleY(.12)",filter:"blur(.4px)"}
    ],
    {duration,easing:"cubic-bezier(.22,.61,.36,1)",fill:"both"}
  ));

  Promise.all(animations.map(a=>a.finished.catch(()=>null))).then(async()=>{
    if(!row.isConnected)return;
    const ok=typeof deleteGameAtIndex==="function" ? await deleteGameAtIndex(index) : false;
    if(!ok){
      animations.forEach(a=>a.cancel());
      row.classList.remove("row-context-delete");
      delete row.dataset.deleting;
      return;
    }
    requestAnimationFrame(()=>{
      const newRows=[...tbody.querySelectorAll("tr")];
      const flipAnimations=[];
      for(const r of newRows){
        const key=r.querySelector(".game-name")?.value;
        const before=key?positions.get(key):null;
        if(before==null)continue;
        const after=r.getBoundingClientRect().top;
        const delta=before-after;
        if(Math.abs(delta)<.5)continue;
        const anim=r.animate(
          [{transform:`translateY(${delta}px)`},{transform:"translateY(0)"}],
          {duration:560,easing:"cubic-bezier(.22,.61,.36,1)",fill:"both"}
        );
        flipAnimations.push(anim);
      }
      Promise.all(flipAnimations.map(a=>a.finished.catch(()=>null))).finally(()=>{
        newRows.forEach(r=>r.style.removeProperty("transform"));
      });
    });
  });
}

document.addEventListener("contextmenu",e=>{
  const row=e.target.closest("#tbody tr");
  if(!row || !tbody.contains(row) || !row.querySelector(".game-name"))return;
  e.preventDefault();
  e.stopPropagation();
  const active=document.activeElement;
  if(active && active instanceof HTMLElement && active.closest("#tbody tr"))active.blur();
  const selection=window.getSelection();
  if(selection)selection.removeAllRanges();
  const input=row.querySelector(".game-name");
  const index=Number(input?.dataset.i);
  if(Number.isInteger(index))animateContextDelete(row,index);
});


statCards.forEach(card=>{
  card.addEventListener("click",()=>{
    const r=card.dataset.filterRating;
    const f=card.dataset.filterFavorite;
    const all=card.dataset.filterAll;
    const target=all ? "" : (f ? "favorite" : r || "");

    if(f){
      quickFilter="favorite";
        }else if(all){
      quickFilter="";
        }else{
      quickFilter=target;
        }
    currentPage=1;
      saveUI();
    render();
  });
});




