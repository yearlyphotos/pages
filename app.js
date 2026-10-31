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
function cv(w,hh){const c=document.createElement("canvas");c.width=Math.max(1,Math.ceil(w));c.height=Math.max(1,Math.ceil(hh));return c}
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

/* ---------- photo dates (EXIF) ---------- */
async function photoDate(file){try{const b=new DataView(await file.slice(0,256*1024).arrayBuffer());if(b.getUint16(0)!==0xFFD8)return null;let o=2;
  while(o+4<b.byteLength){const mk=b.getUint16(o),len=b.getUint16(o+2);
    if(mk===0xFFE1&&b.getUint32(o+4)===0x45786966){const t=o+10;const le=b.getUint16(t)===0x4949;const g16=q=>b.getUint16(q,le),g32=q=>b.getUint32(q,le);
      const ifd=off=>{const n=g16(t+off),tags={};for(let i=0;i<n;i++){const e=t+off+2+i*12;tags[g16(e)]={cnt:g32(e+4),val:e+8}}return tags};
      const str=tg=>{if(!tg)return null;const at=tg.cnt>4?t+g32(tg.val):tg.val;let s="";for(let i=0;i<tg.cnt-1;i++)s+=String.fromCharCode(b.getUint8(at+i));return s};
      const i0=ifd(g32(t+4));let s=null;if(i0[0x8769]){const ex=ifd(g32(i0[0x8769].val));s=str(ex[0x9003])||str(ex[0x9004])}s=s||str(i0[0x0132]);
      const m=s&&s.match(/(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d)/);return m?new Date(+m[1],m[2]-1,+m[3],+m[4],+m[5]).getTime():null}
    if((mk&0xFF00)!==0xFF00)break;o+=2+len}}catch(e){}return null}

/* ---------- dates (ISO weeks, Monday to Sunday) ---------- */
const MONTHS={en:["January","February","March","April","May","June","July","August","September","October","November","December"],de:["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"]};
const MSHORT=["Jan","Feb","Mar","Apr","May","June","July","Aug","Sept","Oct","Nov","Dec"];
function isoWeekOf(date){const d=new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));const dow=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-dow+3);const y=d.getUTCFullYear();return{y,w:Math.ceil(((d-Date.UTC(y,0,1))/864e5+1)/7)}}
function weekStart(y,w){const j4=new Date(Date.UTC(y,0,4));const dow=(j4.getUTCDay()+6)%7;const m=new Date(j4);m.setUTCDate(j4.getUTCDate()-dow+(w-1)*7);return m}
function weeksInYear(y){return isoWeekOf(new Date(y,11,28)).w}
function dateLabel(y,a,b,lang){const s=weekStart(y,a),e=weekStart(y,b);e.setUTCDate(e.getUTCDate()+6);const sm=s.getUTCMonth(),em=e.getUTCMonth(),sd=s.getUTCDate(),ed=e.getUTCDate();
  if(lang==="de")return sm===em?`${pad(sd)}.–${pad(ed)}. ${MONTHS.de[em]}`:`${pad(sd)}.${pad(sm+1)}.–${pad(ed)}. ${MONTHS.de[em]}`;
  return sm===em?`${sd}–${ed} ${MONTHS.en[em]}`:`${sd} ${MSHORT[sm]} – ${ed} ${MONTHS.en[em]}`}
const keyOf=(y,w)=>`w${y}-${pad(w)}`;
const span=wk=>wk.pair===-1?[wk.week-1,wk.week]:wk.pair===1?[wk.week,wk.week+1]:[wk.week,wk.week];
const numLabel=wk=>{const[a,b]=span(wk);return a===b?String(a):`${a}&${b}`};
const pageName=(wk,i)=>{const[a,b]=span(wk);return`Week ${a===b?pad(a):pad(a)+"&"+pad(b)}${i?"."+(i+1):""}`};
const langOf=wk=>wk.lang||S.settings.lang||"en";
const datesOf=wk=>{const[a,b]=span(wk);return wk.dates||dateLabel(wk.year,a,b,langOf(wk))};

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
const M=0.016,G=0.016,IG=0.007;
function slotRects(id,mirror){const L=LAYOUT[id]||LAYOUT.g9;const A=M-G/2,S=1-2*M+G;return L.cells.map(([x,y,w,hh])=>{if(mirror)x=12-x-w;return{x:A+x/12*S+G/2,y:A+y/12*S+G/2,w:w/12*S-G,h:hh/12*S-G}})}
const SPLITS={h2:[[0,0,.5,1],[.5,0,.5,1]],v2:[[0,0,1,.5],[0,.5,1,.5]],g4:[[0,0,.5,.5],[.5,0,.5,.5],[0,.5,.5,.5],[.5,.5,.5,.5]]};
const emptyRef=()=>({p:null,fx:.5,fy:.5,z:1});
/* every photo spot on a page, including the small spots of a split spot */
function cellsOf(pg){const out=[];slotRects(pg.layout,pg.mirror).forEach((r,i)=>{if(pg.tile===i){out.push({key:String(i),i,k:null,rect:r,tile:true});return}
  const s=pg.slots[i];if(s.split&&SPLITS[s.split]){SPLITS[s.split].forEach(([x,y,w,hh],k)=>{s.subs[k]=s.subs[k]||emptyRef();
      out.push({key:i+"."+k,i,k,ref:s.subs[k],rect:{x:r.x+x*r.w+(x>0?IG/2:0),y:r.y+y*r.h+(y>0?IG/2:0),w:w*r.w-(w<1?IG/2:0),h:hh*r.h-(hh<1?IG/2:0)}})})}
  else out.push({key:String(i),i,k:null,ref:s,rect:r})});return out}
const PRESETS=["#F2A36B","#EA8FBF","#7FD4BE","#EDCB63","#8CC8F0","#E2726A","#A9C39A","#B9A3DE"];
const ADJ0={wx:0,wy:0,ws:1,dx:0,dy:0,ds:1};

/* ---------- state ---------- */
const now=isoWeekOf(new Date());
const S={view:"home",year:now.y,weeks:new Map(),cur:null,pageIdx:0,tab:"photos",sel:{tray:null,cell:null,mode:null,item:null},trayEdit:false,cutEdit:false,adjPart:"w",
  suggest:[],fonts:{mf:false,mfb:false,script:false},settings:{lang:"en",tileAdj:null},lastBackup:null,dirtySinceBackup:false,loaded:false,offlineReady:false,drop:null};
function newPage(layout,withTile){const L=LAYOUT[layout];return{layout,mirror:false,slots:L.cells.map(()=>({...emptyRef(),split:null})),tile:withTile?L.tileIdx:null,items:[]}}
function newWeek(y,w){return{year:y,week:w,pair:null,color:PRESETS[(w-1)%PRESETS.length],dates:null,lang:null,tileAdj:null,photos:[],cuts:[],pages:[newPage("g9",true)],thumb:null}}
function migrate(wk){if(wk.through){wk.pair=1;delete wk.through}wk.pair=wk.pair||null;wk.cuts=wk.cuts||[];
  for(const pg of wk.pages){if(!pg.items){pg.items=(pg.texts||[]).map(t=>({...t,type:"text"}));delete pg.texts}for(const s of pg.slots){if(s.split===undefined)s.split=null}}return wk}
const curWeek=()=>S.weeks.get(S.cur);
const curPage=()=>curWeek().pages[S.pageIdx];
const photoById=(wk,id)=>wk.photos.find(p=>p.id===id);
const hasContent=wk=>!!wk&&wk.pages.some(pg=>cellsOf(pg).some(c=>c.ref&&c.ref.p)||pg.items.length);

/* ---------- photos and images ---------- */
const urlCache=new Map(),imgCache=new Map(),imgReady=new Map();
async function thumbURL(id){const k="t:"+id;if(!urlCache.has(k)){const r=await DB.get("photos",id);urlCache.set(k,r?URL.createObjectURL(r.thumb||r.blob):"")}return urlCache.get(k)}
function loadImg(id){if(!imgCache.has(id)){imgCache.set(id,(async()=>{const r=await DB.get("photos",id);if(!r)throw new Error("missing photo");const url=URL.createObjectURL(r.blob);
  const im=new Image();im.decoding="async";im.src=url;await im.decode();imgReady.set(id,im);return im})().catch(e=>{imgCache.delete(id);throw e}))}return imgCache.get(id)}
async function ensureImages(pages){const ids=new Set();for(const p of pages){for(const c of cellsOf(p))if(c.ref&&c.ref.p)ids.add(c.ref.p);for(const it of p.items)if(it.type==="cut")ids.add(it.c)}
  await Promise.all([...ids].map(id=>loadImg(id).catch(()=>null)))}
async function scaleTo(bmp,max,q){const k=Math.min(1,max/Math.max(bmp.width,bmp.height));const c=cv(bmp.width*k,bmp.height*k);
  c.getContext("2d").drawImage(bmp,0,0,c.width,c.height);const b=await toBlob(c,"image/jpeg",q);return{blob:b,w:c.width,h:c.height}}
async function storePhoto(f){const t=(await photoDate(f))||f.lastModified||null;const bmp=await createImageBitmap(f,{imageOrientation:"from-image"});const big=await scaleTo(bmp,2600,.88);const sm=await scaleTo(bmp,360,.8);bmp.close?.();
  const id=uid();await DB.put("photos",id,{blob:big.blob,thumb:sm.blob,w:big.w,h:big.h,crc:await crcBlob(big.blob),type:"image/jpeg"});return{id,w:big.w,h:big.h,t}}
async function askPersist(){try{if(navigator.storage?.persist&&!(await navigator.storage.persisted()))await navigator.storage.persist()}catch(e){}}
function otherWeek(wk,ph){if(!ph.t)return null;const{y,w}=isoWeekOf(new Date(ph.t));const[a,b]=span(wk);return(y!==wk.year||w<a||w>b)?w:null}
async function addPhotos(files){const wk=curWeek();files=[...files];if(!files.length)return;await askPersist();
  let done=0,failed=0,other=0;const tick=()=>toast(`Adding photos… ${done} of ${files.length}`,0);tick();
  for(const f of files){try{const ph=await storePhoto(f);wk.photos.push(ph);if(otherWeek(wk,ph))other++;loadImg(ph.id).then(()=>{refreshSuggest();drawStage()}).catch(()=>{})}
    catch(e){failed++;if(e&&e.name==="QuotaExceededError"){toast("Your phone has no room left for more photos.",5000);break}}
    done++;tick();if(S.tab==="photos")renderPanel()}
  wk.photos.sort((a,b)=>(a.t||0)-(b.t||0));commit(wk);
  let msg=failed?`Added ${done-failed} photos. ${failed} couldn't be read.`:`Added ${done} photo${done===1?"":"s"}.`;if(other)msg+=` ${other} ${other===1?"is":"are"} from another week.`;toast(msg,4000);if(S.tab==="photos")renderPanel()}
async function addByDate(files){files=[...files];if(!files.length)return;await askPersist();const pb=progressBox("Sorting photos into weeks");const touched=new Set();let failed=0;
  for(let i=0;i<files.length;i++){pb.set(i/files.length,`Photo ${i+1} of ${files.length}`);try{const ph=await storePhoto(files[i]);const d=new Date(ph.t||Date.now());let{y,w}=isoWeekOf(d);
      const prev=S.weeks.get(keyOf(y,w-1)),next=S.weeks.get(keyOf(y,w+1));if(prev&&prev.pair===1)w=w-1;else if(next&&next.pair===-1)w=w+1;
      const k=keyOf(y,w);if(!S.weeks.has(k))S.weeks.set(k,newWeek(y,w));const wk=S.weeks.get(k);wk.photos.push(ph);touched.add(k)}catch(e){failed++}}
  for(const k of touched){const wk=S.weeks.get(k);wk.photos.sort((a,b)=>(a.t||0)-(b.t||0));await saveNow(wk)}
  pb.close();render();const n=files.length-failed;toast(`Added ${n} photo${n===1?"":"s"} to ${touched.size} week${touched.size===1?"":"s"}.${failed?` ${failed} couldn't be read.`:""}`,4500)}
async function removePhoto(ph){const wk=curWeek();wk.photos=wk.photos.filter(p=>p.id!==ph.id);wk.pages.forEach(p=>cellsOf(p).forEach(c=>{if(c.ref&&c.ref.p===ph.id)c.ref.p=null}));if(S.sel.tray===ph.id)S.sel.tray=null;
  await dropBlob(ph.id);commit(wk);renderPanel();drawStage()}
async function dropBlob(id){await DB.del("photos",id).catch(()=>{});for(const k of[id,"t:"+id]){const u=urlCache.get(k);if(u)URL.revokeObjectURL(u);urlCache.delete(k)}imgCache.delete(id);imgReady.delete(id)}

/* ---------- your fonts (added once from the phone, kept in IndexedDB) ---------- */
const FONT_SLOTS={mf:{family:"MF",weight:"400",label:"Market Fresh (dates)"},mfb:{family:"MF",weight:"700",label:"Market Fresh Bold (week number)"},script:{family:"JSig",weight:"400",label:"Jonathan Signature (the word Week)"}};
function fontSlotFor(name){const n=name.split("/").pop().toLowerCase();if(!/\.(ttf|otf)$/.test(n))return null;if(n.includes("jonathan"))return"script";
  if(n.includes("market")&&!/caps|italic|inline/.test(n))return n.includes("bold")?"mfb":"mf";return null}
async function activateFont(slot,buf){const f=FONT_SLOTS[slot];const ff=new FontFace(f.family,buf,{weight:f.weight});await ff.load();document.fonts.add(ff);S.fonts[slot]=true;textCache.clear()}
async function loadSavedFonts(){for(const slot of Object.keys(FONT_SLOTS)){try{const b=await DB.get("fonts",slot);if(b)await activateFont(slot,await b.arrayBuffer())}catch(e){}}}
async function addFontFiles(files){let added=new Set();for(const f of files){try{
    if(/\.zip$/i.test(f.name)){for(const en of await readZip(f)){const slot=fontSlotFor(en.name);if(!slot)continue;const b=await en.blob();await activateFont(slot,await b.arrayBuffer());await DB.put("fonts",slot,new Blob([b],{type:"font/ttf"}));added.add(slot)}}
    else{const slot=fontSlotFor(f.name);if(!slot)continue;await activateFont(slot,await f.arrayBuffer());await DB.put("fonts",slot,f.slice(0,f.size,"font/ttf"));added.add(slot)}}catch(e){}}
  S.dirtySinceBackup=true;toast(added.size?`Added ${added.size} font${added.size===1?"":"s"}`:"No matching font files found. Pick the zip files from dafont.",4000);render()}

/* ---------- week tile ---------- */
const F_NUM="MF, Fredoka, sans-serif",F_SCRIPT=`JSig, Sacramento, cursive`,F_HAND=`"Playwrite DE Grund", Sacramento, cursive`,F_UI="Fredoka, sans-serif";
function brush(ctx,x,y,w,hh,col,seed){const rnd=mulberry(seed);const[r,g,b]=hexRgb(col);ctx.save();
  ctx.fillStyle=`rgba(${r},${g},${b},0.30)`;ctx.beginPath();ctx.moveTo(x+w*.03,y+hh*.2);ctx.lineTo(x+w*.97,y+hh*.24);ctx.lineTo(x+w*.95,y+hh*.82);ctx.lineTo(x+w*.02,y+hh*.78);ctx.closePath();ctx.fill();
  ctx.lineCap="round";
  for(let i=0;i<46;i++){const t=rnd();const yy=y+(0.06+0.88*t)*hh;const lw=hh*(0.035+rnd()*0.07);const edge=Math.abs(t-.5)*2;
    let xx=x+w*(rnd()*0.07+edge*0.05*rnd());const x1=x+w*(1-rnd()*0.09-edge*0.08*rnd());
    ctx.strokeStyle=`rgba(${r},${g},${b},${0.16+rnd()*0.34})`;ctx.lineWidth=lw;ctx.beginPath();
    while(xx<x1){const end=Math.min(x1,xx+w*(0.06+rnd()*0.4));const j=(rnd()-.5)*lw*.5;ctx.moveTo(xx,yy+j);ctx.lineTo(end,yy+j+(rnd()-.5)*lw*.3);xx=end+w*(rnd()<.7?0.006:0.03)*rnd()*2}
    ctx.stroke()}
  ctx.restore()}
/* draw text so its visible ink is centred on cx */
function inkCentre(ctx,txt,cx,y){ctx.textAlign="left";const m=ctx.measureText(txt);const l=m.actualBoundingBoxLeft||0,r=m.actualBoundingBoxRight||m.width;ctx.textAlign="left";ctx.fillText(txt,cx-(l+r)/2+l,y);return m}
const adjOf=wk=>({...ADJ0,...(wk.tileAdj||S.settings.tileAdj||{})});
function drawTile(ctx,X,Y,W,H,wk,color){
  ctx.save();ctx.beginPath();ctx.rect(X,Y,W,H);ctx.clip();ctx.fillStyle="#fff";ctx.fillRect(X,Y,W,H);
  const col=color||wk.color,label=numLabel(wk),date=datesOf(wk),word=langOf(wk)==="de"?"Woche":"Week",A=adjOf(wk);const u=Math.min(W,H*1.18);
  ctx.font=`700 100px ${F_NUM}`;const m=ctx.measureText(label);const capR=(m.actualBoundingBoxAscent||72)/100,wR=m.width/100;
  let fs=0.30*u/capR;if(wR*fs>0.86*W)fs=0.86*W/wR;const capH=capR*fs,numW=wR*fs;
  const ds0=0.046*u;const bandH0=0.074*u,gap=0.026*u;const top=Y+(H-(capH+gap+bandH0))/2,cx=X+W/2;
  ctx.textBaseline="alphabetic";ctx.font=`700 ${fs}px ${F_NUM}`;ctx.fillStyle=col;inkCentre(ctx,label,cx,top+capH);
  // dates line with brush
  const ds=ds0*A.ds,bandH=bandH0*A.ds;ctx.font=`400 ${ds}px ${F_NUM}`;const dW=ctx.measureText(date).width;const bandW=Math.min(W*.96,dW+0.10*u*A.ds);
  const bcx=cx+A.dx*u,by=top+capH+gap+A.dy*u;brush(ctx,bcx-bandW/2,by,bandW,bandH,col,hashStr(keyOf(wk.year,wk.week)));
  ctx.fillStyle="#141414";ctx.textBaseline="middle";inkCentre(ctx,date,bcx,by+bandH*0.55);
  // the word Week / Woche
  ctx.textBaseline="alphabetic";ctx.font=`100px ${F_SCRIPT}`;const sm=ctx.measureText(word);const sAsc=(sm.actualBoundingBoxAscent||70)/100,sw=sm.width/100;
  let ss=0.6*capH/sAsc;const maxW=Math.max(numW*0.72,0.46*u);if(sw*ss>maxW)ss=maxW/sw;ss*=A.ws;ctx.font=`${ss}px ${F_SCRIPT}`;ctx.fillStyle="#141414";inkCentre(ctx,word,cx+A.wx*u,top+capH*0.84+A.wy*u);
  ctx.restore()}

/* ---------- text bubbles, stickers and cut-outs ---------- */
const textCache=new Map(),stkCache=new Map(),cutCache=new Map();
function cacheSet(map,k,v){if(map.size>160)map.clear();map.set(k,v);return v}
const textFont=(t,px)=>t.font==="script"?`${px}px ${F_SCRIPT}`:t.font==="clean"?`400 ${px}px ${F_NUM}`:`300 ${px}px ${F_HAND}`;
function textCanvas(t,px){px=Math.max(4,Math.round(px));const key=[t.t,t.font,t.color,t.outline,px].join("|");if(textCache.has(key))return textCache.get(key);
  const lines=(t.t||" ").split("\n");const mc=cv(4,4).getContext("2d");mc.font=textFont(t,px);const lh=px*(t.font==="script"?1.05:1.3);let mw=0;lines.forEach(l=>mw=Math.max(mw,mc.measureText(l).width));
  const padd=Math.ceil(px*0.75);const c=cv(mw+padd*2,lines.length*lh+padd*2);const x=c.getContext("2d");const W=c.width,H=c.height;
  const fg=t.color==="white"?"#FFFFFF":"#141414",bg=t.color==="white"?"#141414":"#FFFFFF";
  const each=fn=>lines.forEach((ln,i)=>fn(ln,W/2,padd+lh*(i+.5)));
  const setup=q=>{q.font=textFont(t,px);q.textAlign="center";q.textBaseline="middle";q.lineJoin="round";q.lineCap="round"};
  if(t.outline){const s=cv(W,H),sx=s.getContext("2d");setup(sx);sx.fillStyle=sx.strokeStyle="#000";sx.lineWidth=px*0.46;each((l,a,b)=>{sx.strokeText(l,a,b);sx.fillText(l,a,b)});
    const bl=cv(W,H),bx=bl.getContext("2d");bx.filter=`blur(${Math.max(1,px*0.17)}px)`;bx.drawImage(s,0,0);bx.filter="none";
    const id=bx.getImageData(0,0,W,H),d=id.data;const[r,g,b]=hexRgb(bg);for(let i=0;i<d.length;i+=4){const a=d[i+3];d[i]=r;d[i+1]=g;d[i+2]=b;d[i+3]=a>60?255:a>30?(a-30)*8.5:0}bx.putImageData(id,0,0);
    x.save();x.shadowColor="rgba(0,0,0,.20)";x.shadowBlur=px*.12;x.shadowOffsetY=px*.04;x.drawImage(bl,0,0);x.restore()}
  setup(x);x.fillStyle=fg;each((l,a,b)=>x.fillText(l,a,b));return cacheSet(textCache,key,c)}
function withBorder(art,padd){const W=art.width,H=art.height;const sil=cv(W,H),s=sil.getContext("2d");const r=padd*0.6;
  for(let k=0;k<24;k++){const a=k/24*Math.PI*2;s.drawImage(art,Math.cos(a)*r,Math.sin(a)*r)}for(let k=0;k<12;k++){const a=k/12*Math.PI*2;s.drawImage(art,Math.cos(a)*r*.5,Math.sin(a)*r*.5)}
  s.globalCompositeOperation="source-in";s.fillStyle="#FFFFFF";s.fillRect(0,0,W,H);
  const out=cv(W,H),o=out.getContext("2d");o.shadowColor="rgba(0,0,0,.22)";o.shadowBlur=padd*.35;o.shadowOffsetY=padd*.12;o.drawImage(sil,0,0);o.shadowColor="transparent";o.drawImage(art,0,0);return out}

/* sticker designs, drawn in a W×H box */
const INK="#23201E";
function rr(x,X,Y,W,H,r){x.beginPath();x.moveTo(X+r,Y);x.arcTo(X+W,Y,X+W,Y+H,r);x.arcTo(X+W,Y+H,X,Y+H,r);x.arcTo(X,Y+H,X,Y,r);x.arcTo(X,Y,X+W,Y,r);x.closePath()}
function fitText(x,txt,cx,cy,maxW,maxH,col,weight){const lines=txt.split("\n");let fs=maxH/lines.length/1.05;x.font=`${weight} ${fs}px ${F_UI}`;
  const widest=Math.max(...lines.map(l=>x.measureText(l).width));if(widest>maxW){fs*=maxW/widest}x.font=`${weight} ${fs}px ${F_UI}`;x.fillStyle=col;x.textAlign="center";x.textBaseline="middle";
  lines.forEach((l,i)=>x.fillText(l,cx,cy+(i-(lines.length-1)/2)*fs*1.02+fs*.04))}
const outline=(x,W)=>{x.lineWidth=W*0.035;x.strokeStyle=INK;x.lineJoin="round";x.lineCap="round";x.stroke()};
const STICKERS=[];
function addSt(id,cat,ar,draw){STICKERS.push({id,cat,ar,draw})}
[["wow","#E2726A","#FFFFFF"],["love\nthis","#EA8FBF","#FFFFFF"],["best\nday","#7FD4BE",INK],["yay!","#EDCB63",INK],["so\ngood","#8CC8F0",INK],["cozy","#B9A3DE","#FFFFFF"],
 ["fun\ntimes","#F2A36B",INK],["oh\nhappy\nday","#A9C39A",INK],["cheers","#2F3E66","#FFFFFF"],["favourite","#FFF6E6","#E2726A"]].forEach(([t,bg,fg],i)=>
  addSt("w"+i,"Words",1,(x,W)=>{const r=W/2;x.fillStyle=bg;x.beginPath();x.arc(r,r,r,0,Math.PI*2);x.fill();x.save();x.globalAlpha=.55;x.setLineDash([W*.03,W*.035]);x.lineWidth=W*.016;x.strokeStyle=fg;x.beginPath();x.arc(r,r,r*.84,0,Math.PI*2);x.stroke();x.restore();fitText(x,t,r,r,W*.62,W*(t.includes("\n")?.56:.34),fg,600)}));
[["this week","#2F3E66","#FFFFFF"],["adventure","#7FD4BE",INK],["together","#EA8FBF","#FFFFFF"],["weekend","#EDCB63",INK],["memories","#E2726A","#FFFFFF"],["home sweet home","#8CC8F0",INK]].forEach(([t,bg,fg],i)=>
  addSt("b"+i,"Banners",.3,(x,W,H)=>{const n=W*.07;x.fillStyle=bg;x.beginPath();x.moveTo(0,0);x.lineTo(W,0);x.lineTo(W-n,H/2);x.lineTo(W,H);x.lineTo(0,H);x.lineTo(n,H/2);x.closePath();x.fill();
    x.save();x.globalAlpha=.5;x.setLineDash([W*.02,W*.018]);x.lineWidth=W*.008;x.strokeStyle=fg;x.strokeRect(n*1.25,H*.14,W-n*2.5,H*.72);x.restore();fitText(x,t,W/2,H/2,W*.72,H*.5,fg,600)}));
[["today","#FFF6E6",INK],["hello","#B9A3DE","#FFFFFF"],["new","#E2726A","#FFFFFF"],["date night","#2F3E66","#FFFFFF"]].forEach(([t,bg,fg],i)=>
  addSt("l"+i,"Labels",.42,(x,W,H)=>{const n=H*.5;x.fillStyle=bg;x.beginPath();x.moveTo(n,0);x.lineTo(W-H*.18,0);x.arcTo(W,0,W,H,H*.18);x.arcTo(W,H,0,H,H*.18);x.lineTo(n,H);x.lineTo(0,H/2);x.closePath();x.fill();
    if(bg==="#FFF6E6")outline(x,W*.5);x.save();x.globalCompositeOperation="destination-out";x.beginPath();x.arc(n*.85,H/2,H*.1,0,Math.PI*2);x.fill();x.restore();fitText(x,t,n+(W-n)/2,H/2,(W-n)*.78,H*.5,fg,600)}));
addSt("heart","Shapes",.9,(x,W,H)=>{x.fillStyle="#E2726A";x.beginPath();x.moveTo(W/2,H*.95);x.bezierCurveTo(-W*.15,H*.5,W*.12,-H*.1,W/2,H*.25);x.bezierCurveTo(W*.88,-H*.1,W*1.15,H*.5,W/2,H*.95);x.fill();
  x.strokeStyle="rgba(255,255,255,.6)";x.lineWidth=W*.05;x.lineCap="round";x.beginPath();x.arc(W*.3,H*.36,W*.12,Math.PI*1.1,Math.PI*1.6);x.stroke()});
addSt("heart2","Shapes",.9,(x,W,H)=>{x.fillStyle="#EA8FBF";x.beginPath();x.moveTo(W/2,H*.95);x.bezierCurveTo(-W*.15,H*.5,W*.12,-H*.1,W/2,H*.25);x.bezierCurveTo(W*.88,-H*.1,W*1.15,H*.5,W/2,H*.95);x.fill()});
addSt("star","Shapes",1,(x,W)=>{x.fillStyle=x.strokeStyle="#EDCB63";x.lineWidth=W*.08;x.lineJoin="round";x.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?W*.2:W*.44;x.lineTo(W/2+Math.cos(a)*r,W*.53+Math.sin(a)*r)}x.closePath();x.fill();x.stroke()});
addSt("spark","Shapes",1,(x,W)=>{x.fillStyle="#8CC8F0";const c=W/2;x.beginPath();const k=W*.1;x.moveTo(c,W*.04);x.quadraticCurveTo(c+k,c-k,W*.96,c);x.quadraticCurveTo(c+k,c+k,c,W*.96);x.quadraticCurveTo(c-k,c+k,W*.04,c);x.quadraticCurveTo(c-k,c-k,c,W*.04);x.fill()});
addSt("arrow","Shapes",.6,(x,W,H)=>{x.strokeStyle=INK;x.lineWidth=W*.035;x.lineCap=x.lineJoin="round";x.beginPath();x.moveTo(W*.05,H*.8);x.bezierCurveTo(W*.3,H*.9,W*.45,H*.2,W*.35,H*.25);x.bezierCurveTo(W*.25,H*.3,W*.4,H*.75,W*.92,H*.35);x.stroke();
  x.beginPath();x.moveTo(W*.78,H*.3);x.lineTo(W*.93,H*.34);x.lineTo(W*.86,H*.5);x.stroke()});
addSt("plane","Icons",.75,(x,W,H)=>{x.fillStyle="#8CC8F0";x.beginPath();x.moveTo(W*.95,H*.08);x.lineTo(W*.05,H*.45);x.lineTo(W*.38,H*.58);x.closePath();x.fill();outline(x,W);
  x.fillStyle="#5FA8D8";x.beginPath();x.moveTo(W*.95,H*.08);x.lineTo(W*.38,H*.58);x.lineTo(W*.45,H*.9);x.lineTo(W*.55,H*.66);x.closePath();x.fill();outline(x,W);
  x.fillStyle="#FFFFFF";x.beginPath();x.moveTo(W*.95,H*.08);x.lineTo(W*.55,H*.66);x.lineTo(W*.8,H*.8);x.closePath();x.fill();outline(x,W)});
addSt("coffee","Icons",.9,(x,W,H)=>{x.fillStyle="#E2726A";x.beginPath();x.ellipse(W*.45,H*.88,W*.4,H*.08,0,0,Math.PI*2);x.fill();outline(x,W);
  x.fillStyle="#FFF6E6";x.beginPath();x.moveTo(W*.15,H*.38);x.lineTo(W*.75,H*.38);x.lineTo(W*.68,H*.82);x.quadraticCurveTo(W*.45,H*.9,W*.22,H*.82);x.closePath();x.fill();outline(x,W);
  x.beginPath();x.arc(W*.78,H*.55,W*.1,-Math.PI*.5,Math.PI*.5);outline(x,W);x.fillStyle="#7A4E36";x.beginPath();x.ellipse(W*.45,H*.4,W*.28,H*.03,0,0,Math.PI*2);x.fill();
  x.strokeStyle=INK;x.lineWidth=W*.03;for(const sx of[.35,.5]){x.beginPath();x.moveTo(W*sx,H*.28);x.bezierCurveTo(W*(sx-.06),H*.2,W*(sx+.06),H*.14,W*sx,H*.05);x.stroke()}});
addSt("pizza","Icons",1,(x,W,H)=>{x.fillStyle="#F6D365";x.beginPath();x.moveTo(W*.5,H*.95);x.lineTo(W*.1,H*.2);x.quadraticCurveTo(W*.5,H*.02,W*.9,H*.2);x.closePath();x.fill();outline(x,W);
  x.fillStyle="#D9A066";x.beginPath();x.moveTo(W*.1,H*.2);x.quadraticCurveTo(W*.5,H*.02,W*.9,H*.2);x.lineTo(W*.84,H*.3);x.quadraticCurveTo(W*.5,H*.14,W*.16,H*.3);x.closePath();x.fill();outline(x,W);
  x.fillStyle="#D9534F";for(const[px,py,r]of[[.38,.38,.07],[.6,.42,.07],[.5,.62,.06]]){x.beginPath();x.arc(W*px,H*py,W*r,0,Math.PI*2);x.fill()}});
addSt("camera","Icons",.72,(x,W,H)=>{x.fillStyle="#8CC8F0";rr(x,W*.05,H*.22,W*.9,H*.7,W*.08);x.fill();outline(x,W);rr(x,W*.18,H*.08,W*.22,H*.18,W*.04);x.fill();outline(x,W);
  x.fillStyle="#FFFFFF";x.beginPath();x.arc(W*.5,H*.57,W*.22,0,Math.PI*2);x.fill();outline(x,W);x.fillStyle=INK;x.beginPath();x.arc(W*.5,H*.57,W*.13,0,Math.PI*2);x.fill();
  x.fillStyle="#FFFFFF";x.beginPath();x.arc(W*.46,H*.52,W*.04,0,Math.PI*2);x.fill();x.fillStyle="#EDCB63";rr(x,W*.74,H*.32,W*.12,H*.1,W*.02);x.fill()});
const catPath=(x,W,H)=>{x.beginPath();x.moveTo(W*.14,H*.12);x.lineTo(W*.36,H*.3);x.quadraticCurveTo(W*.5,H*.26,W*.64,H*.3);x.lineTo(W*.86,H*.12);x.quadraticCurveTo(W*.95,H*.55,W*.85,H*.72);x.quadraticCurveTo(W*.5,H*1.02,W*.15,H*.72);x.quadraticCurveTo(W*.05,H*.55,W*.14,H*.12);x.closePath()};
addSt("cat","Icons",.9,(x,W,H)=>{x.fillStyle="#C9C6C2";catPath(x,W,H);x.fill();
  x.save();catPath(x,W,H);x.clip();x.strokeStyle="#6E6A66";x.lineWidth=W*.045;x.lineCap="round";for(const sx of[.42,.5,.58]){x.beginPath();x.moveTo(W*sx,H*.3);x.lineTo(W*sx,H*.45);x.stroke()}
  for(const sd of[-1,1]){x.beginPath();x.moveTo(W*(.5+sd*.36),H*.55);x.lineTo(W*(.5+sd*.26),H*.57);x.stroke();x.beginPath();x.moveTo(W*(.5+sd*.37),H*.65);x.lineTo(W*(.5+sd*.27),H*.65);x.stroke()}x.restore();
  catPath(x,W,H);outline(x,W);
  for(const sd of[-1,1]){x.fillStyle="#9CC77A";x.beginPath();x.ellipse(W*(.5+sd*.15),H*.55,W*.07,H*.06,0,0,Math.PI*2);x.fill();x.fillStyle=INK;x.beginPath();x.ellipse(W*(.5+sd*.15),H*.55,W*.02,H*.05,0,0,Math.PI*2);x.fill()}
  x.fillStyle="#EA8FBF";x.beginPath();x.moveTo(W*.46,H*.68);x.lineTo(W*.54,H*.68);x.lineTo(W*.5,H*.73);x.closePath();x.fill()});
addSt("sun","Icons",1,(x,W)=>{const c=W/2;x.strokeStyle="#F2A36B";x.lineWidth=W*.06;x.lineCap="round";for(let i=0;i<12;i++){const a=i*Math.PI/6;x.beginPath();x.moveTo(c+Math.cos(a)*W*.33,c+Math.sin(a)*W*.33);x.lineTo(c+Math.cos(a)*W*.46,c+Math.sin(a)*W*.46);x.stroke()}
  x.fillStyle="#EDCB63";x.beginPath();x.arc(c,c,W*.26,0,Math.PI*2);x.fill();x.fillStyle=INK;for(const sd of[-1,1]){x.beginPath();x.arc(c+sd*W*.08,c-W*.03,W*.025,0,Math.PI*2);x.fill()}
  x.strokeStyle=INK;x.lineWidth=W*.025;x.beginPath();x.arc(c,c+W*.02,W*.08,Math.PI*.15,Math.PI*.85);x.stroke()});
addSt("pin","Icons",1.3,(x,W,H)=>{x.fillStyle="#E2726A";x.beginPath();x.arc(W/2,W*.45,W*.4,Math.PI*.82,Math.PI*2.18);x.lineTo(W/2,H*.96);x.closePath();x.fill();outline(x,W);x.fillStyle="#FFFFFF";x.beginPath();x.arc(W/2,W*.45,W*.15,0,Math.PI*2);x.fill();outline(x,W)});
addSt("house","Icons",1,(x,W,H)=>{x.fillStyle="#FFF6E6";x.beginPath();x.rect(W*.18,H*.45,W*.64,H*.48);x.fill();outline(x,W);x.fillStyle="#E2726A";x.beginPath();x.moveTo(W*.08,H*.5);x.lineTo(W*.5,H*.1);x.lineTo(W*.92,H*.5);x.closePath();x.fill();outline(x,W);
  x.fillStyle="#8CC8F0";x.beginPath();x.rect(W*.42,H*.65,W*.16,H*.28);x.fill();outline(x,W);x.beginPath();x.rect(W*.26,H*.55,W*.11,H*.1);x.fill();outline(x,W)});
const STK=Object.fromEntries(STICKERS.map(s=>[s.id,s]));
function stickerCanvas(id,pxW){const st=STK[id];if(!st)return null;pxW=Math.max(16,Math.round(pxW/4)*4);const key=id+"|"+pxW;if(stkCache.has(key))return stkCache.get(key);
  const padd=Math.ceil(pxW*.09),W=pxW,H=pxW*st.ar;const art=cv(W+padd*2,H+padd*2),x=art.getContext("2d");x.translate(padd,padd);st.draw(x,W,H);return cacheSet(stkCache,key,withBorder(art,padd))}
function cutCanvas(id,pxW){const im=imgReady.get(id);if(!im)return null;pxW=Math.max(16,Math.round(pxW/4)*4);const key=id+"|"+pxW;if(cutCache.has(key))return cutCache.get(key);
  const padd=Math.ceil(pxW*.06),W=pxW,H=pxW*im.naturalHeight/im.naturalWidth;const art=cv(W+padd*2,H+padd*2);art.getContext("2d").drawImage(im,padd,padd,W,H);return cacheSet(cutCache,key,withBorder(art,padd))}
function itemCanvas(it,size){if(it.type==="text")return textCanvas(it,it.s*size);if(it.type==="sticker")return stickerCanvas(it.k,it.s*size);if(it.type==="cut")return cutCanvas(it.c,it.s*size);return null}
/* items can sit on a photo and move with it */
function itemPos(it,pg){if(it.a){const c=cellsOf(pg).find(c=>c.ref&&c.ref.p===it.a);if(c)return{x:c.rect.x+it.ax*c.rect.w,y:c.rect.y+it.ay*c.rect.h}}return{x:it.x,y:it.y}}
function reanchor(it,pg){const p=itemPos(it,pg);it.x=p.x;it.y=p.y;const c=cellsOf(pg).find(c=>c.ref&&c.ref.p&&p.x>=c.rect.x&&p.x<=c.rect.x+c.rect.w&&p.y>=c.rect.y&&p.y<=c.rect.y+c.rect.h);
  if(c){it.a=c.ref.p;it.ax=(p.x-c.rect.x)/c.rect.w;it.ay=(p.y-c.rect.y)/c.rect.h}else it.a=null}

/* ---------- page drawing ---------- */
const boxes=new Map();
function drawCover(ctx,im,X,Y,W,H,s){const sc=Math.max(W/im.naturalWidth,H/im.naturalHeight)*(s.z||1);const dw=im.naturalWidth*sc,dh=im.naturalHeight*sc;
  ctx.save();ctx.beginPath();ctx.rect(X,Y,W,H);ctx.clip();ctx.drawImage(im,X-(dw-W)*s.fx,Y-(dh-H)*s.fy,dw,dh);ctx.restore()}
function fits(ph,r){if(!ph)return true;const pr=ph.h/ph.w,sr=r.h/r.w;return Math.abs(Math.log(pr/sr))<0.45}
function drawPage(ctx,size,wk,pg,o={}){ctx.save();ctx.fillStyle="#fff";ctx.fillRect(0,0,size,size);const sel=S.sel;const trayPh=o.preview&&sel.tray?photoById(wk,sel.tray):null;
  for(const c of cellsOf(pg)){const r=c.rect,X=r.x*size,Y=r.y*size,W=r.w*size,H=r.h*size;
    if(c.tile){drawTile(ctx,X,Y,W,H,wk);if(o.preview){ctx.strokeStyle="rgba(0,0,0,.08)";ctx.lineWidth=1;ctx.strokeRect(X+.5,Y+.5,W-1,H-1)}continue}
    const ref=c.ref;const ok=ref.p&&photoById(wk,ref.p);const im=ok&&imgReady.get(ref.p);
    if(im)drawCover(ctx,im,X,Y,W,H,ref);
    else if(o.preview){ctx.fillStyle=ok?"#E9E6E2":"#F1EFEC";ctx.fillRect(X,Y,W,H);ctx.fillStyle="#B9B2AA";ctx.font=`${Math.max(14,size*.04)}px system-ui, sans-serif`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(ok?"…":"+",X+W/2,Y+H/2)}
    if(trayPh&&!ok&&fits(trayPh,r)){const[r1,g1,b1]=hexRgb(wk.color);ctx.fillStyle=`rgba(${r1},${g1},${b1},.35)`;ctx.fillRect(X,Y,W,H)}}
  for(const it of pg.items){const c=itemCanvas(it,size);if(!c)continue;const p=itemPos(it,pg);ctx.save();ctx.translate(p.x*size,p.y*size);ctx.rotate((it.r||0)*Math.PI/180);ctx.drawImage(c,-c.width/2,-c.height/2);ctx.restore();
    if(o.preview)boxes.set(it.id,{hw:c.width/2/size,hh:c.height/2/size})}
  if(o.preview){const lw=Math.max(3,size*.009);
    const cl=cellsOf(pg);const sc=sel.cell!=null&&cl.find(c=>c.key===sel.cell);
    if(sc){const r=sc.rect;ctx.strokeStyle=sel.mode==="adjust"?"#FFFFFF":wk.color;ctx.lineWidth=lw;ctx.setLineDash(sel.mode==="adjust"?[size*.015,size*.01]:[]);ctx.strokeRect(r.x*size+lw/2,r.y*size+lw/2,r.w*size-lw,r.h*size-lw);ctx.setLineDash([])}
    const dc=S.drop&&cl.find(c=>c.key===S.drop);if(dc){const r=dc.rect;ctx.strokeStyle=INK;ctx.lineWidth=lw*1.3;ctx.strokeRect(r.x*size+lw/2,r.y*size+lw/2,r.w*size-lw,r.h*size-lw)}
    if(sel.item){const it=pg.items.find(t=>t.id===sel.item);const b=it&&boxes.get(it.id);if(b){const p=itemPos(it,pg);ctx.save();ctx.translate(p.x*size,p.y*size);ctx.rotate((it.r||0)*Math.PI/180);ctx.strokeStyle=wk.color;ctx.lineWidth=2;ctx.setLineDash([6,4]);ctx.strokeRect(-b.hw*size,-b.hh*size,b.hw*2*size,b.hh*2*size);ctx.restore()}}}
  ctx.restore()}

/* ---------- colour suggestions from photos ---------- */
function suggestColors(wk){let ids=cellsOf(curPage()).map(c=>c.ref&&c.ref.p).filter(Boolean);if(!ids.length)ids=wk.photos.map(p=>p.id);
  const px=[];const c=cv(24,24);const x=c.getContext("2d",{willReadFrequently:true});
  for(const id of ids.slice(0,12)){const im=imgReady.get(id);if(!im)continue;x.drawImage(im,0,0,24,24);const d=x.getImageData(0,0,24,24).data;for(let i=0;i<d.length;i+=4)px.push([d[i],d[i+1],d[i+2]])}
  if(px.length<20)return[];const rnd=mulberry(7);let cs=Array.from({length:7},()=>px[Math.floor(rnd()*px.length)].slice());let cnt=[];
  for(let it=0;it<8;it++){const sum=cs.map(()=>[0,0,0]);cnt=cs.map(()=>0);
    for(const p of px){let bi=0,bd=1e9;cs.forEach((q,j)=>{const dd=(p[0]-q[0])**2+(p[1]-q[1])**2+(p[2]-q[2])**2;if(dd<bd){bd=dd;bi=j}});sum[bi][0]+=p[0];sum[bi][1]+=p[1];sum[bi][2]+=p[2];cnt[bi]++}
    cs=cs.map((q,j)=>cnt[j]?sum[j].map(v=>v/cnt[j]):q)}
  const out=[];cs.map((q,j)=>({hsl:rgbHsl(...q),n:cnt[j]})).filter(o=>o.hsl[1]>0.14&&o.hsl[2]>0.12&&o.hsl[2]<0.95).sort((a,b)=>b.n*(0.4+b.hsl[1])-a.n*(0.4+a.hsl[1]))
    .forEach(o=>{const[hh,s]=o.hsl;if(out.some(e=>Math.min(Math.abs(e.h-hh),360-Math.abs(e.h-hh))<20))return;out.push({h:hh,hex:hslHex(hh,clamp(s*1.05,.42,.72),clamp(o.hsl[2],.62,.72))})});
  return out.slice(0,5).map(o=>o.hex)}

/* ---------- saving to the phone, and undo ---------- */
const saveT=new Map();
const snap=wk=>JSON.stringify({pages:wk.pages,color:wk.color,dates:wk.dates,pair:wk.pair,lang:wk.lang,tileAdj:wk.tileAdj,cuts:wk.cuts});
let undoStack=[],lastSnap=null,lastPush=0;
function resetUndo(){undoStack=[];lastSnap=curWeek()?snap(curWeek()):null;renderUndo()}
function commit(wk,quick,merge){if(S.view==="edit"&&wk===curWeek()){const s=snap(wk);if(s!==lastSnap){if(lastSnap&&!(merge&&Date.now()-lastPush<1500&&undoStack.length)){undoStack.push(lastSnap);if(undoStack.length>60)undoStack.shift()}lastPush=Date.now();lastSnap=s;renderUndo()}}
  scheduleSave(wk,quick)}
function undo(){const wk=curWeek();const prev=undoStack.pop();if(!prev)return;Object.assign(wk,JSON.parse(prev));lastSnap=prev;lastPush=0;S.sel={tray:null,cell:null,mode:null,item:null};
  if(S.pageIdx>=wk.pages.length)S.pageIdx=wk.pages.length-1;scheduleSave(wk);document.documentElement.style.setProperty("--week",wk.color);render();toast("Undone",1200)}
function renderUndo(){const b=$("#undoBtn");if(b)b.disabled=!undoStack.length}
function scheduleSave(wk,quick){const k=keyOf(wk.year,wk.week);S.dirtySinceBackup=true;clearTimeout(saveT.get(k));saveT.set(k,setTimeout(()=>{saveT.delete(k);saveNow(wk)},quick?50:700))}
async function saveNow(wk){await makeThumb(wk);try{await DB.put("weeks",keyOf(wk.year,wk.week),wk);await DB.put("meta","dirty",true)}catch(e){toast("Couldn't save. Your phone may be out of space.",5000)}}
async function flushSaves(){for(const k of[...saveT.keys()]){clearTimeout(saveT.get(k));saveT.delete(k);const wk=S.weeks.get(k);if(wk)await saveNow(wk)}}
async function makeThumb(wk){const pg=wk.pages[0];if(!hasContent({pages:[pg]})){wk.thumb=null;return}try{await ensureImages([pg]);const c=cv(360,360);drawPage(c.getContext("2d"),360,wk,pg);wk.thumb=c.toDataURL("image/jpeg",.78)}catch(e){}}
async function saveSettings(){await DB.put("meta","settings",S.settings)}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")flushSaves()});

/* ---------- backups: whole project or one week ---------- */
async function photoFiles(ids,pb,from,to){const files=[],metas=[];for(let i=0;i<ids.length;i++){const r=await DB.get("photos",ids[i]);if(!r)continue;const ext=r.type==="image/png"?"png":"jpg";
    files.push({name:`photos/${ids[i]}.${ext}`,blob:r.blob,crc:r.crc});if(r.thumb&&r.thumb!==r.blob)files.push({name:`photos/${ids[i]}_thumb.jpg`,blob:r.thumb});
    metas.push({id:ids[i],w:r.w,h:r.h,crc:r.crc,type:r.type||"image/jpeg",ext,cut:!!r.cut});pb&&pb.set(from+(to-from)*i/ids.length,`Collecting photos (${i+1} of ${ids.length})`)}return{files,metas}}
const today=()=>{const d=new Date();return`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
async function saveProject(){await flushSaves();const pb=progressBox("Saving your project");
  try{const weeks=await DB.all("weeks");const{files,metas}=await photoFiles(await DB.keys("photos"),pb,0,.5);
    for(const slot of Object.keys(FONT_SLOTS)){const b=await DB.get("fonts",slot);if(b)files.push({name:`fonts/${slot}.ttf`,blob:b})}
    files.unshift({name:"project.json",blob:new Blob([JSON.stringify({app:"Project Pages",version:2,kind:"project",savedAt:new Date().toISOString(),settings:S.settings,weeks,photos:metas})],{type:"application/json"})});
    const zip=await makeZip(files,(i,n)=>pb.set(.5+i/n*.5,"Packing the backup…"));pb.close();download(zip,`Project Pages backup ${today()}.zip`);
    S.lastBackup=Date.now();S.dirtySinceBackup=false;await DB.put("meta","lastBackup",S.lastBackup);await DB.put("meta","dirty",false);
    toast(`Backup saved to Downloads (${(zip.size/1048576).toFixed(0)} MB)`,4000);if(S.view==="home")render()}
  catch(e){pb.close();toast("Couldn't make the backup. Check that your phone has free space.",5000)}}
async function saveWeekFile(wk){await flushSaves();const pb=progressBox("Saving this week");
  try{const ids=[...wk.photos.map(p=>p.id),...wk.cuts.map(c=>c.id)];const{files,metas}=await photoFiles(ids,pb,0,.8);
    files.unshift({name:"project.json",blob:new Blob([JSON.stringify({app:"Project Pages",version:2,kind:"week",savedAt:new Date().toISOString(),weeks:[wk],photos:metas})],{type:"application/json"})});
    const zip=await makeZip(files);pb.close();download(zip,`Project Pages ${wk.year} ${pageName(wk,0)}.zip`);toast("Week saved to Downloads",3000)}
  catch(e){pb.close();toast("Couldn't save the week. Check that your phone has free space.",5000)}}
async function dropCaches(id){for(const k of[id,"t:"+id]){const u=urlCache.get(k);if(u)URL.revokeObjectURL(u);urlCache.delete(k)}imgCache.delete(id);imgReady.delete(id);cutCache.clear()}
async function restorePhotos(proj,byName,pb,from,to){let i=0;for(const p of proj.photos){const e=byName.get(`photos/${p.id}.${p.ext||"jpg"}`);
    if(e){const type=p.type||"image/jpeg";const b=new Blob([await e.blob()],{type});const te=byName.get(`photos/${p.id}_thumb.jpg`);const t=te?new Blob([await te.blob()],{type:"image/jpeg"}):(type==="image/png"?b:null);
      await DB.put("photos",p.id,{blob:b,thumb:t,w:p.w,h:p.h,crc:p.crc,type,cut:!!p.cut});await dropCaches(p.id)}
    pb.set(from+(to-from)*(++i)/Math.max(1,proj.photos.length),`Restoring photos (${i} of ${proj.photos.length})`)}}
async function loadFile(file){let entries;try{entries=await readZip(file)}catch(e){return toast("That file isn't a Project Pages backup.",4000)}
  const pj=entries.find(e=>e.name==="project.json");if(!pj)return toast("That file isn't a Project Pages backup.",4000);
  let proj;try{proj=JSON.parse(await(await pj.blob()).text())}catch(e){return toast("The backup file is damaged.",4000)}
  const byName=new Map(entries.map(e=>[e.name,e]));const when=proj.savedAt?new Date(proj.savedAt).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"}):"an earlier date";
  if(proj.kind==="week"){const wk=migrate(proj.weeks[0]);const k=keyOf(wk.year,wk.week);const old=S.weeks.get(k);
    if(!await confirmBox(`Load week ${numLabel(wk)}, ${wk.year}?`,old&&hasContent(old)?`This replaces week ${numLabel(wk)} in the app with the version saved on ${when}. All other weeks stay as they are.`:`This adds week ${numLabel(wk)} from ${when}. All other weeks stay as they are.`,"Load week"))return;
    const pb=progressBox("Loading the week");try{await restorePhotos(proj,byName,pb,0,.95);
      if(old){const keep=new Set(proj.photos.map(p=>p.id));for(const id of[...old.photos.map(p=>p.id),...(old.cuts||[]).map(c=>c.id)])if(!keep.has(id))await dropBlob(id)}
      S.weeks.set(k,wk);await saveNow(wk);pb.close();S.view="home";render();toast(`Week ${numLabel(wk)} loaded`,3000)}catch(e){pb.close();toast("Loading stopped partway. Try again.",5000)}return}
  if(!await confirmBox("Replace everything?",`This replaces all pages and photos in the app with the backup from ${when} (${proj.weeks.length} weeks, ${proj.photos.length} photos).`,"Replace",true))return;
  const pb=progressBox("Loading your project");
  try{await DB.clear("weeks");await DB.clear("photos");await DB.clear("fonts");for(const u of urlCache.values())u&&URL.revokeObjectURL(u);urlCache.clear();imgCache.clear();imgReady.clear();cutCache.clear();
    await restorePhotos(proj,byName,pb,0,.9);for(const w of proj.weeks)await DB.put("weeks",keyOf(w.year,w.week),migrate(w));
    for(const slot of Object.keys(FONT_SLOTS)){const e=byName.get(`fonts/${slot}.ttf`);if(e){const b=new Blob([await e.blob()],{type:"font/ttf"});await DB.put("fonts",slot,b);try{await activateFont(slot,await b.arrayBuffer())}catch(x){}}}
    if(proj.settings){S.settings={...S.settings,...proj.settings};await saveSettings()}
    pb.close();S.weeks=new Map((await DB.all("weeks")).map(w=>[keyOf(w.year,w.week),migrate(w)]));S.dirtySinceBackup=false;await DB.put("meta","dirty",false);S.view="home";render();toast("Project loaded",3000)}
  catch(e){pb.close();toast("Loading stopped partway. Try loading the backup again.",5000)}}

/* ---------- export images ---------- */
async function renderFull(wk,i,size=3600){await document.fonts.ready;await ensureImages([wk.pages[i]]);const c=cv(size,size);drawPage(c.getContext("2d"),size,wk,wk.pages[i]);
  const b=await toBlob(c,"image/jpeg",.92);c.width=c.height=1;return b}
async function exportOne(wk,i){toast("Making the print file…",0);try{const b=await renderFull(wk,i);download(b,`${wk.year} ${pageName(wk,i)}.jpg`);toast("Saved to Downloads")}catch(e){toast("Couldn't make the image. Try again.",4000)}}
async function exportTile(wk){await document.fonts.ready;const c=cv(1800,1800);drawTile(c.getContext("2d"),0,0,1800,1800,wk);
  try{download(await toBlob(c,"image/png"),`${wk.year} ${pageName(wk,0)} tile.png`);toast("Week tile saved to Downloads")}catch(e){toast("Couldn't make the image. Try again.",4000)}}
async function exportRange(a,b){if(a>b)[a,b]=[b,a];await flushSaves();const list=[...S.weeks.values()].filter(w=>w.year===S.year&&w.week>=a&&w.week<=b).sort((x,y)=>x.week-y.week);
  const jobs=list.flatMap(wk=>wk.pages.map((_,i)=>({wk,i})).filter(j=>hasContent({pages:[j.wk.pages[j.i]]})));
  if(!jobs.length)return toast("No finished pages in those weeks yet.");const pb=progressBox("Exporting pages");
  try{const files=[];for(let n=0;n<jobs.length;n++){const j=jobs[n];pb.set(n/jobs.length*.9,`${pageName(j.wk,j.i)} (${n+1} of ${jobs.length})`);files.push({name:`${j.wk.year} ${pageName(j.wk,j.i)}.jpg`,blob:await renderFull(j.wk,j.i)})}
    pb.set(.95,"Packing the zip…");const zip=await makeZip(files);pb.close();download(zip,`${S.year} pages, weeks ${a}-${b}.zip`);toast(`Saved ${jobs.length} pages to Downloads`,3500)}
  catch(e){pb.close();toast("Export stopped. Try fewer weeks at a time.",5000)}}

/* ---------- home ---------- */
const app=$("#app");
function render(){app.innerHTML="";if(S.view==="home")renderHome();else renderEditor()}
function tileThumb(wk,colr){const c=cv(220,220);c.setAttribute("aria-hidden","true");const x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,220,220);drawTile(x,0,0,220,220,wk,colr);return c}
function ago(t){if(!t)return"never";const d=Math.floor((Date.now()-t)/864e5);return d<1?"today":d===1?"yesterday":`${d} days ago`}
const seg=(opts,cur,on)=>h("div",{class:"seg"},opts.map(([v,l,dis])=>h("button",{"aria-pressed":String(cur===v),disabled:!!dis,onclick:()=>on(v)},l)));
function renderHome(){const y=S.year,n=weeksInYear(y);document.documentElement.style.setProperty("--week","#E2726A");
  app.append(h("header",{class:"top"},h("div",{class:"grow"},h("h1",{},`${y}`),h("div",{class:"sub"},"Your weekly pages")),
    h("button",{class:"iconbtn","aria-label":"Previous year",onclick:()=>{S.year--;render()}},"‹"),h("button",{class:"iconbtn","aria-label":"Next year",onclick:()=>{S.year++;render()}},"›")));
  const home=h("main",{class:"home"});app.append(home);
  if(!S.loaded)home.append(h("div",{class:"banner"},"Opening your pages…"));
  if(S.loaded&&Object.keys(FONT_SLOTS).some(k=>!S.fonts[k]))home.append(h("div",{class:"banner warn"},"Add your Market Fresh and Jonathan Signature fonts so the week tiles look like yours. ",h("a",{href:"#fonts",style:"color:inherit;font-weight:600"},"Add fonts")));
  if(S.loaded&&S.weeks.size&&S.dirtySinceBackup&&(!S.lastBackup||Date.now()-S.lastBackup>7*864e5))home.append(h("div",{class:"banner warn"},`Last backup: ${ago(S.lastBackup)}. `,h("a",{href:"#backup",style:"color:inherit;font-weight:600"},"Back up now")));
  const byDate=h("input",{type:"file",accept:"image/*",multiple:true,hidden:true,id:"byDateIn",onchange:e=>{const fs=[...e.target.files];e.target.value="";addByDate(fs)}});
  home.append(h("div",{class:"stack",style:"margin-bottom:6px"},y===now.y?h("button",{class:"btn wide",onclick:()=>openWeek(now.y,now.w)},`Open this week (week ${now.w})`):null,
    h("button",{class:"btn ghost wide",onclick:()=>byDate.click()},"Add photos to several weeks"),byDate));
  const g=h("div",{class:"grid"});home.append(g);let lastM=-1;
  for(let w=1;w<=n;w++){const prev=S.weeks.get(keyOf(y,w-1)),next=S.weeks.get(keyOf(y,w+1));if((prev&&prev.pair===1)||(next&&next.pair===-1))continue;
    const m=weekStart(y,w);m.setUTCDate(m.getUTCDate()+3);const mo=m.getUTCMonth();if(mo!==lastM){g.append(h("div",{class:"month"},MONTHS.en[mo]));lastM=mo}
    const wk=S.weeks.get(keyOf(y,w));const has=hasContent(wk);const waiting=wk&&!has&&wk.photos.length;const th=h("span",{class:"thumb"});
    if(has&&wk.thumb)th.append(h("img",{src:wk.thumb,alt:""}));else th.append(tileThumb(wk||newWeek(y,w),has?null:"#CFC9C2"));
    g.append(h("button",{class:"cell"+(has?"":" empty")+(y===now.y&&w===now.w?" now":""),onclick:()=>openWeek(y,w),"aria-label":`Week ${wk?numLabel(wk):w}`},th,
      h("span",{class:"lab"},h("b",{},`Week ${wk?numLabel(wk):w}`),wk&&wk.pages.length>1&&has?` · ${wk.pages.length}`:"",waiting?` · ${wk.photos.length} new`:"")))}
  const from=h("select",{id:"exFrom","aria-label":"From week"}),to=h("select",{id:"exTo","aria-label":"To week"});
  for(let w=1;w<=n;w++){from.append(h("option",{value:w},`Week ${w}`));to.append(h("option",{value:w},`Week ${w}`))}from.value=1;to.value=n;
  home.append(h("section",{class:"card"},h("h2",{},"Print files"),h("p",{},`Each page is a 12 × 12 inch image at 300 dpi (3600 × 3600 pixels), named in album order, like “${y} Week 16.jpg” and “${y} Week 16.2.jpg”.`),
    h("div",{class:"row"},from,h("span",{class:"hint",style:"margin:0"},"to"),to),h("button",{class:"btn wide",style:"margin-top:10px",onclick:()=>exportRange(+from.value,+to.value)},"Download pages as zip")));
  const ld=h("input",{type:"file",accept:".zip,application/zip",hidden:true,id:"loadIn",onchange:e=>{const f=e.target.files[0];e.target.value="";if(f)loadFile(f)}});
  home.append(h("section",{class:"card",id:"backup"},h("h2",{},"Backup"),
    h("p",{},`Your pages and photos live only in this app on this phone. Save a backup now and then and keep it somewhere safe, such as Google Drive. Last backup: ${ago(S.lastBackup)}.`),
    h("div",{class:"stack"},h("button",{class:"btn wide",onclick:saveProject},"Save project"),h("button",{class:"btn ghost wide",onclick:()=>ld.click()},"Load project or a week")),ld,
    h("p",{class:"hint",style:"margin-top:10px"},"A saved week only replaces that one week. A full project replaces everything.")));
  home.append(h("section",{class:"card"},h("h2",{},"Week tile language"),h("p",{},"Used for every week unless you change it inside a week."),
    seg([["en","English: Week"],["de","Deutsch: Woche"]],S.settings.lang||"en",v=>{S.settings.lang=v;saveSettings();render()})));
  const fi=h("input",{type:"file",accept:".zip,.ttf,.otf",multiple:true,hidden:true,id:"fontIn",onchange:e=>{const fs=[...e.target.files];e.target.value="";addFontFiles(fs)}});
  home.append(h("section",{class:"card",id:"fonts"},h("h2",{},"Your fonts"),
    h("p",{},"Pick the font zip files you downloaded from dafont (market_fresh.zip and jonathan_signature.zip). They stay in this app on your phone."),
    ...Object.entries(FONT_SLOTS).map(([k,f])=>h("div",{class:"fontrow"+(S.fonts[k]?" ok":"")},h("span",{},f.label),h("span",{},S.fonts[k]?"Added":"Missing"))),
    h("button",{class:"btn ghost wide",style:"margin-top:12px",onclick:()=>fi.click()},"Add font files"),fi));
  home.append(h("p",{class:"hint",style:"margin-top:16px;text-align:center"},S.offlineReady?"Works offline. Nothing leaves your phone.":"Nothing leaves your phone."))}
function openWeek(y,w,noHist){const k=keyOf(y,w);if(!S.weeks.has(k))S.weeks.set(k,newWeek(y,w));S.cur=k;S.pageIdx=0;S.view="edit";S.sel={tray:null,cell:null,mode:null,item:null};S.tab="photos";S.trayEdit=false;S.cutEdit=false;S.pickCut=false;S.suggest=[];
  if(!noHist)history.pushState({w:k},"");const wk=curWeek();[...wk.photos.map(p=>p.id),...wk.cuts.map(c=>c.id)].forEach(id=>loadImg(id).then(()=>{refreshSuggest();cutCache.clear();drawStage()}).catch(()=>{}));render();resetUndo()}
function goHome(){const wk=curWeek();if(wk)scheduleSave(wk,true);S.view="home";render()}
window.addEventListener("popstate",()=>{if(S.skipPop){S.skipPop=false;return}if($(".trace")){$(".trace").remove();return}if(S.view==="edit")goHome()});

/* ---------- editor ---------- */
let cvs=null,ctx=null,ro=null;
const TABS=[["layout","Layout"],["photos","Photos"],["tile","Week"],["text","Text"],["stickers","Stickers"],["save","Save"]];
function renderEditor(){const wk=curWeek();document.documentElement.style.setProperty("--week",wk.color);
  app.append(h("header",{class:"top"},h("button",{class:"iconbtn","aria-label":"Back to all weeks",onclick:()=>history.back()},"‹"),
    h("div",{class:"grow"},h("h1",{},`Week ${numLabel(wk)}`),h("div",{class:"sub"},datesOf(wk))),
    h("button",{class:"iconbtn",id:"undoBtn","aria-label":"Undo",disabled:!undoStack.length,onclick:undo},"↶ Undo")));
  const ed=h("main",{class:"editor"});app.append(ed);
  const pages=h("div",{class:"pages","aria-label":"Pages this week"});
  wk.pages.forEach((p,i)=>pages.append(h("button",{class:"chip","aria-pressed":String(i===S.pageIdx),onclick:()=>{S.pageIdx=i;S.sel={tray:null,cell:null,mode:null,item:null};render()}},i?`${numLabel(wk)}.${i+1}`:`${numLabel(wk)}`)));
  pages.append(h("button",{class:"chip",onclick:()=>{wk.pages.push(newPage("g9",false));S.pageIdx=wk.pages.length-1;commit(wk);render()}},"+ Page"));ed.append(pages);
  const stage=h("div",{class:"stage",id:"stage"});ed.append(stage);
  cvs=h("canvas",{"aria-label":"Page preview. Tap a spot to place or edit a photo."});ctx=cvs.getContext("2d");stage.append(cvs);bindCanvas();
  const dock=h("div",{class:"dock"});ed.append(dock);dock.append(h("div",{id:"slotbar"}));
  dock.append(h("div",{class:"tabs",role:"tablist",id:"tabs"}),h("section",{class:"panel",id:"panel"}));renderTabs();renderPanel();renderSlotbar();
  ro?.disconnect();ro=new ResizeObserver(sizeCanvas);ro.observe(stage);sizeCanvas()}
function renderTabs(){const t=$("#tabs");if(!t)return;t.innerHTML="";for(const[k,l]of TABS)t.append(h("button",{role:"tab","aria-selected":String(S.tab===k),onclick:()=>setTab(k)},l))}
function setTab(k){S.tab=k;S.pickCut=false;if(k!=="text"&&k!=="stickers")S.sel.item=null;else{const it=curPage().items.find(i=>i.id===S.sel.item);if(it&&((k==="text")!==(it.type==="text")))S.sel.item=null}renderTabs();renderPanel();drawStage()}
function sizeCanvas(){const st=$("#stage");if(!st||!cvs)return;const r=st.getBoundingClientRect();const css=Math.max(160,Math.floor(Math.min(r.width,r.height)));const dpr=Math.min(3,window.devicePixelRatio||1);
  cvs.style.width=cvs.style.height=css+"px";const px=Math.round(css*dpr);if(cvs.width!==px){cvs.width=cvs.height=px}drawStage()}
let raf=0;function drawStage(){if(!cvs||S.view!=="edit")return;cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>drawPage(ctx,cvs.width,curWeek(),curPage(),{preview:true}))}
const cellByKey=key=>cellsOf(curPage()).find(c=>c.key===key);
function renderSlotbar(){const bar=$("#slotbar");if(!bar)return;bar.innerHTML="";const sel=S.sel,pg=curPage(),wk=curWeek();
  if(sel.mode==="swap"){bar.append(h("div",{class:"slotbar"},h("span",{class:"t"},"Tap the spot to swap with"),h("button",{onclick:clearSel},"Cancel")));return}
  if(sel.mode==="tile"){bar.append(h("div",{class:"slotbar"},h("span",{class:"t"},"Tap where the week tile should go"),h("button",{onclick:clearSel},"Cancel")));return}
  if(sel.mode==="split"){const c=cellByKey(sel.cell);if(!c){clearSel();return}const cur=pg.slots[c.i].split;const b=h("div",{class:"slotbar"},h("span",{class:"t"},"Split this spot"));
    for(const[v,l]of[[null,"Whole"],["h2","2 side by side"],["v2","2 stacked"],["g4","4"]])b.append(h("button",{class:cur===v?"on":"",onclick:()=>setSplit(c.i,v)},l));b.append(h("button",{onclick:clearSel,"aria-label":"Close"},"✕"));bar.append(b);return}
  if(sel.cell==null)return;const c=cellByKey(sel.cell);if(!c){S.sel.cell=null;return}const b=h("div",{class:"slotbar"});
  if(sel.mode==="adjust"){b.append(h("span",{class:"t"},"Drag the photo to move it. Zoom:"),
      h("input",{type:"range",min:"1",max:"2.5",step:"0.01",value:String(c.ref.z||1),"aria-label":"Zoom",oninput:e=>{c.ref.z=+e.target.value;drawStage()},onchange:()=>commit(wk)}),
      h("button",{class:"on",onclick:()=>{S.sel.mode=null;commit(wk);renderSlotbar();drawStage()}},"Done"));bar.append(b);return}
  b.append(h("span",{class:"t"},c.tile?"Week tile":c.ref.p?"Photo":"Empty spot"));
  if(!c.tile&&c.ref.p)b.append(h("button",{onclick:()=>{S.sel.mode="adjust";renderSlotbar();drawStage()}},"Adjust"));
  if(!c.tile)b.append(h("button",{onclick:()=>{S.sel.mode="split";renderSlotbar()}},"Split"));
  if(c.tile||c.ref.p)b.append(h("button",{onclick:()=>{S.sel.mode="swap";renderSlotbar()}},"Swap"));
  if(!c.tile&&c.k==null)b.append(h("button",{onclick:()=>moveTile(c.i)},"Tile here"));
  if(!c.tile&&c.ref.p)b.append(h("button",{onclick:()=>{c.ref.p=null;commit(wk);clearSel();renderPanel()}},"Remove"));
  if(c.tile)b.append(h("button",{onclick:()=>{pg.tile=null;commit(wk);clearSel();renderPanel()}},"Hide tile"));
  b.append(h("button",{onclick:clearSel,"aria-label":"Close"},"✕"));bar.append(b)}
function clearSel(){S.sel.cell=null;S.sel.mode=null;renderSlotbar();drawStage()}
function moveTile(i){const pg=curPage(),wk=curWeek();const old=pg.tile;if(old!=null&&old!==i){const a=pg.slots[old];pg.slots[old]=pg.slots[i];pg.slots[i]=a}pg.tile=i;S.sel.cell=null;S.sel.mode=null;commit(wk);renderSlotbar();renderPanel();drawStage()}
function placePhoto(c,id){const wk=curWeek();if(c.tile)return toast("That spot holds the week tile. Swap it first.");Object.assign(c.ref,{p:id,fx:.5,fy:.5,z:1});S.sel.tray=null;commit(wk);renderPanel();refreshSuggest();drawStage()}
function swapCells(a,b){const wk=curWeek();if(a.key===b.key)return;
  if(a.tile||b.tile){if(a.k!=null||b.k!=null)return toast("The week tile needs a whole spot.");moveTile(a.tile?b.i:a.i);return}
  for(const f of["p","fx","fy","z"]){const t=a.ref[f];a.ref[f]=b.ref[f];b.ref[f]=t}commit(wk);drawStage()}
function setSplit(i,mode){const pg=curPage(),wk=curWeek();const s=pg.slots[i];const photos=(s.split?s.subs:[s]).filter(x=>x&&x.p).map(x=>({p:x.p,fx:x.fx,fy:x.fy,z:x.z}));
  const n=mode?SPLITS[mode].length:1;if(!mode)pg.slots[i]={...(photos[0]||emptyRef()),split:null};else pg.slots[i]={...emptyRef(),split:mode,subs:SPLITS[mode].map((_,k)=>photos[k]?{...photos[k],fx:.5,fy:.5,z:1}:emptyRef())};
  if(photos.length>n)toast(`${photos.length-n} photo${photos.length-n===1?"":"s"} went back to the tray`);S.sel.cell=mode?i+".0":String(i);S.sel.mode=null;commit(wk);renderSlotbar();renderPanel();drawStage()}

/* canvas: tap, drag photos between spots, move items, pinch to resize and rotate */
function pt(e){const r=cvs.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height}}
function hitCell(p){return cellsOf(curPage()).find(c=>p.x>=c.rect.x&&p.x<=c.rect.x+c.rect.w&&p.y>=c.rect.y&&p.y<=c.rect.y+c.rect.h)||null}
function hitItem(p){const pg=curPage();for(let k=pg.items.length-1;k>=0;k--){const it=pg.items[k],b=boxes.get(it.id);if(!b)continue;const q=itemPos(it,pg);const a=-(it.r||0)*Math.PI/180,dx=p.x-q.x,dy=p.y-q.y;
  const lx=dx*Math.cos(a)-dy*Math.sin(a),ly=dx*Math.sin(a)+dy*Math.cos(a);if(Math.abs(lx)<=b.hw&&Math.abs(ly)<=b.hh)return it}return null}
function selectItem(it){S.sel.item=it.id;S.sel.cell=null;S.sel.mode=null;S.sel.tray=null;renderSlotbar();const want=it.type==="text"?"text":"stickers";if(S.tab!==want){S.tab=want;renderTabs()}renderPanel()}
function bindCanvas(){const ptrs=new Map();let g=null,ghost=null;
  const two=()=>{const v=[...ptrs.values()];return{d:Math.hypot(v[1].x-v[0].x,v[1].y-v[0].y),a:Math.atan2(v[1].y-v[0].y,v[1].x-v[0].x)}};
  cvs.addEventListener("pointerdown",e=>{const p=pt(e);ptrs.set(e.pointerId,p);try{cvs.setPointerCapture(e.pointerId)}catch(x){}const pg=curPage();
    if(ptrs.size===2){const it=pg.items.find(i=>i.id===S.sel.item);if(it){const t=two();const q=itemPos(it,pg);it.a=null;it.x=q.x;it.y=q.y;g={kind:"pinch",it,d0:t.d,a0:t.a,s0:it.s,r0:it.r||0}}else g=null;ghost?.remove();ghost=null;S.drop=null;return}
    if(ptrs.size>2)return;
    if(S.sel.tray){const c=hitCell(p);if(c)placePhoto(c,S.sel.tray);else{S.sel.tray=null;renderPanel();drawStage()}g=null;return}
    if(S.sel.mode==="tile"){const c=hitCell(p);if(c&&c.k==null)moveTile(c.i);else if(c)toast("The week tile needs a whole spot.");g=null;return}
    if(S.sel.mode==="adjust"){const c=hitCell(p);if(c&&c.key===S.sel.cell){g={kind:"pan",c,last:p};return}S.sel.mode=null}
    if(S.sel.mode==="swap"&&S.sel.cell!=null){const a=cellByKey(S.sel.cell),b=hitCell(p);if(a&&b)swapCells(a,b);clearSel();g=null;return}
    const it=hitItem(p);if(it){selectItem(it);const q=itemPos(it,pg);g={kind:"item",it,ox:q.x-p.x,oy:q.y-p.y,moved:false};drawStage();return}
    const c=hitCell(p);if(!c){S.sel.item=null;clearSel();renderPanel();g=null;return}
    g={kind:"cell",c,start:p,cx:e.clientX,cy:e.clientY}});
  cvs.addEventListener("pointermove",e=>{if(!ptrs.has(e.pointerId))return;const p=pt(e);ptrs.set(e.pointerId,p);if(!g)return;const pg=curPage();
    if(g.kind==="pinch"&&ptrs.size>=2){const t=two();g.it.s=clamp(g.s0*t.d/g.d0,.02,.8);g.it.r=Math.round((g.r0+(t.a-g.a0)*180/Math.PI+540)%360-180);drawStage()}
    else if(g.kind==="item"){const q=itemPos(g.it,pg);if(!g.moved&&Math.hypot(p.x+g.ox-q.x,p.y+g.oy-q.y)<.005)return;g.moved=true;g.it.a=null;g.it.x=clamp(p.x+g.ox,0,1);g.it.y=clamp(p.y+g.oy,0,1);drawStage()}
    else if(g.kind==="pan"){const ref=g.c.ref;const im=imgReady.get(ref.p);if(!im)return;const r=g.c.rect;const sc=Math.max(r.w/im.naturalWidth,r.h/im.naturalHeight)*(ref.z||1);
      const ovx=im.naturalWidth*sc-r.w,ovy=im.naturalHeight*sc-r.h;if(ovx>1e-6)ref.fx=clamp(ref.fx-(p.x-g.last.x)/ovx,0,1);if(ovy>1e-6)ref.fy=clamp(ref.fy-(p.y-g.last.y)/ovy,0,1);g.last=p;drawStage()}
    else if(g.kind==="cell"){if(Math.hypot(e.clientX-g.cx,e.clientY-g.cy)<12)return;if(!(g.c.tile||g.c.ref.p)){g=null;return}g.kind="drag";
      const gc=cv(84,84),gx=gc.getContext("2d");const im=g.c.ref&&imgReady.get(g.c.ref.p);if(im)drawCover(gx,im,0,0,84,84,g.c.ref);else drawTile(gx,0,0,84,84,curWeek());ghost=gc;gc.className="dragghost";document.body.append(gc);S.sel.cell=null;renderSlotbar()}
    if(g&&g.kind==="drag"){ghost.style.left=e.clientX+"px";ghost.style.top=e.clientY+"px";const t=hitCell(p);const k=t&&t.key!==g.c.key?t.key:null;if(k!==S.drop){S.drop=k;drawStage()}}});
  const up=e=>{const p=ptrs.get(e.pointerId)||pt(e);ptrs.delete(e.pointerId);if(!g)return;const pg=curPage(),wk=curWeek();
    if(g.kind==="pinch"){if(ptrs.size<2){reanchor(g.it,pg);commit(wk);renderPanel();g=null}return}
    if(g.kind==="item"){if(g.moved){reanchor(g.it,pg);commit(wk)}}
    else if(g.kind==="pan")commit(wk);
    else if(g.kind==="cell"){S.sel.item=null;S.sel.cell=g.c.key;S.sel.mode=null;renderSlotbar();if(S.tab==="text"||S.tab==="stickers")renderPanel();drawStage()}
    else if(g.kind==="drag"){ghost?.remove();ghost=null;S.drop=null;const t=hitCell(p);if(t)swapCells(g.c,t);drawStage()}
    g=null};
  cvs.addEventListener("pointerup",up);cvs.addEventListener("pointercancel",e=>{ptrs.delete(e.pointerId);ghost?.remove();ghost=null;S.drop=null;if(g&&(g.kind==="item"||g.kind==="pinch")){reanchor(g.it,curPage());commit(curWeek())}g=null;drawStage()})}
function bindTrayDrag(btn,ph,img){let st=null,ghost=null;
  btn.addEventListener("pointerdown",e=>{st={x:e.clientX,y:e.clientY,id:e.pointerId}});
  btn.addEventListener("pointermove",e=>{if(!st)return;const dx=e.clientX-st.x,dy=e.clientY-st.y;
    if(!ghost&&dy<-14&&Math.abs(dy)>Math.abs(dx)*1.2){try{btn.setPointerCapture(st.id)}catch(x){}ghost=h("img",{class:"dragghost",src:img.src,alt:""});document.body.append(ghost)}
    if(ghost){ghost.style.left=e.clientX+"px";ghost.style.top=e.clientY+"px";const r=cvs.getBoundingClientRect();const t=hitCell({x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height});const k=t?t.key:null;if(k!==S.drop){S.drop=k;drawStage()}}});
  btn.addEventListener("pointerup",e=>{if(ghost){ghost.remove();ghost=null;S.drop=null;const r=cvs.getBoundingClientRect();
      if(e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom){const c=hitCell({x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height});if(c)placePhoto(c,ph.id)}else drawStage();
      btn.dataset.dragged="1";setTimeout(()=>delete btn.dataset.dragged,60)}st=null});
  btn.addEventListener("pointercancel",()=>{ghost?.remove();ghost=null;st=null;S.drop=null})}

/* ---------- cut-outs: trace around something in a photo ---------- */
function chaikin(pts,n){for(let k=0;k<n;k++){const o=[];for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];o.push([a[0]*.75+b[0]*.25,a[1]*.75+b[1]*.25],[a[0]*.25+b[0]*.75,a[1]*.25+b[1]*.75])}pts=o}return pts}
async function traceCutout(ph){let im;try{im=await loadImg(ph.id)}catch(e){return toast("Couldn't open that photo.")}
  const wrap=h("div",{class:"tc"}),c=h("canvas",{"aria-label":"Draw around what you want to cut out"});wrap.append(c);const x=c.getContext("2d");let pts=[],closed=false;
  const useBtn=h("button",{class:"btn",disabled:true,onclick:()=>finish()},"Use cut-out");
  const ov=h("div",{class:"trace",role:"dialog","aria-modal":"true"},h("p",{class:"tt"},"Draw around what you want to cut out with your finger. It doesn't have to be exact."),wrap,
    h("div",{class:"bar"},h("button",{class:"btn ghost",onclick:()=>close()},"Cancel"),h("button",{class:"btn ghost",onclick:()=>{pts=[];closed=false;useBtn.disabled=true;draw()}},"Redo"),useBtn));
  document.body.append(ov);history.pushState({trace:1},"");const close=()=>{if(ov.isConnected){ov.remove();S.skipPop=true;history.back()}};
  const fit=()=>{const r=wrap.getBoundingClientRect();const k=Math.min(r.width/im.naturalWidth,r.height/im.naturalHeight);const dpr=Math.min(2,window.devicePixelRatio||1);
    c.style.width=im.naturalWidth*k+"px";c.style.height=im.naturalHeight*k+"px";c.width=Math.round(im.naturalWidth*k*dpr);c.height=Math.round(im.naturalHeight*k*dpr);draw()};
  const path=q=>{q.beginPath();pts.forEach((p,i)=>i?q.lineTo(p[0],p[1]):q.moveTo(p[0],p[1]));if(closed)q.closePath()};
  const draw=()=>{const sx=c.width/im.naturalWidth;x.clearRect(0,0,c.width,c.height);x.drawImage(im,0,0,c.width,c.height);if(pts.length<2)return;
    x.save();x.scale(sx,sx);if(closed){x.fillStyle="rgba(0,0,0,.55)";x.beginPath();x.rect(0,0,im.naturalWidth,im.naturalHeight);pts.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1]));x.closePath();x.fill("evenodd")}
    path(x);x.lineJoin=x.lineCap="round";x.lineWidth=7/sx;x.strokeStyle="rgba(0,0,0,.5)";x.stroke();x.lineWidth=3.5/sx;x.strokeStyle="#FFFFFF";x.stroke();x.restore()};
  const ip=e=>{const r=c.getBoundingClientRect();return[(e.clientX-r.left)/r.width*im.naturalWidth,(e.clientY-r.top)/r.height*im.naturalHeight]};
  let drawing=false;c.addEventListener("pointerdown",e=>{c.setPointerCapture(e.pointerId);drawing=true;pts=[ip(e)];closed=false;useBtn.disabled=true;draw()});
  c.addEventListener("pointermove",e=>{if(!drawing)return;const q=ip(e),l=pts[pts.length-1];if(Math.hypot(q[0]-l[0],q[1]-l[1])>im.naturalWidth/300){pts.push(q);draw()}});
  c.addEventListener("pointerup",()=>{drawing=false;if(pts.length>=8){closed=true;useBtn.disabled=false}else pts=[];draw()});
  requestAnimationFrame(fit);
  async function finish(){useBtn.disabled=true;const sm=chaikin(pts,2);let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const[a,b]of sm){x0=Math.min(x0,a);y0=Math.min(y0,b);x1=Math.max(x1,a);y1=Math.max(y1,b)}
    x0=Math.max(0,x0);y0=Math.max(0,y0);x1=Math.min(im.naturalWidth,x1);y1=Math.min(im.naturalHeight,y1);const k=Math.min(1,1400/Math.max(x1-x0,y1-y0));
    const o=cv((x1-x0)*k,(y1-y0)*k),q=o.getContext("2d");q.scale(k,k);q.translate(-x0,-y0);q.beginPath();sm.forEach((p,i)=>i?q.lineTo(p[0],p[1]):q.moveTo(p[0],p[1]));q.closePath();q.clip();q.drawImage(im,0,0);
    const blob=await toBlob(o,"image/png");const id=uid();await DB.put("photos",id,{blob,thumb:blob,w:o.width,h:o.height,crc:await crcBlob(blob),type:"image/png",cut:true});
    const wk=curWeek();wk.cuts.push({id,w:o.width,h:o.height});await loadImg(id);close();addItem({type:"cut",c:id,s:.28})}}

/* ---------- panels ---------- */
function refreshSuggest(){if(S.view!=="edit")return;const s=suggestColors(curWeek());if(s.join()!==S.suggest.join()){S.suggest=s;if(S.tab==="tile")renderPanel()}}
function layoutSvg(L,mirror){return`<svg viewBox="0 0 100 100" aria-hidden="true"><rect width="100" height="100" fill="#fff"/>${slotRects(L.id,mirror).map((r,i)=>`<rect x="${r.x*100}" y="${r.y*100}" width="${r.w*100}" height="${r.h*100}" fill="${i===L.tileIdx?"var(--week)":"#CFC8C0"}"/>`).join("")}</svg>`}
function setLayout(id){const pg=curPage(),wk=curWeek();if(pg.layout===id)return;const contents=cellsOf(pg).filter(c=>c.ref&&c.ref.p).map(c=>({p:c.ref.p,fx:c.ref.fx,fy:c.ref.fy,z:c.ref.z}));const hadTile=pg.tile!=null;
  const np=newPage(id,hadTile);if(hadTile&&np.tile==null)np.tile=0;let k=0;np.slots.forEach((s,i)=>{if(i!==np.tile&&k<contents.length)np.slots[i]={...contents[k++],split:null}});
  np.mirror=pg.mirror;np.items=pg.items;wk.pages[S.pageIdx]=np;S.sel.cell=null;S.sel.mode=null;
  if(k<contents.length)toast(`${contents.length-k} photo${contents.length-k===1?"":"s"} went back to the tray`);commit(wk);renderPanel();renderSlotbar();drawStage()}
function fillForMe(){const pg=curPage(),wk=curWeek();const used=new Set(wk.pages.flatMap(p=>cellsOf(p).map(c=>c.ref&&c.ref.p)).filter(Boolean));
  const free=wk.photos.filter(p=>!used.has(p.id));if(!free.length)return toast("All photos in the tray are already on a page.");
  const port=free.filter(p=>p.h>p.w),land=free.filter(p=>p.h<=p.w);let n=0;
  for(const c of cellsOf(pg)){if(c.tile||c.ref.p)continue;const r=c.rect;const want=r.h>r.w*1.1?port:land,other=want===port?land:port;const ph=want.shift()||other.shift();if(ph){Object.assign(c.ref,{p:ph.id,fx:.5,fy:.5,z:1});n++}}
  commit(wk);renderPanel();refreshSuggest();drawStage();toast(n?`Placed ${n} photo${n===1?"":"s"}`:"No empty spots left on this page")}
function setColor(c){const wk=curWeek();wk.color=c.toUpperCase();document.documentElement.style.setProperty("--week",wk.color);commit(wk);renderPanel();drawStage()}
function addItem(base){const wk=curWeek(),pg=curPage();const it={id:"i"+uid(),x:.5,y:.5,r:0,a:null,ax:.5,ay:.5,...base};pg.items.push(it);reanchor(it,pg);S.sel.item=it.id;S.sel.cell=null;S.sel.mode=null;commit(wk);
  const want=it.type==="text"?"text":"stickers";if(S.tab!==want){S.tab=want;renderTabs()}renderSlotbar();renderPanel();drawStage()}
function itemControls(it,doneLabel){const wk=curWeek(),pg=curPage();
  return[h("div",{class:"row",style:"margin-top:4px"},h("label",{class:"field"},"Size",h("input",{type:"range",id:"isize",min:it.type==="text"?"0.02":"0.05",max:it.type==="text"?"0.14":"0.6",step:"0.002",value:String(it.s),oninput:e=>{it.s=+e.target.value;drawStage()},onchange:()=>commit(wk)})),
      h("label",{class:"field"},"Tilt",h("input",{type:"range",id:"itilt",min:"-45",max:"45",step:"1",value:String(clamp(it.r||0,-45,45)),oninput:e=>{it.r=+e.target.value;drawStage()},onchange:()=>commit(wk)}))),
    h("p",{class:"hint",style:"margin:6px 0 0"},"Drag it with one finger. Pinch with two fingers to resize and turn it."),
    h("div",{class:"row",style:"margin-top:10px"},h("button",{class:"btn",onclick:()=>{S.sel.item=null;renderPanel();drawStage()}},doneLabel),
      h("button",{class:"btn ghost",onclick:()=>{pg.items=pg.items.filter(x=>x!==it);pg.items.push(it);commit(wk);drawStage()}},"To front"),
      h("button",{class:"btn ghost",onclick:()=>{pg.items=pg.items.filter(x=>x!==it);S.sel.item=null;commit(wk);renderPanel();drawStage()}},"Delete"))]}
const stkThumbs=new Map();
function stkThumb(id){if(!stkThumbs.has(id)){const c=stickerCanvas(id,64);const t=cv(c.width,c.height);t.getContext("2d").drawImage(c,0,0);stkThumbs.set(id,t)}const s=stkThumbs.get(id);const t=cv(s.width,s.height);t.getContext("2d").drawImage(s,0,0);return t}

function renderPanel(){const el=$("#panel");if(!el)return;const top=el.scrollTop;el.innerHTML="";const wk=curWeek(),pg=curPage();
  if(S.tab==="layout"){el.append(h("p",{class:"hint"},"Pick a layout. Photos you already placed move into the new spots. To put 2 or 4 small photos in one spot, tap the spot and choose Split."));
    const g=h("div",{class:"layouts"});for(const L of RAW){const b=h("button",{class:"lay","aria-pressed":String(pg.layout===L.id),"aria-label":L.name,onclick:()=>setLayout(L.id)});b.innerHTML=layoutSvg(L,pg.mirror);g.append(b)}
    el.append(g,h("label",{class:"toggle",style:"margin-top:8px"},h("input",{type:"checkbox",id:"mirror",checked:pg.mirror,onchange:e=>{pg.mirror=e.target.checked;commit(wk);renderPanel();drawStage()}}),"Mirror left and right"))}
  else if(S.tab==="photos"){const used=new Set();wk.pages.forEach(p=>cellsOf(p).forEach(c=>c.ref&&c.ref.p&&used.add(c.ref.p)));
    const input=h("input",{type:"file",accept:"image/*",multiple:true,hidden:true,id:"fileIn",onchange:e=>{const fs=[...e.target.files];e.target.value="";addPhotos(fs)}});
    el.append(h("p",{class:"hint"},S.sel.tray?"Now tap a spot on the page. Spots that suit this photo's shape are highlighted.":wk.photos.length?"Tap a photo, then tap a spot on the page. Or drag it up onto the page.":"Add this week's photos. You can pick many at once."));
    const tray=h("div",{class:"tray"});tray.append(h("button",{class:"addph",onclick:()=>input.click()},h("b",{},"+"),"Add photos"));
    for(const ph of wk.photos){const u=used.has(ph.id);const ow=otherWeek(wk,ph);const img=h("img",{alt:"",draggable:"false"});thumbURL(ph.id).then(s=>{if(s)img.src=s});
      const wpx=Math.round(84*clamp(ph.w/ph.h,.62,1.6));
      const b=h("button",{class:"ph"+(u?" used":""),style:`width:${wpx}px`,"aria-pressed":String(S.sel.tray===ph.id),"aria-label":`${ph.h>ph.w?"Portrait":"Landscape"} photo${u?", already on a page":""}${ow?`, from week ${ow}`:""}`,
        onclick:()=>{if(b.dataset.dragged||S.trayEdit)return;S.sel.tray=S.sel.tray===ph.id?null:ph.id;S.sel.cell=null;S.sel.mode=null;S.sel.item=null;renderSlotbar();renderPanel();drawStage()}},img,
        u?h("span",{class:"badge"},"on page"):null,ow?h("span",{class:"wkbadge"},`wk ${ow}`):null,
        S.trayEdit?h("span",{class:"x",role:"button","aria-label":"Remove photo",onclick:async e=>{e.stopPropagation();if(await confirmBox("Remove this photo?","It's deleted from the app. The original stays in your gallery.","Remove",true))removePhoto(ph)}},"×"):null);
      if(!S.trayEdit)bindTrayDrag(b,ph,img);tray.append(b)}
    el.append(input,tray,h("div",{class:"row",style:"margin-top:10px"},h("button",{class:"btn ghost",onclick:fillForMe,disabled:!wk.photos.length},"Fill empty spots"),
      wk.photos.length?h("button",{class:"btn ghost",onclick:()=>{S.trayEdit=!S.trayEdit;renderPanel()}},S.trayEdit?"Done":"Remove photos"):null))}
  else if(S.tab==="tile"){const on=pg.tile!=null;
    el.append(h("div",{class:"row"},h("label",{class:"toggle"},h("input",{type:"checkbox",id:"tileOn",checked:on,onchange:e=>{if(e.target.checked){S.sel.mode="tile";S.sel.cell=null;renderSlotbar()}else{pg.tile=null;commit(wk);drawStage()}renderPanel()}}),"Week tile on this page"),
      on?h("button",{class:"btn ghost",onclick:()=>{S.sel.mode="tile";S.sel.cell=null;renderSlotbar()}},"Move"):null));
    const sw=c=>h("button",{class:"sw",style:`background:${c}`,"aria-label":`Colour ${c}`,"aria-pressed":String(wk.color.toUpperCase()===c.toUpperCase()),onclick:()=>setColor(c)});
    el.append(h("div",{class:"lbl"},"From this week's photos"),S.suggest.length?h("div",{class:"swatches"},S.suggest.map(sw)):h("p",{class:"hint"},"Add photos and colours from them show up here."),
      h("div",{class:"lbl"},"Your colours"),h("div",{class:"swatches"},PRESETS.map(sw),h("label",{class:"sw custom","aria-label":"Pick any colour"},h("input",{type:"color",id:"anyCol",value:wk.color.length===7?wk.color.toLowerCase():"#e2726a",onchange:e=>setColor(e.target.value)}))));
    el.append(h("div",{class:"lbl"},"Language"),seg([["en","Week"],["de","Woche"]],langOf(wk),v=>{wk.lang=v===(S.settings.lang||"en")?null:v;commit(wk);renderEditorHead();renderPanel();drawStage()}));
    const[a,b]=span(wk);const auto=dateLabel(wk.year,a,b,langOf(wk));
    el.append(h("div",{class:"lbl"},"Dates"),h("div",{class:"row"},h("input",{type:"text",id:"dates",style:"flex:1;min-width:0",value:wk.dates||auto,"aria-label":"Dates under the number",oninput:e=>{const v=e.target.value.trim();wk.dates=v&&v!==auto?e.target.value:null;drawStage();commit(wk,false,true)}}),
      wk.dates?h("button",{class:"btn ghost",onclick:()=>{wk.dates=null;commit(wk);renderPanel();drawStage()}},"Reset"):null));
    const A=adjOf(wk),P=S.adjPart;const keys=P==="w"?["wx","wy","ws"]:["dx","dy","ds"];
    const setA=(k,v)=>{wk.tileAdj={...adjOf(wk),[k]:v};drawStage()};
    el.append(h("div",{class:"lbl"},"Adjust the tile"),seg([["w",`The word “${langOf(wk)==="de"?"Woche":"Week"}”`],["d","Dates"]],P,v=>{S.adjPart=v;renderPanel()}),
      h("div",{class:"row",style:"margin-top:6px"},h("label",{class:"field"},"Left / right",h("input",{type:"range",id:"adjX",min:"-0.35",max:"0.35",step:"0.005",value:String(A[keys[0]]),oninput:e=>setA(keys[0],+e.target.value),onchange:()=>commit(wk)})),
        h("label",{class:"field"},"Up / down",h("input",{type:"range",id:"adjY",min:"-0.35",max:"0.35",step:"0.005",value:String(A[keys[1]]),oninput:e=>setA(keys[1],+e.target.value),onchange:()=>commit(wk)}))),
      h("label",{class:"field"},"Size",h("input",{type:"range",id:"adjS",min:"0.5",max:"1.8",step:"0.01",value:String(A[keys[2]]),oninput:e=>setA(keys[2],+e.target.value),onchange:()=>commit(wk)})),
      h("div",{class:"row",style:"margin-top:8px"},h("button",{class:"btn ghost",onclick:()=>{wk.tileAdj=null;commit(wk);renderPanel();drawStage()}},"Reset"),
        h("button",{class:"btn ghost",onclick:()=>{S.settings.tileAdj={...adjOf(wk)};saveSettings();wk.tileAdj=null;commit(wk);renderPanel();drawStage();toast("Saved as the default. Weeks you haven't adjusted follow it.",3500)}},"Make this my default")));
    const n=weeksInYear(wk.year);const pk=keyOf(wk.year,wk.week-1),nk=keyOf(wk.year,wk.week+1);
    const blocked=k=>{const o=S.weeks.get(k);return!!o&&(hasContent(o)||o.photos.length>0||!!o.pair)};
    el.append(h("div",{class:"lbl"},"Two weeks on one page"),seg([[0,"Just this week"],[-1,`With week ${wk.week-1}`,wk.week<=1||(wk.pair!==-1&&blocked(pk))],[1,`With week ${wk.week+1}`,wk.week>=n||(wk.pair!==1&&blocked(nk))]],wk.pair||0,
      v=>{wk.pair=v||null;commit(wk,true);render()}),
      (blocked(pk)||blocked(nk))&&!wk.pair?h("p",{class:"hint",style:"margin-top:6px"},"A week that already has photos can't be combined."):null);
    el.append(h("button",{class:"btn ghost wide",style:"margin-top:14px",onclick:()=>exportTile(wk)},"Download week tile"))}
  else if(S.tab==="text"){const t=pg.items.find(i=>i.id===S.sel.item&&i.type==="text");const cur=t||S.textDraft||(S.textDraft={t:"",font:"hand",color:"black",outline:true,s:.05,r:-4});
    const upd=(k,v,merge)=>{cur[k]=v;if(t){commit(wk,false,merge);drawStage()}};
    el.append(h("p",{class:"hint"},t?"Editing the selected text.":"Type a short note and add it. Text you place on a photo moves with that photo."),
      h("textarea",{id:"txt",placeholder:"e.g. Best pizza night",value:cur.t,"aria-label":"Text",oninput:e=>upd("t",e.target.value,true)}));
    el.append(h("div",{class:"row",style:"margin-top:10px"},seg([["hand","Handwritten"],["script","Script"],["clean","Clean"]],cur.font,v=>{upd("font",v);renderPanel()})),
      h("div",{class:"row",style:"margin-top:8px"},seg([["black","Black"],["white","White"]],cur.color,v=>{upd("color",v);renderPanel()}),h("label",{class:"toggle"},h("input",{type:"checkbox",id:"outline",checked:cur.outline,onchange:e=>upd("outline",e.target.checked)}),"Bubble outline")));
    if(t)el.append(...itemControls(t,"Done"));
    else el.append(h("div",{class:"row",style:"margin-top:10px"},h("button",{class:"btn",onclick:()=>{if(!cur.t.trim())return toast("Type some text first");S.textDraft=null;addItem({type:"text",t:cur.t,font:cur.font,color:cur.color,outline:cur.outline,s:cur.s,r:cur.r})}},"Add to page")))}
  else if(S.tab==="stickers"){const it=pg.items.find(i=>i.id===S.sel.item&&i.type!=="text");
    if(it){el.append(h("p",{class:"hint"},it.type==="cut"?"Your cut-out":"Sticker"),...itemControls(it,"Done"));el.scrollTop=0;return}
    el.append(h("p",{class:"hint"},"Tap a sticker to put it on the page. Stickers on a photo move with that photo."));
    el.append(h("div",{class:"lbl"},"Your cut-outs"));const cutRow=h("div",{class:"stickers"});
    cutRow.append(h("button",{class:"stk add",onclick:()=>{if(!wk.photos.length)return toast("Add photos to this week first.");S.pickCut=true;renderPanel()}},h("span",{},"+ Cut out from a photo")));
    for(const ct of wk.cuts){const img=h("img",{alt:"Cut-out"});thumbURL(ct.id).then(s=>{if(s)img.src=s});
      cutRow.append(h("button",{class:"stk","aria-label":S.cutEdit?"Remove cut-out":"Add cut-out",onclick:async()=>{if(S.cutEdit){if(await confirmBox("Remove this cut-out?","It's also taken off any page it's on.","Remove",true)){wk.cuts=wk.cuts.filter(c=>c!==ct);wk.pages.forEach(p=>p.items=p.items.filter(i=>!(i.type==="cut"&&i.c===ct.id)));await dropBlob(ct.id);commit(wk);renderPanel();drawStage()}return}
        await loadImg(ct.id).catch(()=>{});addItem({type:"cut",c:ct.id,s:.28})}},img,S.cutEdit?h("span",{class:"x"},"×"):null))}
    el.append(cutRow);if(wk.cuts.length)el.append(h("button",{class:"btn ghost",style:"margin-top:8px",onclick:()=>{S.cutEdit=!S.cutEdit;renderPanel()}},S.cutEdit?"Done":"Remove cut-outs"));
    if(S.pickCut){el.append(h("div",{class:"lbl"},"Pick the photo to cut from"));const tr=h("div",{class:"tray"});for(const ph of wk.photos){const img=h("img",{alt:""});thumbURL(ph.id).then(s=>{if(s)img.src=s});
        tr.append(h("button",{class:"ph",style:`width:${Math.round(84*clamp(ph.w/ph.h,.62,1.6))}px`,"aria-label":"Cut out from this photo",onclick:()=>{S.pickCut=false;renderPanel();traceCutout(ph)}},img))}
      el.append(tr,h("button",{class:"btn ghost",style:"margin-top:8px",onclick:()=>{S.pickCut=false;renderPanel()}},"Cancel"))}
    for(const cat of["Words","Banners","Labels","Shapes","Icons"]){el.append(h("div",{class:"lbl"},cat));const g=h("div",{class:"stickers"});
      for(const st of STICKERS.filter(s=>s.cat===cat))g.append(h("button",{class:"stk","aria-label":`${cat} sticker`,onclick:()=>addItem({type:"sticker",k:st.id,s:st.cat==="Banners"?.3:st.cat==="Labels"?.22:.16})},stkThumb(st.id)));el.append(g)}}
  else if(S.tab==="save"){el.append(h("p",{class:"hint"},`Saves this page as a 12 × 12 inch print file (3600 × 3600 pixels) named “${wk.year} ${pageName(wk,S.pageIdx)}.jpg” in your Downloads.`),
      h("div",{class:"stack"},h("button",{class:"btn wide",onclick:()=>exportOne(wk,S.pageIdx)},"Download this page"),h("button",{class:"btn ghost wide",onclick:()=>exportTile(wk)},"Download week tile"),
        h("button",{class:"btn ghost wide",onclick:()=>saveWeekFile(wk)},"Save this week as a file")),
      h("p",{class:"hint",style:"margin-top:8px"},"A week file keeps every page editable. Load it again on the start page under Backup."));
    if(wk.pages.length>1)el.append(h("button",{class:"btn ghost wide",style:"margin-top:14px;color:var(--danger)",onclick:async()=>{if(!await confirmBox("Delete this page?","The photos stay in this week's tray.","Delete",true))return;wk.pages.splice(S.pageIdx,1);S.pageIdx=Math.max(0,S.pageIdx-1);commit(wk);render()}},"Delete this page"))}
  el.scrollTop=top}
function renderEditorHead(){const wk=curWeek();const t=$(".top h1"),s=$(".top .sub");if(t)t.textContent=`Week ${numLabel(wk)}`;if(s)s.textContent=datesOf(wk)}

/* ---------- start ---------- */
async function start(){render();
  try{await Promise.all(['700 40px Fredoka','600 40px Fredoka','40px Sacramento','300 40px "Playwrite DE Grund"'].map(f=>document.fonts.load(f)))}catch(e){}
  try{await loadSavedFonts();S.weeks=new Map((await DB.all("weeks")).map(w=>[keyOf(w.year,w.week),migrate(w)]));S.lastBackup=await DB.get("meta","lastBackup")||null;S.dirtySinceBackup=!!(await DB.get("meta","dirty"));
    const st=await DB.get("meta","settings");if(st)S.settings={...S.settings,...st}}
  catch(e){toast("This browser can't store data. Turn off private browsing and try again.",0)}
  stkThumbs.clear();S.loaded=true;history.replaceState({home:1},"");render()}
if("serviceWorker"in navigator){navigator.serviceWorker.register("sw.js").then(reg=>{
  navigator.serviceWorker.ready.then(()=>{S.offlineReady=true;if(S.view==="home")render()});
  const offer=nw=>toast("A new version is ready.",0,{label:"Update",fn:async()=>{await flushSaves();S.updating=true;nw.postMessage("skip")}});
  if(reg.waiting&&navigator.serviceWorker.controller)offer(reg.waiting);
  reg.addEventListener("updatefound",()=>{const nw=reg.installing;nw&&nw.addEventListener("statechange",()=>{if(nw.state==="installed"&&navigator.serviceWorker.controller)offer(nw)})})}).catch(()=>{});
  let reloaded=false;navigator.serviceWorker.addEventListener("controllerchange",()=>{if(!reloaded&&S.updating){reloaded=true;location.reload()}})}
start();
