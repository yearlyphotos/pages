"use strict";
/* Project Pages: weekly 12x12 scrapbook pages. Everything stays on this phone (IndexedDB). No network use. */

/* ---------- helpers ---------- */
const $=(s,r=document)=>r.querySelector(s);
function h(tag,attrs,...kids){const el=document.createElement(tag);for(const[k,v]of Object.entries(attrs||{})){if(v==null||v===false)continue;if(k==="class")el.className=v;else if(k==="style")el.style.cssText=v;else if(k.startsWith("on"))el.addEventListener(k.slice(2),v);else if(k==="value"||k==="checked")el[k]=v;else el.setAttribute(k,v===true?"":v)}for(const c of kids.flat()){if(c==null||c===false)continue;el.append(c.nodeType?c:document.createTextNode(String(c)))}return el}
const pad=n=>String(n).padStart(2,"0");
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function hashStr(s){let x=2166136261;for(const c of s){x^=c.charCodeAt(0);x=Math.imul(x,16777619)}return x>>>0}
function hexRgb(hx){const n=parseInt(hx.slice(1),16);return[n>>16&255,n>>8&255,n&255]}
function rgbHex(r,g,b){return"#"+[r,g,b].map(v=>pad(Math.round(clamp(v,0,255)).toString(16))).join("").toUpperCase()}
function rgbHsl(r,g,b){r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b);let hh=0,s=0;const l=(mx+mn)/2;if(mx!==mn){const d=mx-mn;s=l>.5?d/(2-mx-mn):d/(mx+mn);hh=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4;hh*=60}return[hh,s,l]}
function hslHex(hh,s,l){const k=n=>(n+hh/30)%12,a=s*Math.min(l,1-l),f=n=>l-a*Math.max(-1,Math.min(k(n)-3,9-k(n),1));return rgbHex(f(0)*255,f(8)*255,f(4)*255)}
let toastT;
function toast(msg,ms=2600,action){$(".toast")?.remove();const t=h("div",{class:"toast",role:"status"},h("span",{},msg),action?h("button",{onclick:()=>{t.remove();action.fn()}},action.label):null);document.body.append(t);clearTimeout(toastT);if(ms)toastT=setTimeout(()=>t.remove(),ms)}
function download(blob,name){const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),60000)}
const toBlob=(c,type,q)=>new Promise((res,rej)=>c.toBlob(b=>b?res(b):rej(new Error("Image could not be made")),type,q));
function confirmBox(title,text,okLabel,danger){return new Promise(res=>{const ov=h("div",{class:"overlay",role:"dialog","aria-modal":"true"},h("div",{class:"box"},h("h3",{},title),h("p",{},text),
  h("div",{class:"row",style:"justify-content:flex-end"},h("button",{class:"btn ghost",onclick:()=>{ov.remove();res(false)}},"Cancel"),h("button",{class:"btn",style:danger?"background:var(--danger);color:#fff":"",onclick:()=>{ov.remove();res(true)}},okLabel))));document.body.append(ov)})}
function progressBox(title){const bar=h("i",{style:"width:0%"}),txt=h("p",{},"Starting…");const ov=h("div",{class:"overlay"},h("div",{class:"box"},h("h3",{},title),h("div",{class:"prog"},bar),txt));document.body.append(ov);
  return{set(f,t){bar.style.width=Math.round(f*100)+"%";if(t)txt.textContent=t},close(){ov.remove()}}}

/* ---------- storage (IndexedDB, on this phone only) ---------- */
const DB=(()=>{let p;const open=()=>p||(p=new Promise((res,rej)=>{const r=indexedDB.open("project-pages",1);
  r.onupgradeneeded=()=>{for(const s of["weeks","photos","fonts","meta"])r.result.createObjectStore(s)};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}));
  async function run(store,mode,fn){const d=await open();return new Promise((res,rej)=>{const t=d.transaction(store,mode);const st=t.objectStore(store);let out;const r=fn(st);if(r)r.onsuccess=()=>{out=r.result};t.oncomplete=()=>res(out);t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error)})}
  return{get:(s,k)=>run(s,"readonly",st=>st.get(k)),put:(s,k,v)=>run(s,"readwrite",st=>st.put(v,k)),del:(s,k)=>run(s,"readwrite",st=>st.delete(k)),
    keys:s=>run(s,"readonly",st=>st.getAllKeys()),all:s=>run(s,"readonly",st=>st.getAll()),clear:s=>run(s,"readwrite",st=>st.clear())}})();

/* ---------- zip (no compression; our own backups and exports) ---------- */
const CRC_T=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crcUpd(c,u8){for(let i=0;i<u8.length;i++)c=(c>>>8)^CRC_T[(c^u8[i])&255];return c}
async function crcBlob(b){let c=0xFFFFFFFF;const CH=4<<20;for(let o=0;o<b.size;o+=CH)c=crcUpd(c,new Uint8Array(await b.slice(o,o+CH).arrayBuffer()));return(c^0xFFFFFFFF)>>>0}
const u16=v=>[v&255,v>>>8&255],u32=v=>[v&255,v>>>8&255,v>>>16&255,v>>>24&255];
async function makeZip(files,onStep){const parts=[],central=[];let off=0;const enc=new TextEncoder();const d=new Date();
  const tm=(d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1),dt=((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate();
  for(let i=0;i<files.length;i++){const f=files[i];const nm=enc.encode(f.name);const crc=f.crc??await crcBlob(f.blob);const sz=f.blob.size;
    const lh=new Uint8Array([...u32(0x04034b50),...u16(20),...u16(0x0800),...u16(0),...u16(tm),...u16(dt),...u32(crc),...u32(sz),...u32(sz),...u16(nm.length),...u16(0)]);
    parts.push(lh,nm,f.blob);
    central.push(new Uint8Array([...u32(0x02014b50),...u16(20),...u16(20),...u16(0x0800),...u16(0),...u16(tm),...u16(dt),...u32(crc),...u32(sz),...u32(sz),...u16(nm.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(off)]),nm);
    off+=lh.length+nm.length+sz;onStep&&onStep(i+1,files.length)}
  const cd=central.reduce((a,p)=>a+p.length,0);
  return new Blob([...parts,...central,new Uint8Array([...u32(0x06054b50),...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(cd),...u32(off),...u16(0)])],{type:"application/zip"})}
async function readZip(blob){const tl=Math.min(blob.size,65557);const tail=new Uint8Array(await blob.slice(blob.size-tl).arrayBuffer());let e=-1;
  for(let i=tail.length-22;i>=0;i--)if(tail[i]===0x50&&tail[i+1]===0x4b&&tail[i+2]===5&&tail[i+3]===6){e=i;break}
  if(e<0)throw new Error("not a zip");const dv=new DataView(tail.buffer);const n=dv.getUint16(e+10,true),cs=dv.getUint32(e+12,true),co=dv.getUint32(e+16,true);
  const cd=new DataView(await blob.slice(co,co+cs).arrayBuffer());const out=[];let p=0;const dec=new TextDecoder();
  for(let k=0;k<n;k++){if(cd.getUint32(p,true)!==0x02014b50)break;const en={method:cd.getUint16(p+10,true),csize:cd.getUint32(p+20,true),lo:cd.getUint32(p+42,true)};
    const nl=cd.getUint16(p+28,true),xl=cd.getUint16(p+30,true),cl=cd.getUint16(p+32,true);en.name=dec.decode(new Uint8Array(cd.buffer,p+46,nl));p+=46+nl+xl+cl;
    en.blob=async()=>{const lh=new DataView(await blob.slice(en.lo,en.lo+30).arrayBuffer());const st=en.lo+30+lh.getUint16(26,true)+lh.getUint16(28,true);const raw=blob.slice(st,st+en.csize);
      if(en.method===0)return raw;if(en.method===8)return new Response(raw.stream().pipeThrough(new DecompressionStream("deflate-raw"))).blob();throw new Error("unsupported zip")};
    out.push(en)}
  return out}

/* ---------- dates (ISO weeks, Monday to Sunday) ---------- */
const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
const MSHORT=["Jan","Feb","Mar","Apr","May","June","July","Aug","Sept","Oct","Nov","Dec"];
function isoWeekOf(date){const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));const dow=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-dow+3);const y=d.getUTCFullYear();return{y,w:Math.ceil(((d-Date.UTC(y,0,1))/864e5+1)/7)}}
function weekStart(y,w){const j4=new Date(Date.UTC(y,0,4));const dow=(j4.getUTCDay()+6)%7;const m=new Date(j4);m.setUTCDate(j4.getUTCDate()-dow+(w-1)*7);return m}
function weeksInYear(y){return isoWeekOf(new Date(y,11,28)).w}
function dateLabel(y,w,through){const a=weekStart(y,w),b=weekStart(y,through||w);b.setUTCDate(b.getUTCDate()+6);const am=a.getUTCMonth(),bm=b.getUTCMonth();
  return am===bm?`${a.getUTCDate()}–${b.getUTCDate()} ${MONTHS[bm]}`:`${a.getUTCDate()} ${MSHORT[am]} – ${b.getUTCDate()} ${MONTHS[bm]}`}
const keyOf=(y,w)=>`w${y}-${pad(w)}`;
const numLabel=wk=>wk.through?`${wk.week}&${wk.through}`:String(wk.week);
const pageName=(wk,i)=>`Week ${wk.through?pad(wk.week)+"&"+pad(wk.through):pad(wk.week)}${i?"."+(i+1):""}`;

/* ---------- layouts (12-unit grid) ---------- */
const RAW=[
 {id:"g9",name:"Classic 3×3",cells:[[0,0,4,4],[4,0,4,4],[8,0,4,4],[0,4,4,4],[4,4,4,4],[8,4,4,4],[0,8,4,4],[4,8,4,4],[8,8,4,4]],tile:[4,4]},
 {id:"t3",name:"Tall sides, 3 middle",cells:[[0,0,4,6],[0,6,4,6],[4,0,4,3],[4,3,4,6],[4,9,4,3],[8,0,4,6],[8,6,4,6]],tile:[4,0]},
 {id:"t4",name:"Tall sides, 4 middle",cells:[[0,0,4,6],[0,6,4,6],[4,0,4,3],[4,3,4,3],[4,6,4,3],[4,9,4,3],[8,0,4,6],[8,6,4,6]],tile:[4,3]},
 {id:"t3e",name:"Tall sides, 3 even",cells:[[0,0,4,6],[0,6,4,6],[4,0,4,4],[4,4,4,4],[4,8,4,4],[8,0,4,6],[8,6,4,6]],tile:[4,4]},
 {id:"p8",name:"Pockets",cells:[[0,0,6,4],[6,0,6,4],[0,4,3,4],[3,4,3,4],[6,4,3,4],[9,4,3,4],[0,8,6,4],[6,8,6,4]],tile:[3,4]},
 {id:"l6",name:"Six landscape",cells:[[0,0,6,4],[6,0,6,4],[0,4,6,4],[6,4,6,4],[0,8,6,4],[6,8,6,4]],tile:[6,4]},
 {id:"hero",name:"One big",cells:[[0,0,8,8],[8,0,4,4],[8,4,4,4],[0,8,4,4],[4,8,4,4],[8,8,4,4]],tile:[8,0]},
 {id:"pt8",name:"Eight portrait",cells:[[0,0,3,6],[3,0,3,6],[6,0,3,6],[9,0,3,6],[0,6,3,6],[3,6,3,6],[6,6,3,6],[9,6,3,6]],tile:[0,0]},
 {id:"pano",name:"Wide top",cells:[[0,0,12,6],[0,6,4,6],[4,6,4,6],[8,6,4,6]],tile:[4,6]},
 {id:"half",name:"Tall left",cells:[[0,0,6,12],[6,0,6,6],[6,6,3,6],[9,6,3,6]],tile:[9,6]},
 {id:"g4",name:"Four squares",cells:[[0,0,6,6],[6,0,6,6],[0,6,6,6],[6,6,6,6]],tile:[6,0]},
 {id:"g16",name:"Sixteen",cells:[0,1,2,3].flatMap(r=>[0,1,2,3].map(c=>[c*3,r*3,3,3])),tile:[3,3]},
 {id:"two",name:"Two tall",cells:[[0,0,6,12],[6,0,6,12]],tile:null},
 {id:"one",name:"Full page",cells:[[0,0,12,12]],tile:null},
];
const LAYOUT={};for(const L of RAW){L.cells.sort((a,b)=>a[1]-b[1]||a[0]-b[0]);L.tileIdx=L.tile?L.cells.findIndex(c=>c[0]===L.tile[0]&&c[1]===L.tile[1]):null;LAYOUT[L.id]=L}
const M=0.016,G=0.016;
function slotRects(id,mirror){const L=LAYOUT[id]||LAYOUT.g9;const A=M-G/2,S=1-2*M+G;return L.cells.map(([x,y,w,hh])=>{if(mirror)x=12-x-w;return{x:A+x/12*S+G/2,y:A+y/12*S+G/2,w:w/12*S-G,h:hh/12*S-G}})}
const PRESETS=["#F2A36B","#EA8FBF","#7FD4BE","#EDCB63","#8CC8F0","#E2726A","#A9C39A","#B9A3DE"];

/* ---------- state ---------- */
const now=isoWeekOf(new Date());
const S={view:"home",year:now.y,weeks:new Map(),cur:null,pageIdx:0,tab:"photos",sel:{tray:null,slot:null,mode:null,text:null},trayEdit:false,
  suggest:[],fonts:{mf:false,mfb:false,script:false},lastBackup:null,dirtySinceBackup:false,loaded:false,offlineReady:false};
function newPage(layout,withTile){const L=LAYOUT[layout];return{layout,mirror:false,slots:L.cells.map(()=>({p:null,fx:.5,fy:.5,z:1})),tile:withTile?L.tileIdx:null,texts:[]}}
function newWeek(y,w){return{year:y,week:w,through:null,color:PRESETS[(w-1)%PRESETS.length],dates:null,photos:[],pages:[newPage("g9",true)],thumb:null}}
const curWeek=()=>S.weeks.get(S.cur);
const curPage=()=>curWeek().pages[S.pageIdx];
const photoById=(wk,id)=>wk.photos.find(p=>p.id===id);

/* ---------- photos and images ---------- */
const urlCache=new Map(),imgCache=new Map(),imgReady=new Map();
async function thumbURL(id){const k="t:"+id;if(!urlCache.has(k)){const r=await DB.get("photos",id);urlCache.set(k,r?URL.createObjectURL(r.thumb||r.blob):"")}return urlCache.get(k)}
function loadImg(id){if(!imgCache.has(id)){imgCache.set(id,(async()=>{const r=await DB.get("photos",id);if(!r)throw new Error("missing photo");const url=URL.createObjectURL(r.blob);
  const im=new Image();im.decoding="async";im.src=url;await im.decode();imgReady.set(id,im);return im})())}return imgCache.get(id)}
async function ensureImages(pages){const ids=new Set();for(const p of pages)for(const s of p.slots)if(s.p)ids.add(s.p);await Promise.all([...ids].map(id=>loadImg(id).catch(()=>null)))}
async function scaleTo(bmp,max,q){const k=Math.min(1,max/Math.max(bmp.width,bmp.height));const c=document.createElement("canvas");c.width=Math.max(1,Math.round(bmp.width*k));c.height=Math.max(1,Math.round(bmp.height*k));
  c.getContext("2d").drawImage(bmp,0,0,c.width,c.height);const b=await toBlob(c,"image/jpeg",q);return{blob:b,w:c.width,h:c.height}}
async function addPhotos(files){const wk=curWeek();files=[...files];if(!files.length)return;
  try{if(navigator.storage?.persist&&!(await navigator.storage.persisted()))await navigator.storage.persist()}catch(e){}
  let done=0,failed=0;const tick=()=>toast(`Adding photos… ${done} of ${files.length}`,0);tick();
  for(const f of files){try{const bmp=await createImageBitmap(f,{imageOrientation:"from-image"});const big=await scaleTo(bmp,2600,.88);const sm=await scaleTo(bmp,360,.8);bmp.close?.();
      const id=uid();await DB.put("photos",id,{blob:big.blob,thumb:sm.blob,w:big.w,h:big.h,crc:await crcBlob(big.blob)});
      wk.photos.push({id,w:big.w,h:big.h});loadImg(id).then(()=>{refreshSuggest();drawStage()}).catch(()=>{})}
    catch(e){failed++;if(e&&e.name==="QuotaExceededError"){toast("Your phone has no room left for more photos.",5000);break}}
    done++;tick();if(S.tab==="photos")renderPanel()}
  scheduleSave(wk);toast(failed?`Added ${done-failed} photos. ${failed} couldn't be read.`:`Added ${done} photo${done===1?"":"s"}`)}
async function removePhoto(ph){const wk=curWeek();wk.photos=wk.photos.filter(p=>p.id!==ph.id);wk.pages.forEach(p=>p.slots.forEach(s=>{if(s.p===ph.id)s.p=null}));if(S.sel.tray===ph.id)S.sel.tray=null;
  await DB.del("photos",ph.id).catch(()=>{});for(const k of[ph.id,"t:"+ph.id]){const u=urlCache.get(k);if(u)URL.revokeObjectURL(u);urlCache.delete(k)}imgCache.delete(ph.id);imgReady.delete(ph.id);
  scheduleSave(wk);renderPanel();drawStage()}

/* ---------- your fonts (added once from the phone, kept in IndexedDB) ---------- */
const FONT_SLOTS={mf:{family:"MF",weight:"400",label:"Market Fresh (dates)"},mfb:{family:"MF",weight:"700",label:"Market Fresh Bold (week number)"},script:{family:"JSig",weight:"400",label:"Jonathan Signature (the word Week)"}};
function fontSlotFor(name){const n=name.split("/").pop().toLowerCase();if(!/\.(ttf|otf)$/.test(n))return null;if(n.includes("jonathan"))return"script";
  if(n.includes("market")&&!/caps|italic|inline/.test(n))return n.includes("bold")?"mfb":"mf";return null}
async function activateFont(slot,buf){const f=FONT_SLOTS[slot];const ff=new FontFace(f.family,buf,{weight:f.weight});await ff.load();document.fonts.add(ff);S.fonts[slot]=true}
async function loadSavedFonts(){for(const slot of Object.keys(FONT_SLOTS)){try{const b=await DB.get("fonts",slot);if(b)await activateFont(slot,await b.arrayBuffer())}catch(e){}}}
async function addFontFiles(files){let added=[];for(const f of files){try{
    if(/\.zip$/i.test(f.name)){for(const en of await readZip(f)){const slot=fontSlotFor(en.name);if(!slot)continue;const b=await en.blob();await activateFont(slot,await b.arrayBuffer());await DB.put("fonts",slot,new Blob([b],{type:"font/ttf"}));added.push(slot)}}
    else{const slot=fontSlotFor(f.name);if(!slot)continue;await activateFont(slot,await f.arrayBuffer());await DB.put("fonts",slot,f.slice(0,f.size,"font/ttf"));added.push(slot)}}catch(e){}}
  S.dirtySinceBackup=true;toast(added.length?`Added ${[...new Set(added)].length} font${new Set(added).size===1?"":"s"}`:"No matching font files found. Pick the zip files from dafont.",4000);render()}

/* ---------- drawing ---------- */
const F_NUM="MF, Fredoka, sans-serif",F_SCRIPT=`JSig, Sacramento, cursive`,F_HAND=`"Playwrite DE Grund", Sacramento, cursive`;
function brush(ctx,x,y,w,hh,col,seed){const rnd=mulberry(seed);const[r,g,b]=hexRgb(col);ctx.save();
  ctx.fillStyle=`rgba(${r},${g},${b},0.30)`;ctx.beginPath();ctx.moveTo(x+w*.03,y+hh*.2);ctx.lineTo(x+w*.97,y+hh*.24);ctx.lineTo(x+w*.95,y+hh*.82);ctx.lineTo(x+w*.02,y+hh*.78);ctx.closePath();ctx.fill();
  ctx.lineCap="round";
  for(let i=0;i<46;i++){const t=rnd();const yy=y+(0.06+0.88*t)*hh;const lw=hh*(0.035+rnd()*0.07);const edge=Math.abs(t-.5)*2;
    let xx=x+w*(rnd()*0.07+edge*0.05*rnd());const x1=x+w*(1-rnd()*0.09-edge*0.08*rnd());
    ctx.strokeStyle=`rgba(${r},${g},${b},${0.16+rnd()*0.34})`;ctx.lineWidth=lw;ctx.beginPath();
    while(xx<x1){const end=Math.min(x1,xx+w*(0.06+rnd()*0.4));const j=(rnd()-.5)*lw*.5;ctx.moveTo(xx,yy+j);ctx.lineTo(end,yy+j+(rnd()-.5)*lw*.3);xx=end+w*(rnd()<.7?0.006:0.03)*rnd()*2}
    ctx.stroke()}
  ctx.restore()}
function drawTile(ctx,X,Y,W,H,wk,color){
  ctx.save();ctx.beginPath();ctx.rect(X,Y,W,H);ctx.clip();ctx.fillStyle="#fff";ctx.fillRect(X,Y,W,H);
  const col=color||wk.color,label=numLabel(wk),date=wk.dates||dateLabel(wk.year,wk.week,wk.through);const u=Math.min(W,H*1.18);
  ctx.font=`700 100px ${F_NUM}`;const m=ctx.measureText(label);const capR=(m.actualBoundingBoxAscent||72)/100,wR=m.width/100;
  let fs=0.30*u/capR;if(wR*fs>0.86*W)fs=0.86*W/wR;const capH=capR*fs,numW=wR*fs;
  const ds=0.046*u;ctx.font=`400 ${ds}px ${F_NUM}`;const dW=ctx.measureText(date).width;
  const bandW=Math.min(W*.94,dW+0.10*u),bandH=0.074*u,gap=0.026*u;const top=Y+(H-(capH+gap+bandH))/2,cx=X+W/2;
  ctx.font=`700 ${fs}px ${F_NUM}`;ctx.fillStyle=col;ctx.textAlign="center";ctx.textBaseline="alphabetic";ctx.fillText(label,cx,top+capH);
  ctx.font=`100px ${F_SCRIPT}`;const sm=ctx.measureText("Week");const sAsc=(sm.actualBoundingBoxAscent||70)/100,sw=sm.width/100;
  let ss=0.6*capH/sAsc;if(sw*ss>numW*0.66)ss=numW*0.66/sw;ctx.font=`${ss}px ${F_SCRIPT}`;ctx.fillStyle="#141414";ctx.fillText("Week",cx+0.02*u,top+capH*0.84);
  const by=top+capH+gap;brush(ctx,cx-bandW/2,by,bandW,bandH,col,hashStr(keyOf(wk.year,wk.week)));
  ctx.font=`400 ${ds}px ${F_NUM}`;ctx.fillStyle="#141414";ctx.textBaseline="middle";ctx.fillText(date,cx,by+bandH*0.55);
  ctx.restore()}
function drawCover(ctx,im,X,Y,W,H,s){const sc=Math.max(W/im.naturalWidth,H/im.naturalHeight)*(s.z||1);const dw=im.naturalWidth*sc,dh=im.naturalHeight*sc;
  ctx.save();ctx.beginPath();ctx.rect(X,Y,W,H);ctx.clip();ctx.drawImage(im,X-(dw-W)*s.fx,Y-(dh-H)*s.fy,dw,dh);ctx.restore()}
const textFont=(t,px)=>t.font==="script"?`${px}px ${F_SCRIPT}`:t.font==="clean"?`400 ${px}px ${F_NUM}`:`300 ${px}px ${F_HAND}`;
function drawText(ctx,size,t){const px=t.s*size;ctx.save();ctx.translate(t.x*size,t.y*size);ctx.rotate((t.r||0)*Math.PI/180);
  ctx.font=textFont(t,px);ctx.textAlign="center";ctx.textBaseline="middle";const lines=(t.t||" ").split("\n");const lh=px*(t.font==="script"?1.05:1.3);
  const fg=t.color==="white"?"#FFFFFF":"#141414",bg=t.color==="white"?"#141414":"#FFFFFF";let mw=0;
  lines.forEach((ln,i)=>{const yy=(i-(lines.length-1)/2)*lh;mw=Math.max(mw,ctx.measureText(ln).width);
    if(t.outline){ctx.lineJoin="round";ctx.lineWidth=px*0.34;ctx.strokeStyle=bg;ctx.strokeText(ln,0,yy)}ctx.fillStyle=fg;ctx.fillText(ln,0,yy)});
  ctx.restore();return{hw:(mw/2+px*.25)/size,hh:(lines.length*lh/2+px*.2)/size}}
const textBoxes=new Map();
function drawPage(ctx,size,wk,pg,o={}){ctx.save();ctx.fillStyle="#fff";ctx.fillRect(0,0,size,size);const R=slotRects(pg.layout,pg.mirror);
  R.forEach((r,i)=>{const X=r.x*size,Y=r.y*size,W=r.w*size,H=r.h*size;
    if(pg.tile===i){drawTile(ctx,X,Y,W,H,wk);if(o.preview){ctx.strokeStyle="rgba(0,0,0,.08)";ctx.lineWidth=1;ctx.strokeRect(X+.5,Y+.5,W-1,H-1)}return}
    const s=pg.slots[i];const im=s&&s.p&&imgReady.get(s.p);
    if(im)drawCover(ctx,im,X,Y,W,H,s);
    else if(o.preview){ctx.fillStyle=s&&s.p?"#E9E6E2":"#F1EFEC";ctx.fillRect(X,Y,W,H);ctx.fillStyle="#B9B2AA";ctx.font=`${Math.max(14,size*.04)}px system-ui, sans-serif`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(s&&s.p?"…":"+",X+W/2,Y+H/2)}});
  for(const t of pg.texts||[]){const b=drawText(ctx,size,t);if(o.preview)textBoxes.set(t.id,b)}
  if(o.preview){const sel=S.sel;
    if(sel.slot!=null&&R[sel.slot]){const r=R[sel.slot];ctx.strokeStyle=sel.mode==="adjust"?"#FFFFFF":wk.color;ctx.lineWidth=Math.max(3,size*.009);ctx.setLineDash(sel.mode==="adjust"?[size*.015,size*.01]:[]);ctx.strokeRect(r.x*size+1.5,r.y*size+1.5,r.w*size-3,r.h*size-3);ctx.setLineDash([])}
    if(sel.text){const t=(pg.texts||[]).find(t=>t.id===sel.text);const b=t&&textBoxes.get(t.id);if(b){ctx.save();ctx.translate(t.x*size,t.y*size);ctx.rotate((t.r||0)*Math.PI/180);ctx.strokeStyle=wk.color;ctx.lineWidth=2;ctx.setLineDash([6,4]);ctx.strokeRect(-b.hw*size,-b.hh*size,b.hw*2*size,b.hh*2*size);ctx.restore()}}}
  ctx.restore()}

/* ---------- colour suggestions from photos ---------- */
function suggestColors(wk){const pg=curPage();let ids=pg.slots.map(s=>s.p).filter(Boolean);if(!ids.length)ids=wk.photos.map(p=>p.id);
  const px=[];const c=document.createElement("canvas");c.width=c.height=24;const x=c.getContext("2d",{willReadFrequently:true});
  for(const id of ids.slice(0,12)){const im=imgReady.get(id);if(!im)continue;x.drawImage(im,0,0,24,24);const d=x.getImageData(0,0,24,24).data;for(let i=0;i<d.length;i+=4)px.push([d[i],d[i+1],d[i+2]])}
  if(px.length<20)return[];const rnd=mulberry(7);let cs=Array.from({length:7},()=>px[Math.floor(rnd()*px.length)].slice());let cnt=[];
  for(let it=0;it<8;it++){const sum=cs.map(()=>[0,0,0]);cnt=cs.map(()=>0);
    for(const p of px){let bi=0,bd=1e9;cs.forEach((q,j)=>{const dd=(p[0]-q[0])**2+(p[1]-q[1])**2+(p[2]-q[2])**2;if(dd<bd){bd=dd;bi=j}});sum[bi][0]+=p[0];sum[bi][1]+=p[1];sum[bi][2]+=p[2];cnt[bi]++}
    cs=cs.map((q,j)=>cnt[j]?sum[j].map(v=>v/cnt[j]):q)}
  const out=[];cs.map((q,j)=>({hsl:rgbHsl(...q),n:cnt[j]})).filter(o=>o.hsl[1]>0.14&&o.hsl[2]>0.12&&o.hsl[2]<0.95).sort((a,b)=>b.n*(0.4+b.hsl[1])-a.n*(0.4+a.hsl[1]))
    .forEach(o=>{const[hh,s]=o.hsl;if(out.some(e=>Math.min(Math.abs(e.h-hh),360-Math.abs(e.h-hh))<20))return;out.push({h:hh,hex:hslHex(hh,clamp(s*1.05,.42,.72),clamp(o.hsl[2],.62,.72))})});
  return out.slice(0,5).map(o=>o.hex)}

/* ---------- saving to the phone ---------- */
const saveT=new Map();
function setStatus(t){const el=$("#status");if(el)el.textContent=t}
function scheduleSave(wk,quick){const k=keyOf(wk.year,wk.week);S.dirtySinceBackup=true;clearTimeout(saveT.get(k));
  saveT.set(k,setTimeout(async()=>{saveT.delete(k);await makeThumb(wk);try{await DB.put("weeks",k,wk);await DB.put("meta","dirty",true);setStatus("Saved on this phone")}catch(e){setStatus("Not saved");toast("Couldn't save. Your phone may be out of space.",5000)}},quick?50:700))}
async function flushSaves(){const ks=[...saveT.keys()];for(const k of ks){clearTimeout(saveT.get(k));saveT.delete(k);const wk=S.weeks.get(k);if(wk){await makeThumb(wk);await DB.put("weeks",k,wk)}}}
async function makeThumb(wk){const pg=wk.pages[0];try{await ensureImages([pg]);const c=document.createElement("canvas");c.width=c.height=360;drawPage(c.getContext("2d"),360,wk,pg);wk.thumb=c.toDataURL("image/jpeg",.78)}catch(e){}}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")flushSaves()});

/* ---------- backup: Save project / Load project ---------- */
async function saveProject(){await flushSaves();const pb=progressBox("Saving your project");
  try{const weeks=await DB.all("weeks"),keys=await DB.keys("photos");const files=[],photos=[];
    for(let i=0;i<keys.length;i++){const r=await DB.get("photos",keys[i]);if(!r)continue;files.push({name:`photos/${keys[i]}.jpg`,blob:r.blob,crc:r.crc});if(r.thumb)files.push({name:`photos/${keys[i]}_thumb.jpg`,blob:r.thumb});photos.push({id:keys[i],w:r.w,h:r.h,crc:r.crc});pb.set(i/keys.length*.5,`Collecting photos (${i+1} of ${keys.length})`)}
    for(const slot of Object.keys(FONT_SLOTS)){const b=await DB.get("fonts",slot);if(b)files.push({name:`fonts/${slot}.ttf`,blob:b})}
    const proj={app:"Project Pages",version:1,savedAt:new Date().toISOString(),weeks,photos};
    files.unshift({name:"project.json",blob:new Blob([JSON.stringify(proj)],{type:"application/json"})});
    const zip=await makeZip(files,(i,n)=>pb.set(.5+i/n*.5,"Packing the backup…"));pb.close();
    const d=new Date();download(zip,`Project Pages backup ${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}.zip`);
    S.lastBackup=Date.now();S.dirtySinceBackup=false;await DB.put("meta","lastBackup",S.lastBackup);await DB.put("meta","dirty",false);
    toast(`Backup saved to Downloads (${(zip.size/1048576).toFixed(0)} MB)`,4000);if(S.view==="home")render()}
  catch(e){console.error(e);pb.close();toast("Couldn't make the backup. Check that your phone has free space.",5000)}}
async function loadProject(file){let entries;try{entries=await readZip(file)}catch(e){return toast("That file isn't a Project Pages backup.",4000)}
  const pj=entries.find(e=>e.name==="project.json");if(!pj)return toast("That file isn't a Project Pages backup.",4000);
  let proj;try{proj=JSON.parse(await (await pj.blob()).text())}catch(e){return toast("The backup file is damaged.",4000)}
  const when=proj.savedAt?new Date(proj.savedAt).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"}):"an earlier date";
  const ok=await confirmBox("Replace everything?",`This replaces all pages and photos in the app with the backup from ${when} (${proj.weeks.length} weeks, ${proj.photos.length} photos).`,"Replace",true);if(!ok)return;
  const pb=progressBox("Loading your project");
  try{const byName=new Map(entries.map(e=>[e.name,e]));const metaById=new Map(proj.photos.map(p=>[p.id,p]));
    await DB.clear("weeks");await DB.clear("photos");await DB.clear("fonts");
    let i=0;for(const p of proj.photos){const e=byName.get(`photos/${p.id}.jpg`);if(e){const b=new Blob([await e.blob()],{type:"image/jpeg"});const te=byName.get(`photos/${p.id}_thumb.jpg`);const t=te?new Blob([await te.blob()],{type:"image/jpeg"}):null;
        await DB.put("photos",p.id,{blob:b,thumb:t,w:p.w,h:p.h,crc:p.crc})}pb.set(++i/proj.photos.length*.9,`Restoring photos (${i} of ${proj.photos.length})`)}
    for(const w of proj.weeks)await DB.put("weeks",keyOf(w.year,w.week),w);
    for(const slot of Object.keys(FONT_SLOTS)){const e=byName.get(`fonts/${slot}.ttf`);if(e){const b=new Blob([await e.blob()],{type:"font/ttf"});await DB.put("fonts",slot,b);try{await activateFont(slot,await b.arrayBuffer())}catch(x){}}}
    pb.close();for(const u of urlCache.values())u&&URL.revokeObjectURL(u);urlCache.clear();imgCache.clear();imgReady.clear();
    S.weeks=new Map((await DB.all("weeks")).map(w=>[keyOf(w.year,w.week),w]));S.dirtySinceBackup=false;await DB.put("meta","dirty",false);S.view="home";render();toast("Project loaded",3000)}
  catch(e){pb.close();toast("Loading stopped partway. Try loading the backup again.",5000)}}

/* ---------- export images ---------- */
async function renderFull(wk,i,size=3600){await document.fonts.ready;await ensureImages([wk.pages[i]]);const c=document.createElement("canvas");c.width=c.height=size;drawPage(c.getContext("2d"),size,wk,wk.pages[i]);
  const b=await toBlob(c,"image/jpeg",.92);c.width=c.height=1;return b}
async function exportOne(wk,i){toast("Making the print file…",0);try{const b=await renderFull(wk,i);download(b,`${wk.year} ${pageName(wk,i)}.jpg`);toast("Saved to Downloads")}catch(e){toast("Couldn't make the image. Try again.",4000)}}
async function exportTile(wk){await document.fonts.ready;const c=document.createElement("canvas");c.width=c.height=1800;drawTile(c.getContext("2d"),0,0,1800,1800,wk);
  try{download(await toBlob(c,"image/png"),`${wk.year} ${pageName(wk,0)} tile.png`);toast("Week tile saved to Downloads")}catch(e){toast("Couldn't make the image. Try again.",4000)}}
async function exportRange(a,b){if(a>b)[a,b]=[b,a];await flushSaves();const list=[...S.weeks.values()].filter(w=>w.year===S.year&&w.week>=a&&w.week<=b).sort((x,y)=>x.week-y.week);
  const jobs=list.flatMap(wk=>wk.pages.map((_,i)=>({wk,i})).filter(j=>{const p=j.wk.pages[j.i];return p.slots.some(s=>s.p)||(p.texts||[]).length}));
  if(!jobs.length)return toast("No finished pages in those weeks yet.");const pb=progressBox("Exporting pages");
  try{const files=[];for(let n=0;n<jobs.length;n++){const j=jobs[n];pb.set(n/jobs.length*.9,`${pageName(j.wk,j.i)} (${n+1} of ${jobs.length})`);files.push({name:`${j.wk.year} ${pageName(j.wk,j.i)}.jpg`,blob:await renderFull(j.wk,j.i)})}
    pb.set(.95,"Packing the zip…");const zip=await makeZip(files);pb.close();download(zip,`${S.year} pages, weeks ${a}-${b}.zip`);toast(`Saved ${jobs.length} pages to Downloads`,3500)}
  catch(e){pb.close();toast("Export stopped. Try fewer weeks at a time.",5000)}}

/* ---------- home ---------- */
const app=$("#app");
function render(){app.innerHTML="";if(S.view==="home")renderHome();else renderEditor()}
function tileThumb(wk,colr){const c=h("canvas",{width:220,height:220,"aria-hidden":"true"});const x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,220,220);drawTile(x,0,0,220,220,wk,colr);return c}
function ago(t){if(!t)return"never";const d=Math.floor((Date.now()-t)/864e5);return d<1?"today":d===1?"yesterday":`${d} days ago`}
function renderHome(){const y=S.year,n=weeksInYear(y);document.documentElement.style.setProperty("--week","#E2726A");
  app.append(h("header",{class:"top"},h("div",{class:"grow"},h("h1",{},`${y}`),h("div",{class:"sub"},"Your weekly pages")),
    h("button",{class:"iconbtn","aria-label":"Previous year",onclick:()=>{S.year--;render()}},"‹"),h("button",{class:"iconbtn","aria-label":"Next year",onclick:()=>{S.year++;render()}},"›")));
  const home=h("main",{class:"home"});app.append(home);
  if(!S.loaded)home.append(h("div",{class:"banner"},"Opening your pages…"));
  const missing=Object.keys(FONT_SLOTS).filter(k=>!S.fonts[k]);
  if(S.loaded&&missing.length)home.append(h("div",{class:"banner warn"},"Add your Market Fresh and Jonathan Signature fonts so the week tiles look like yours. ",h("a",{href:"#fonts",style:"color:inherit;font-weight:600"},"Add fonts")));
  const needBackup=S.loaded&&S.weeks.size&&S.dirtySinceBackup&&(!S.lastBackup||Date.now()-S.lastBackup>7*864e5);
  if(needBackup)home.append(h("div",{class:"banner warn"},`Last backup: ${ago(S.lastBackup)}. `,h("a",{href:"#backup",style:"color:inherit;font-weight:600"},"Back up now")));
  if(y===now.y)home.append(h("button",{class:"btn wide",style:"margin-bottom:6px",onclick:()=>openWeek(now.y,now.w)},`Open this week (week ${now.w})`));
  const g=h("div",{class:"grid"});home.append(g);let lastM=-1;
  for(let w=1;w<=n;w++){const prev=S.weeks.get(keyOf(y,w-1));if(prev&&prev.through===w)continue;
    const m=weekStart(y,w);m.setUTCDate(m.getUTCDate()+3);const mo=m.getUTCMonth();if(mo!==lastM){g.append(h("div",{class:"month"},MONTHS[mo]));lastM=mo}
    const wk=S.weeks.get(keyOf(y,w));const has=wk&&wk.pages.some(p=>p.slots.some(s=>s.p));const th=h("span",{class:"thumb"});
    if(wk&&wk.thumb)th.append(h("img",{src:wk.thumb,alt:""}));else th.append(tileThumb(wk||newWeek(y,w),wk?null:"#CFC9C2"));
    g.append(h("button",{class:"cell"+(has?"":" empty")+(y===now.y&&w===now.w?" now":""),onclick:()=>openWeek(y,w),"aria-label":`Week ${wk?numLabel(wk):w}`},th,
      h("span",{class:"lab"},h("b",{},`Week ${wk?numLabel(wk):w}`),wk&&wk.pages.length>1?` · ${wk.pages.length}`:"")))}
  // export
  const from=h("select",{id:"exFrom","aria-label":"From week"}),to=h("select",{id:"exTo","aria-label":"To week"});
  for(let w=1;w<=n;w++){from.append(h("option",{value:w},`Week ${w}`));to.append(h("option",{value:w},`Week ${w}`))}from.value=1;to.value=n;
  home.append(h("section",{class:"card"},h("h2",{},"Print files"),h("p",{},`Each page is a 12 × 12 inch image at 300 dpi (3600 × 3600 pixels), named in album order, like “${y} Week 16.jpg” and “${y} Week 16.2.jpg”.`),
    h("div",{class:"row"},from,h("span",{class:"hint",style:"margin:0"},"to"),to),h("button",{class:"btn wide",style:"margin-top:10px",onclick:()=>exportRange(+from.value,+to.value)},"Download pages as zip")));
  // backup
  const ld=h("input",{type:"file",accept:".zip,application/zip",hidden:true,id:"loadIn",onchange:e=>{const f=e.target.files[0];e.target.value="";if(f)loadProject(f)}});
  home.append(h("section",{class:"card",id:"backup"},h("h2",{},"Backup"),
    h("p",{},`Your pages and photos live only in this app on this phone. Save a backup now and then, and keep it somewhere safe, such as Google Drive. Last backup: ${ago(S.lastBackup)}.`),
    h("div",{class:"stack"},h("button",{class:"btn wide",onclick:saveProject},"Save project"),h("button",{class:"btn ghost wide",onclick:()=>ld.click()},"Load project")),ld));
  // fonts
  const fi=h("input",{type:"file",accept:".zip,.ttf,.otf",multiple:true,hidden:true,id:"fontIn",onchange:e=>{const fs=[...e.target.files];e.target.value="";addFontFiles(fs)}});
  home.append(h("section",{class:"card",id:"fonts"},h("h2",{},"Your fonts"),
    h("p",{},"Pick the font zip files you downloaded from dafont (market_fresh.zip and jonathan_signature.zip). They stay in this app on your phone."),
    ...Object.entries(FONT_SLOTS).map(([k,f])=>h("div",{class:"fontrow"+(S.fonts[k]?" ok":"")},h("span",{},f.label),h("span",{},S.fonts[k]?"Added":"Missing"))),
    h("button",{class:"btn ghost wide",style:"margin-top:12px",onclick:()=>fi.click()},"Add font files"),fi));
  home.append(h("p",{class:"hint",style:"margin-top:16px;text-align:center"},S.offlineReady?"Works offline. Nothing leaves your phone.":"Nothing leaves your phone."));
}
function openWeek(y,w,noHist){const k=keyOf(y,w);if(!S.weeks.has(k))S.weeks.set(k,newWeek(y,w));S.cur=k;S.pageIdx=0;S.view="edit";S.sel={tray:null,slot:null,mode:null,text:null};S.tab="photos";S.trayEdit=false;S.suggest=[];
  if(!noHist)history.pushState({w:k},"");curWeek().photos.forEach(p=>loadImg(p.id).then(()=>{refreshSuggest();drawStage()}).catch(()=>{}));render()}
function goHome(){const wk=curWeek();if(wk)scheduleSave(wk,true);S.view="home";render()}
window.addEventListener("popstate",()=>{if(S.view==="edit")goHome()});

/* ---------- editor ---------- */
let cvs=null,ctx=null,ro=null;
function renderEditor(){const wk=curWeek();document.documentElement.style.setProperty("--week",wk.color);
  app.append(h("header",{class:"top"},h("button",{class:"iconbtn","aria-label":"Back to all weeks",onclick:()=>history.back()},"‹"),
    h("div",{class:"grow"},h("h1",{},`Week ${numLabel(wk)}`),h("div",{class:"sub"},wk.dates||dateLabel(wk.year,wk.week,wk.through))),h("span",{class:"status",id:"status"},"")));
  const ed=h("main",{class:"editor"});app.append(ed);
  const pages=h("div",{class:"pages","aria-label":"Pages this week"});
  wk.pages.forEach((p,i)=>pages.append(h("button",{class:"chip","aria-pressed":String(i===S.pageIdx),onclick:()=>{S.pageIdx=i;S.sel={tray:null,slot:null,mode:null,text:null};render()}},i?`${numLabel(wk)}.${i+1}`:`${numLabel(wk)}`)));
  pages.append(h("button",{class:"chip",onclick:()=>{wk.pages.push(newPage("g9",false));S.pageIdx=wk.pages.length-1;scheduleSave(wk);render()}},"+ Page"));ed.append(pages);
  const stage=h("div",{class:"stage",id:"stage"});ed.append(stage);
  cvs=h("canvas",{"aria-label":"Page preview. Tap a spot to place or edit a photo."});ctx=cvs.getContext("2d");stage.append(cvs);bindCanvas();
  const dock=h("div",{class:"dock"});ed.append(dock);dock.append(h("div",{id:"slotbar"}));
  const tabs=h("div",{class:"tabs",role:"tablist"});
  for(const[k,l]of[["layout","Layout"],["photos","Photos"],["tile","Week"],["text","Text"],["save","Save"]])tabs.append(h("button",{role:"tab","aria-selected":String(S.tab===k),onclick:()=>{S.tab=k;if(k!=="text")S.sel.text=null;render()}},l));
  dock.append(tabs,h("section",{class:"panel",id:"panel"}));renderPanel();renderSlotbar();
  ro?.disconnect();ro=new ResizeObserver(sizeCanvas);ro.observe(stage);sizeCanvas()}
function sizeCanvas(){const st=$("#stage");if(!st||!cvs)return;const r=st.getBoundingClientRect();const css=Math.max(160,Math.floor(Math.min(r.width,r.height)));const dpr=Math.min(3,window.devicePixelRatio||1);
  cvs.style.width=cvs.style.height=css+"px";const px=Math.round(css*dpr);if(cvs.width!==px){cvs.width=cvs.height=px}drawStage()}
let raf=0;function drawStage(){if(!cvs||S.view!=="edit")return;cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>drawPage(ctx,cvs.width,curWeek(),curPage(),{preview:true}))}
function renderSlotbar(){const bar=$("#slotbar");if(!bar)return;bar.innerHTML="";const sel=S.sel,pg=curPage(),wk=curWeek();
  if(sel.mode==="swap"){bar.append(h("div",{class:"slotbar"},h("span",{class:"t"},"Tap the spot to swap with"),h("button",{onclick:clearSel},"Cancel")));return}
  if(sel.mode==="tile"){bar.append(h("div",{class:"slotbar"},h("span",{class:"t"},"Tap where the week tile should go"),h("button",{onclick:clearSel},"Cancel")));return}
  if(sel.slot==null)return;const i=sel.slot,isTile=pg.tile===i,s=pg.slots[i];const b=h("div",{class:"slotbar"});
  if(sel.mode==="adjust"){b.append(h("span",{class:"t"},"Drag the photo to move it. Zoom:"),
      h("input",{type:"range",min:"1",max:"2.5",step:"0.01",value:String(s.z||1),"aria-label":"Zoom",oninput:e=>{s.z=+e.target.value;drawStage()},onchange:()=>scheduleSave(wk)}),
      h("button",{class:"on",onclick:()=>{S.sel.mode=null;scheduleSave(wk);renderSlotbar();drawStage()}},"Done"));bar.append(b);return}
  b.append(h("span",{class:"t"},isTile?"Week tile":s.p?"Photo":"Empty spot"));
  if(!isTile&&s.p)b.append(h("button",{onclick:()=>{S.sel.mode="adjust";renderSlotbar();drawStage()}},"Adjust"));
  if(isTile||s.p)b.append(h("button",{onclick:()=>{S.sel.mode="swap";renderSlotbar()}},"Swap"));
  if(!isTile)b.append(h("button",{onclick:()=>moveTile(i)},"Tile here"));
  if(!isTile&&s.p)b.append(h("button",{onclick:()=>{s.p=null;scheduleSave(wk);clearSel();renderPanel()}},"Remove"));
  if(isTile)b.append(h("button",{onclick:()=>{pg.tile=null;scheduleSave(wk);clearSel();renderPanel()}},"Hide tile"));
  b.append(h("button",{onclick:clearSel,"aria-label":"Close"},"✕"));bar.append(b)}
function clearSel(){S.sel.slot=null;S.sel.mode=null;renderSlotbar();drawStage()}
function moveTile(i){const pg=curPage(),wk=curWeek();const old=pg.tile;if(old!=null&&old!==i){const a=pg.slots[old];pg.slots[old]=pg.slots[i];pg.slots[i]=a}pg.tile=i;S.sel.slot=null;S.sel.mode=null;scheduleSave(wk);renderSlotbar();renderPanel();drawStage()}
function placePhoto(i,id){const pg=curPage(),wk=curWeek();if(pg.tile===i)return toast("That spot holds the week tile. Swap it first.");pg.slots[i]={p:id,fx:.5,fy:.5,z:1};S.sel.tray=null;scheduleSave(wk);renderPanel();refreshSuggest();drawStage()}

function pt(e){const r=cvs.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height}}
function hitSlot(p){const pg=curPage();return slotRects(pg.layout,pg.mirror).findIndex(r=>p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h)}
function hitText(p){const ts=curPage().texts||[];for(let k=ts.length-1;k>=0;k--){const t=ts[k],b=textBoxes.get(t.id);if(!b)continue;const a=-(t.r||0)*Math.PI/180,dx=p.x-t.x,dy=p.y-t.y;
  const lx=dx*Math.cos(a)-dy*Math.sin(a),ly=dx*Math.sin(a)+dy*Math.cos(a);if(Math.abs(lx)<=b.hw+.01&&Math.abs(ly)<=b.hh+.01)return t}return null}
function bindCanvas(){let drag=null;
  cvs.addEventListener("pointerdown",e=>{const p=pt(e),pg=curPage(),wk=curWeek();
    if(S.tab==="text"){const t=hitText(p);if(t){S.sel.text=t.id;drag={kind:"text",t,ox:t.x-p.x,oy:t.y-p.y};cvs.setPointerCapture(e.pointerId);renderPanel();drawStage();return}}
    const i=hitSlot(p);
    if(S.sel.mode==="adjust"&&i===S.sel.slot){drag={kind:"pan",i,last:p};cvs.setPointerCapture(e.pointerId);return}
    if(i<0){clearSel();return}
    if(S.sel.tray){placePhoto(i,S.sel.tray);return}
    if(S.sel.mode==="tile"){moveTile(i);return}
    if(S.sel.mode==="swap"&&S.sel.slot!=null){const a=S.sel.slot;if(a!==i){const A=pg.slots[a];pg.slots[a]=pg.slots[i];pg.slots[i]=A;if(pg.tile===a)pg.tile=i;else if(pg.tile===i)pg.tile=a;scheduleSave(wk)}clearSel();return}
    if(S.tab==="text"&&S.sel.text){S.sel.text=null;renderPanel()}
    S.sel.slot=i;S.sel.mode=null;renderSlotbar();drawStage()});
  cvs.addEventListener("pointermove",e=>{if(!drag)return;const p=pt(e),pg=curPage();
    if(drag.kind==="text"){drag.t.x=clamp(p.x+drag.ox,0,1);drag.t.y=clamp(p.y+drag.oy,0,1);drawStage()}
    else{const s=pg.slots[drag.i];const im=imgReady.get(s.p);if(!im)return;const r=slotRects(pg.layout,pg.mirror)[drag.i];const sc=Math.max(r.w/im.naturalWidth,r.h/im.naturalHeight)*(s.z||1);
      const ovx=im.naturalWidth*sc-r.w,ovy=im.naturalHeight*sc-r.h;if(ovx>1e-6)s.fx=clamp(s.fx-(p.x-drag.last.x)/ovx,0,1);if(ovy>1e-6)s.fy=clamp(s.fy-(p.y-drag.last.y)/ovy,0,1);drag.last=p;drawStage()}});
  const end=()=>{if(drag){scheduleSave(curWeek());drag=null}};cvs.addEventListener("pointerup",end);cvs.addEventListener("pointercancel",end)}
function bindTrayDrag(btn,ph,img){let st=null,ghost=null;
  btn.addEventListener("pointerdown",e=>{st={x:e.clientX,y:e.clientY,id:e.pointerId}});
  btn.addEventListener("pointermove",e=>{if(!st)return;const dx=e.clientX-st.x,dy=e.clientY-st.y;
    if(!ghost&&dy<-14&&Math.abs(dy)>Math.abs(dx)*1.2){try{btn.setPointerCapture(st.id)}catch(x){}ghost=h("img",{class:"dragghost",src:img.src,alt:""});document.body.append(ghost)}
    if(ghost){ghost.style.left=e.clientX+"px";ghost.style.top=e.clientY+"px"}});
  btn.addEventListener("pointerup",e=>{if(ghost){ghost.remove();ghost=null;const r=cvs.getBoundingClientRect();
      if(e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom){const i=hitSlot({x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height});if(i>=0)placePhoto(i,ph.id)}
      btn.dataset.dragged="1";setTimeout(()=>delete btn.dataset.dragged,60)}st=null});
  btn.addEventListener("pointercancel",()=>{ghost?.remove();ghost=null;st=null})}

/* ---------- panels ---------- */
function refreshSuggest(){if(S.view!=="edit")return;const s=suggestColors(curWeek());if(s.join()!==S.suggest.join()){S.suggest=s;if(S.tab==="tile")renderPanel()}}
function layoutSvg(L,mirror){return`<svg viewBox="0 0 100 100" aria-hidden="true"><rect width="100" height="100" fill="#fff"/>${slotRects(L.id,mirror).map((r,i)=>`<rect x="${r.x*100}" y="${r.y*100}" width="${r.w*100}" height="${r.h*100}" fill="${i===L.tileIdx?"var(--week)":"#CFC8C0"}"/>`).join("")}</svg>`}
function setLayout(id){const pg=curPage(),wk=curWeek();if(pg.layout===id)return;const contents=pg.slots.filter((s,i)=>i!==pg.tile&&s.p);const hadTile=pg.tile!=null;
  const np=newPage(id,hadTile);if(hadTile&&np.tile==null)np.tile=0;let k=0;np.slots.forEach((s,i)=>{if(i!==np.tile&&k<contents.length)np.slots[i]={...contents[k++]}});
  np.mirror=pg.mirror;np.texts=pg.texts;wk.pages[S.pageIdx]=np;S.sel.slot=null;S.sel.mode=null;
  if(k<contents.length)toast(`${contents.length-k} photo${contents.length-k===1?"":"s"} went back to the tray`);scheduleSave(wk);renderPanel();renderSlotbar();drawStage()}
function fillForMe(){const pg=curPage(),wk=curWeek();const R=slotRects(pg.layout,pg.mirror);const used=new Set(wk.pages.flatMap(p=>p.slots.map(s=>s.p)).filter(Boolean));
  const free=wk.photos.filter(p=>!used.has(p.id));if(!free.length)return toast("All photos in the tray are already on a page.");
  const port=free.filter(p=>p.h>p.w),land=free.filter(p=>p.h<=p.w);let n=0;
  R.forEach((r,i)=>{if(i===pg.tile||pg.slots[i].p)return;const want=r.h>r.w*1.1?port:land,other=want===port?land:port;const ph=want.shift()||other.shift();if(ph){pg.slots[i]={p:ph.id,fx:.5,fy:.5,z:1};n++}});
  scheduleSave(wk);renderPanel();refreshSuggest();drawStage();toast(n?`Placed ${n} photo${n===1?"":"s"}`:"No empty spots left on this page")}
function setColor(c){const wk=curWeek();wk.color=c.toUpperCase();document.documentElement.style.setProperty("--week",wk.color);scheduleSave(wk);renderPanel();drawStage()}

function renderPanel(){const el=$("#panel");if(!el)return;const top=el.scrollTop;el.innerHTML="";const wk=curWeek(),pg=curPage();
  if(S.tab==="layout"){el.append(h("p",{class:"hint"},"Pick a layout. Photos you already placed move into the new spots."));
    const g=h("div",{class:"layouts"});for(const L of RAW){const b=h("button",{class:"lay","aria-pressed":String(pg.layout===L.id),"aria-label":L.name,onclick:()=>setLayout(L.id)});b.innerHTML=layoutSvg(L,pg.mirror);g.append(b)}
    el.append(g,h("label",{class:"toggle",style:"margin-top:8px"},h("input",{type:"checkbox",id:"mirror",checked:pg.mirror,onchange:e=>{pg.mirror=e.target.checked;scheduleSave(wk);renderPanel();drawStage()}}),"Mirror left and right"))}
  else if(S.tab==="photos"){const used=new Set();wk.pages.forEach(p=>p.slots.forEach(s=>s.p&&used.add(s.p)));
    const input=h("input",{type:"file",accept:"image/*",multiple:true,hidden:true,id:"fileIn",onchange:e=>{const fs=[...e.target.files];e.target.value="";addPhotos(fs)}});
    el.append(h("p",{class:"hint"},S.sel.tray?"Now tap a spot on the page.":wk.photos.length?"Tap a photo, then tap a spot on the page. Or drag it up onto the page.":"Add this week's photos. You can pick many at once."));
    const tray=h("div",{class:"tray"});tray.append(h("button",{class:"addph",onclick:()=>input.click()},h("b",{},"+"),"Add photos"));
    for(const ph of wk.photos){const u=used.has(ph.id);const img=h("img",{alt:"",draggable:"false"});thumbURL(ph.id).then(s=>{if(s)img.src=s});
      const b=h("button",{class:"ph"+(u?" used":""),"aria-pressed":String(S.sel.tray===ph.id),"aria-label":u?"Photo, already on a page":"Photo",
        onclick:()=>{if(b.dataset.dragged||S.trayEdit)return;S.sel.tray=S.sel.tray===ph.id?null:ph.id;S.sel.slot=null;S.sel.mode=null;renderSlotbar();renderPanel()}},img,u?h("span",{class:"badge"},"on page"):null,
        S.trayEdit?h("span",{class:"x",role:"button","aria-label":"Remove photo",onclick:async e=>{e.stopPropagation();if(await confirmBox("Remove this photo?","It's deleted from the app. The original stays in your gallery.","Remove",true))removePhoto(ph)}},"×"):null);
      if(!S.trayEdit)bindTrayDrag(b,ph,img);tray.append(b)}
    el.append(input,tray,h("div",{class:"row",style:"margin-top:10px"},h("button",{class:"btn ghost",onclick:fillForMe,disabled:!wk.photos.length},"Fill empty spots"),
      wk.photos.length?h("button",{class:"btn ghost",onclick:()=>{S.trayEdit=!S.trayEdit;renderPanel()}},S.trayEdit?"Done":"Remove photos"):null))}
  else if(S.tab==="tile"){const on=pg.tile!=null;
    el.append(h("div",{class:"row"},h("label",{class:"toggle"},h("input",{type:"checkbox",id:"tileOn",checked:on,onchange:e=>{if(e.target.checked){S.sel.mode="tile";S.sel.slot=null;renderSlotbar()}else{pg.tile=null;scheduleSave(wk);drawStage()}renderPanel()}}),"Week tile on this page"),
      on?h("button",{class:"btn ghost",onclick:()=>{S.sel.mode="tile";S.sel.slot=null;renderSlotbar()}},"Move"):null));
    const sw=c=>h("button",{class:"sw",style:`background:${c}`,"aria-label":`Colour ${c}`,"aria-pressed":String(wk.color.toUpperCase()===c.toUpperCase()),onclick:()=>setColor(c)});
    el.append(h("div",{class:"lbl"},"From this week's photos"),S.suggest.length?h("div",{class:"swatches"},S.suggest.map(sw)):h("p",{class:"hint"},"Add photos and colours from them show up here."),
      h("div",{class:"lbl"},"Your colours"),h("div",{class:"swatches"},PRESETS.map(sw),h("label",{class:"sw custom","aria-label":"Pick any colour"},h("input",{type:"color",id:"anyCol",value:wk.color.length===7?wk.color.toLowerCase():"#e2726a",onchange:e=>setColor(e.target.value)}))));
    const auto=dateLabel(wk.year,wk.week,wk.through);
    el.append(h("div",{class:"lbl"},"Dates"),h("div",{class:"row"},h("input",{type:"text",id:"dates",style:"flex:1;min-width:0",value:wk.dates||auto,"aria-label":"Dates under the number",oninput:e=>{const v=e.target.value.trim();wk.dates=v&&v!==auto?e.target.value:null;drawStage();scheduleSave(wk)}}),
      wk.dates?h("button",{class:"btn ghost",onclick:()=>{wk.dates=null;scheduleSave(wk);renderPanel();drawStage()}},"Reset"):null));
    if(wk.through||wk.week<weeksInYear(wk.year)){const next=S.weeks.get(keyOf(wk.year,wk.week+1));const busy=!wk.through&&next&&next.pages.some(p=>p.slots.some(s=>s.p));
      el.append(h("div",{class:"lbl"},"Two weeks on one page"),h("label",{class:"toggle"},h("input",{type:"checkbox",id:"combine",checked:!!wk.through,disabled:busy,onchange:e=>{wk.through=e.target.checked?wk.week+1:null;scheduleSave(wk,true);render()}}),
        wk.through?`Weeks ${wk.week} and ${wk.through} together`:`Combine with week ${wk.week+1}`),busy?h("p",{class:"hint"},`Week ${wk.week+1} already has photos, so it can't be combined.`):null)}
    el.append(h("button",{class:"btn ghost wide",style:"margin-top:14px",onclick:()=>exportTile(wk)},"Download week tile"))}
  else if(S.tab==="text"){const t=(pg.texts||[]).find(t=>t.id===S.sel.text);const cur=t||S.textDraft||(S.textDraft={t:"",font:"hand",color:"black",outline:true,s:.05,r:-4});
    const upd=(k,v)=>{cur[k]=v;if(t){scheduleSave(wk);drawStage()}};
    el.append(h("p",{class:"hint"},t?"Drag the text on the page to move it.":"Type your note and add it. Then drag it into place."),
      h("textarea",{id:"txt",placeholder:"e.g. Best pizza night",value:cur.t,"aria-label":"Text",oninput:e=>upd("t",e.target.value)}));
    const seg=(k,opts)=>h("div",{class:"seg"},opts.map(([v,l])=>h("button",{"aria-pressed":String(cur[k]===v),onclick:()=>{upd(k,v);renderPanel()}},l)));
    el.append(h("div",{class:"row",style:"margin-top:10px"},seg("font",[["hand","Handwritten"],["script","Script"],["clean","Clean"]])),
      h("div",{class:"row",style:"margin-top:8px"},seg("color",[["black","Black"],["white","White"]]),h("label",{class:"toggle"},h("input",{type:"checkbox",id:"outline",checked:cur.outline,onchange:e=>upd("outline",e.target.checked)}),"Bubble outline")),
      h("div",{class:"row",style:"margin-top:4px"},h("label",{class:"field"},"Size",h("input",{type:"range",id:"tsize",min:"0.02",max:"0.14",step:"0.002",value:String(cur.s),oninput:e=>upd("s",+e.target.value)})),
        h("label",{class:"field"},"Tilt",h("input",{type:"range",id:"ttilt",min:"-30",max:"30",step:"1",value:String(cur.r),oninput:e=>upd("r",+e.target.value)}))),
      h("div",{class:"row",style:"margin-top:10px"},t?h("button",{class:"btn",onclick:()=>{S.sel.text=null;renderPanel();drawStage()}},"Done"):
        h("button",{class:"btn",onclick:()=>{if(!cur.t.trim())return toast("Type some text first");const nt={...cur,id:"t"+uid(),x:.5,y:.5};pg.texts=pg.texts||[];pg.texts.push(nt);S.textDraft=null;S.sel.text=nt.id;scheduleSave(wk);renderPanel();drawStage()}},"Add to page"),
        t?h("button",{class:"btn ghost",onclick:()=>{pg.texts=pg.texts.filter(x=>x.id!==t.id);S.sel.text=null;scheduleSave(wk);renderPanel();drawStage()}},"Delete"):null))}
  else if(S.tab==="save"){el.append(h("p",{class:"hint"},`Saves this page as a 12 × 12 inch print file (3600 × 3600 pixels) named “${wk.year} ${pageName(wk,S.pageIdx)}.jpg” in your Downloads.`),
      h("div",{class:"stack"},h("button",{class:"btn wide",onclick:()=>exportOne(wk,S.pageIdx)},"Download this page"),h("button",{class:"btn ghost wide",onclick:()=>exportTile(wk)},"Download week tile")));
    if(wk.pages.length>1)el.append(h("button",{class:"btn ghost wide",style:"margin-top:18px;color:var(--danger)",onclick:async()=>{if(!await confirmBox("Delete this page?","The photos stay in this week's tray.","Delete",true))return;wk.pages.splice(S.pageIdx,1);S.pageIdx=Math.max(0,S.pageIdx-1);scheduleSave(wk);render()}},"Delete this page"))}
  el.scrollTop=top}

/* ---------- start ---------- */
async function start(){render();
  try{await Promise.all(['700 40px Fredoka','40px Sacramento','300 40px "Playwrite DE Grund"'].map(f=>document.fonts.load(f)))}catch(e){}
  try{await loadSavedFonts();S.weeks=new Map((await DB.all("weeks")).map(w=>[keyOf(w.year,w.week),w]));S.lastBackup=await DB.get("meta","lastBackup")||null;S.dirtySinceBackup=!!(await DB.get("meta","dirty"))}
  catch(e){toast("This browser can't store data. Turn off private browsing and try again.",0)}
  S.loaded=true;history.replaceState({home:1},"");render()}
if("serviceWorker"in navigator){navigator.serviceWorker.register("sw.js").then(reg=>{
  navigator.serviceWorker.ready.then(()=>{S.offlineReady=true;if(S.view==="home")render()});
  reg.addEventListener("updatefound",()=>{const nw=reg.installing;nw&&nw.addEventListener("statechange",()=>{if(nw.state==="installed"&&navigator.serviceWorker.controller)toast("A new version is ready.",0,{label:"Update",fn:async()=>{await flushSaves();S.updating=true;nw.postMessage("skip")}})})})}).catch(()=>{});
  let reloaded=false;navigator.serviceWorker.addEventListener("controllerchange",()=>{if(!reloaded&&S.updating){reloaded=true;location.reload()}});}
start();
