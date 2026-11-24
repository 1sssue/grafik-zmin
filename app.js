
/*PARSE_START*/
function serialToYmd(s){const d=new Date(Math.round((s-25569)*86400000));return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0')}
function isTimeV(v){return typeof v==='number'&&v>0&&v<1}
function fmtT(f){const m=Math.round(f*1440);return String(Math.floor(m/60)%24).padStart(2,'0')+':'+String(m%60).padStart(2,'0')}
const RANGE=/^(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})$/;
function parseCell(c){
  const a=c[0],b=c[1],p=c[2],d=c[3];
  const type=typeof d==='string'?d.trim():'';
  if(isTimeV(a)){return {k:'work',s:fmtT(a),l:isTimeV(b)?fmtT(b):'',b:isTimeV(p)?fmtT(p):'',t:type}}
  if(typeof a==='string'&&RANGE.test(a.trim())){const m=a.trim().match(RANGE);return {k:'work',s:m[1].padStart(2,'0')+':'+m[2],r:a.trim().replace(/\s*[-–]\s*/,' – '),t:type}}
  const texts=c.filter(v=>typeof v==='string'&&v.trim()&&v.trim()!=='-').map(v=>v.trim());
  if(!texts.length)return null;
  if(texts.some(v=>/відпуст/i.test(v)))return {k:'vac',x:'Відпустка'};
  if(texts.some(v=>/лікарн/i.test(v)))return {k:'sick',x:'Лікарняний'};
  const txt=texts[0];
  if(/^вих/i.test(txt))return {k:'off',x:'Вих'};
  return {k:'other',x:txt};
}
function parseGrid(rows){
  let hr=-1,cols=[];
  for(let r=0;r<Math.min(rows.length,12);r++){
    const cs=[];(rows[r]||[]).forEach((v,i)=>{if(typeof v==='number'&&v>40000&&v<60000)cs.push(i)});
    if(cs.length>=20){hr=r;cols=cs;break}
  }
  if(hr<0)return null;
  const dates=cols.map(c=>serialToYmd(rows[hr][c]));
  const people=[];let group='',isLeader=false;
  for(let r=hr+1;r<rows.length;r++){
    const row=rows[r]||[];const name=typeof row[2]==='string'?row[2].trim().replace(/^\*+\s*/, ''):'';
    if(!name)continue;
    if(/^(різниця|кількість)/i.test(name))break;
    if(/^керівники груп/i.test(name)){group='Керівники груп';isLeader=true;continue}
    if(/^група/i.test(name)){group=name.trim();isLeader=false;continue}
    if(typeof row[0]!=='number'&&typeof row[1]!=='number')continue;
    const sh={};
    cols.forEach((c,i)=>{const cell=parseCell([row[c],row[c+1],row[c+2],row[c+3]]);if(cell)sh[dates[i]]=cell});
    const where=String(row[3]||'').trim();
    const hm=String(row[4]||'').match(/\d+(?:[.,]\d+)?/);const hours=hm?hm[0].replace(',','.'):'';
    people.push({id:name,name,group:group||'Без групи',isLeader,where:/vpn|впн/i.test(where)?'VPN':/офіс/i.test(where)?where.replace(/офіс/i,'Офіс '):'' ,hours,sh});
  }
  if(!people.length)return null;
  return {dates,people};
}
/*PARSE_END*/

const MONTHS=['січень','лютий','березень','квітень','травень','червень','липень','серпень','вересень','жовтень','листопад','грудень'];
const MON3=['січ','лют','бер','кві','тра','чер','лип','сер','вер','жов','лис','гру'];
const WD=['НД','ПН','ВТ','СР','ЧТ','ПТ','СБ'];
const RANKS=[{id:'intern',label:'Стажер',pct:0},{id:'spec',label:'Фахівець',pct:10},{id:'spec2',label:'Фахівець 2 розряд',pct:22},{id:'spec3',label:'Фахівець 3 розряд',pct:35}];
const CURS={UAH:['грн','Гривня (грн)'],USD:['$','Долар США ($)'],EUR:['€','Євро (€)'],PLN:['zł','Злотий (zł)'],GBP:['£','Фунт стерлінгів (£)']};
const LS='shifts.v2',LF='shifts.v2.f.';
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const dowOf=ds=>new Date(ds+'T12:00:00Z').getUTCDay();
const addDays=(ds,n)=>{const d=new Date(ds+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const daysIn=ym=>{const [y,m]=ym.split('-').map(Number);return new Date(Date.UTC(y,m,0)).getUTCDate()};
const shiftYm=(ym,n)=>{const [y,m]=ym.split('-').map(Number);const d=new Date(Date.UTC(y,m-1+n,1));return d.getUTCFullYear()+'-'+pad(d.getUTCMonth()+1)};
const monthName=ym=>{const [y,m]=ym.split('-').map(Number);const s=MONTHS[m-1];return s[0].toUpperCase()+s.slice(1)+' '+y};
const todayStr=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};

/* demo data (invented names) */
function demoData(){
  const dates=[];for(let d=1;d<=30;d++)dates.push('2026-11-'+pad(d));
  const names=[['Зразкова Ірина','Група 1'],['Тестенко Андрій','Група 1'],['Прикладна Олена','Група 1'],['Демченко Максим','Група 2'],['Пробна Софія','Група 2'],['Макетенко Юрій','Група 2'],['Взірець Наталія','Група 2'],['Шаблонюк Денис','Група 3']];
  const starts=['07:00','08:00','09:00','10:00','11:00','13:00'];
  const people=names.map(([n,g],i)=>{
    const sh={};
    dates.forEach((d,j)=>{
      const off=(j+i*2)%7>=5;
      if(off)sh[d]={k:'off',x:'Вих'};
      else if(i===2&&j>=20&&j<=24)sh[d]={k:'vac',x:'Відпустка'};
      else if(i===5&&j>=9&&j<=11)sh[d]={k:'sick',x:'Лікарняний'};
      else{const s=starts[(j*3+i*5)%starts.length];sh[d]={k:'work',s,l:pad(+s.slice(0,2)+4)+':30',b:pad(+s.slice(0,2)+7)+':30',t:(j+i)%9===0?'Проблеми':(j+i)%11===0?'Пошта':'Чат'}}
    });
    return {id:n,name:n,group:g,where:i%3?'VPN':'Офіс 2',hours:'8',sh};
  });
  return {dates,people};
}

/* state */
let S={files:{},demo:true,demoF:null,demoChats:{},view:'',main:'',sel:[],chats:{},ot:{},rate:null,rank:'spec',cur:'UAH',colors:{},ft:{},qb:{}};
function lsSet(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}}
function saveMeta(){
  const fm={};Object.keys(S.files).forEach(k=>{const f=S.files[k];fm[k]={name:f.name,loadedAt:f.loadedAt,hidden:f.hidden,sharedVersion:f.sharedVersion,sourceUrl:f.sourceUrl,sourceFileId:f.sourceFileId}});
  if(!lsSet(LS,{files:fm,main:S.main,sel:S.sel,chats:S.chats,ot:S.ot,rate:S.rate,rank:S.rank,cur:S.cur,colors:S.colors,view:S.view,ft:S.ft,qb:S.qb}))toast('Не вдалося зберегти зміни в браузері (сховище переповнене).');
}
function saveFile(k){if(!lsSet(LF+k,S.files[k].data))toast('Файл завеликий для збереження в браузері: після оновлення сторінки його треба буде додати знову.')}
function index(f){const people=f.data.people||[];if(!people.some(p=>p.isLeader)){const group1=people.findIndex(p=>/^група\s*1\b/i.test(p.group||''));if(group1>0)people.slice(0,group1).filter(p=>/^(без групи|керівники груп)$/i.test(p.group||'')).forEach(p=>{p.isLeader=true;p.group='Керівники груп'})}f.map=new Map(people.map(p=>[p.id,p]));return f}
function load(){
  let m=null;try{m=JSON.parse(localStorage.getItem(LS)||'null')}catch(e){}
  if(m){
    S.main=m.main||'';S.sel=m.sel||[];S.chats=m.chats||{};S.ot=m.ot||{};S.rate=m.rate??null;S.rank=m.rank||'spec';S.cur=m.cur||'UAH';S.colors=m.colors||{};S.view=m.view||'';S.ft=m.ft||{};S.qb=m.qb||{};
    Object.keys(m.files||{}).forEach(k=>{try{const d=JSON.parse(localStorage.getItem(LF+k)||'null');if(d)S.files[k]=index({...m.files[k],data:d})}catch(e){}});
  }else{
    try{const o=JSON.parse(localStorage.getItem('shifts.v1')||'null');if(o&&o.data){const k=o.data.dates[0].slice(0,7);S.files[k]=index({name:o.fileName,loadedAt:o.loadedAt,hidden:false,data:o.data});S.sel=o.sel||[];S.colors=o.colors||{}}}catch(e){}
  }
  S.demo=!Object.keys(S.files).length;
  if(S.demo){initDemo()}
  else{
    cleanSel();
    if(!S.files[S.view]){const t=todayStr().slice(0,7);S.view=S.files[t]?t:Object.keys(S.files).sort().pop()}
  }
}
function initDemo(){
  S.demo=true;S.demoF=index({name:'',loadedAt:'',hidden:false,data:demoData()});S.view='2026-11';S.demoChats={};
  if(!S.main&&!S.sel.length){S.main='Зразкова Ірина';S.sel=['Тестенко Андрій','Демченко Максим']}
  for(let d=1;d<=16;d++){const l=[0,22,25,28,31,0,0,21,24,29,27,32,0,0,23,26][d-1],b=[0,16,15,19,18,0,0,14,17,15,18,20,0,0,13,16][d-1],p=[0,2,1,3,2,0,0,1,2,0,1,3,0,0,1,2][d-1];if(l||b)S.demoChats['2026-11-'+pad(d)]={l,b,p}}
}
function cleanSel(){const all=new Set();Object.values(S.files).forEach(f=>f.data.people.forEach(p=>all.add(p.id)));if(S.main&&!all.has(S.main))S.main='';S.sel=S.sel.filter(id=>all.has(id)&&id!==S.main)}
function fileOf(ym,inc){if(S.demo)return ym==='2026-11'?S.demoF:null;const f=S.files[ym];return f&&(inc||!f.hidden)?f:null}
const personAt=(id,date)=>{const f=fileOf(date.slice(0,7));return f?f.map.get(id)||null:null};
function peopleSource(){const f=fileOf(S.view);if(f)return f.data.people;for(const k of Object.keys(S.files).sort().reverse()){const g=fileOf(k);if(g)return g.data.people}return S.demo?S.demoF.data.people:[]}
const shown=()=>[S.main,...S.sel.filter(x=>x!==S.main)].filter(Boolean);
const short=n=>{const p=n.split(/\s+/);return p[1]?p[0]+' '+p[1][0]+'.':p[0]};

/* shift colours */
function hslHex(h,s,l){s/=100;l/=100;const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l),f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));return '#'+[f(0),f(8),f(4)].map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('')}
const shiftKey=c=>c.k==='work'?'s:'+c.s:'k:'+c.k;
function defaultColor(k){
  if(k[0]==='s'){const [h,m]=k.slice(2).split(':').map(Number);const t=h+m/60;return hslHex(Math.round((20+(t-6)*24+360)%360),72,52)}
  return {off:'#8e97b8',vac:'#12a374',sick:'#e0574a',other:'#d49a2a'}[k.slice(2)]||'#8e97b8';
}
const colorFor=k=>S.colors[k]||defaultColor(k);
const keyLabel=k=>k[0]==='s'?k.slice(2):({off:'Вихідний',vac:'Відпустка',sick:'Лікарняний',other:'Інше'})[k.slice(2)];
const tagCls=t=>{const x=(t||'').toLowerCase();return x==='чат'?'chat':x==='чат-ніч'?'night':x==='проблеми'?'prob':x.startsWith('пошта')?'mail':''};
function allKeys(){
  const cnt={};const fs=S.demo?[S.demoF]:Object.values(S.files).filter(f=>!f.hidden);
  fs.forEach(f=>f.data.people.forEach(p=>Object.values(p.sh).forEach(c=>{const k=shiftKey(c);cnt[k]=(cnt[k]||0)+1})));
  const keys=Object.keys(cnt).sort((a,b)=>{const sa=a[0]==='s',sb=b[0]==='s';return sa&&sb?(a<b?-1:1):sa?-1:sb?1:(a<b?-1:1)});
  return {keys,cnt};
}

/* money / rate */
const rate=()=>S.rate!=null?S.rate:(S.demo?140:0);
const rankPct=()=>(RANKS.find(r=>r.id===S.rank)||RANKS[1]).pct;
const money=v=>Math.round(v).toLocaleString('uk-UA',{minimumFractionDigits:0,maximumFractionDigits:0})+' '+CURS[S.cur][0];
const fmtH=h=>(Math.round(h*100)/100).toString().replace('.',',')+' год';

/* payments: salary on the 7th, advance on the 22nd; weekend moves to the previous Friday */
function payDates(ym){const adj=d=>{const dow=dowOf(ym+'-'+pad(d));const sh=dow===6?1:dow===0?2:0;return {day:d-sh,from:d,moved:sh>0}};return {sal:adj(7),adv:adj(22)}}
function payBadge(date){const p=payDates(date.slice(0,7));const d=+date.slice(8);return d===p.sal.day?'<span class="pay sal" title="Зарплата"><span class="f">Зарплата</span><span class="s">ЗП</span></span>':d===p.adv.day?'<span class="pay adv" title="Аванс"><span class="f">Аванс</span><span class="s">Ав.</span></span>':''}
function renderPays(){
  const p=payDates(S.view),td=todayStr();
  const one=(cls,name,o)=>{const dt=S.view+'-'+pad(o.day);const dow=WD[dowOf(dt)];
    let rel='';if(td.slice(0,7)===S.view){const diff=o.day-(+td.slice(8));rel=diff===0?'сьогодні':diff>0?'через '+diff+' дн.':''}
    return `<span class="pp ${cls}" title="${o.moved?'Припадає на вихідний, тому виплата в пʼятницю':'Виплата '+o.from+' числа'}"><b>${name}</b> ${dow} ${pad(o.day)}.${S.view.slice(5)}${rel?' <small>· '+rel+'</small>':''}</span>`};
  $('pays').innerHTML=one('sal','Зарплата',p.sal)+one('adv','Аванс',p.adv);
}

/* shift hours */
function shiftHours(c,p){
  if(c.r){const m=c.r.match(/(\d+):(\d+)\s*–\s*(\d+):(\d+)/);if(m){const a=+m[1]*60+ +m[2],b=+m[3]*60+ +m[4];return ((b-a+1440)%1440)/60}}
  return +p.hours||8;
}
function shiftEndTime(c,p){
  const start=parseT(c.s),raw=String(p&&p.hours||'').replace(',','.'),hours=Number(raw);
  if(start!=null&&raw&&Number.isFinite(hours)&&hours>0)return pad(Math.floor((start+hours*60+(hours>=8?60:0))/60)%24)+':'+pad(Math.round((start+hours*60+(hours>=8?60:0))%60));
  const range=String(c.r||'').match(/\d{1,2}:\d{2}\s*[–-]\s*(\d{1,2}:\d{2})/);return range?range[1]:'';
}

/* overtime */
const parseT=s=>{if(!s)return null;const [h,m]=s.split(':').map(Number);return h*60+m};
const ivMin=iv=>{const a=parseT(iv.a),b=parseT(iv.b);if(a==null||b==null||a===b)return 0;return (b-a+1440)%1440};
const otHours=e=>Math.round(e.iv.reduce((s,iv)=>s+ivMin(iv),0)/60*100)/100;
const parseX=v=>{const n=parseFloat(String(v).replace(',','.').replace(/[^\d.]/g,''));return isFinite(n)&&n>0?n:1};
const otMoney=e=>otHours(e)*rate()*parseX(e.x);
const otDates=()=>Object.keys(S.ot).filter(d=>d.startsWith(S.view+'-')).sort((a,b)=>b.localeCompare(a));

/* salary */
function calcPay(){
  const f=fileOf(S.view),p=f&&S.main?f.map.get(S.main):null;if(!p)return null;
  let h1=0,h2=0,n1=0,n2=0;
  for(let d=1;d<=daysIn(S.view);d++){const c=p.sh[S.view+'-'+pad(d)];if(c&&c.k==='work'){const h=shiftHours(c,p);if(d<=15){h1+=h;n1++}else{h2+=h;n2++}}}
  const r=rate(),base1=h1*r,base2=h2*r,pct=rankPct(),bonus=(base1+base2)*pct/100;
  let oh=0,om=0;otDates().forEach(d=>{oh+=otHours(S.ot[d]);om+=otMoney(S.ot[d])});
  let qs=0,qh=0;for(let d=1;d<=daysIn(S.view);d++){const k=S.view+'-'+pad(d),v=chTotal(CH()[k]);if(v){const hh=dayHours(k);if(hh>0){qs+=v;qh+=hh}}}
  const qOn=!!S.qb[S.view],qAvg=qh?qs/qh:0,qExtra=qOn&&qAvg>9?qs-9*qh:0,qMoney=qExtra*QB;
  return {h1,h2,n1,n2,base1,base2,pct,bonus,oh,om,qOn,qAvg,qExtra,qMoney,sal:base2+bonus+om+qMoney,adv:base1,total:base1+base2+bonus+om+qMoney};
}
function renderSalary(){
  $('curLbl').textContent=CURS[S.cur][0];$('qbChk').checked=!!S.qb[S.view];
  const who=S.main?short(S.main):'';$('payWho').textContent=who?'для: '+who:'';
  const c=calcPay(),pd=payDates(S.view),last=daysIn(S.view);
  if(!S.main){$('payCalc').innerHTML='<p class="empty-note">Оберіть основного користувача (★ у списку «Люди»), і тут з’явиться розрахунок.</p>';return}
  if(!c){$('payCalc').innerHTML='<p class="empty-note">Немає даних про зміни цієї людини за '+monthName(S.view).toLowerCase()+'. Додайте файл за цей місяць або покажіть прихований.</p>';return}
  const fd=o=>WD[dowOf(S.view+'-'+pad(o.day))]+' '+pad(o.day)+'.'+S.view.slice(5);
  const hint=rate()?'':'<p class="empty-note">Вкажіть ставку за годину, щоб побачити суми.</p>';
  $('payCalc').innerHTML=hint+
   `<div class="pr"><div><b>Зміни 1–15</b><small>${c.n1} змін · ${fmtH(c.h1)}</small></div><span>${money(c.base1)}</span></div>
    <div class="pr sum"><div><b>Аванс</b><small>виплата ${fdm(S.view,pd.adv)}</small></div><span>${money(c.adv)}</span></div>
    <div class="pr"><div><b>Зміни 16–${last}</b><small>${c.n2} змін · ${fmtH(c.h2)}</small></div><span>${money(c.base2)}</span></div>
    <div class="pr"><div><b>Премія ${c.pct}%</b><small>від усіх змін місяця (${money(c.base1+c.base2)})</small></div><span>${money(c.bonus)}</span></div>
    <div class="pr"><div><b>Переробка</b><small>${fmtH(c.oh)}</small></div><span>${money(c.om)}</span></div>
    ${c.qOn?`<div class="pr"><div><b>Доплата за кількісний</b><small>середнє ${fmtN(c.qAvg)} чат/год${c.qAvg>9?` · +${fmtN(c.qExtra)} чатів × ${QB}`:' · потрібно понад 9'}</small></div><span>${money(c.qMoney)}</span></div>`:''}
    <div class="pr sum"><div><b>Зарплата</b><small>виплата ${fdm(nextYM(S.view),payDates(nextYM(S.view)).sal)}</small></div><span>${money(c.sal)}</span></div>
    <div class="total"><small>Загальна сума</small><b>${money(c.total)}</b></div>
    `;
}

/* chats */
const CH=()=>S.demo?S.demoChats:S.chats;
const chTotal=c=>c?(c.n!=null?(+c.n||0):(+c.l||0)+(+c.b||0))-(+c.p||0):0;
function setChat(date,f,v){
  const st=CH();const c=st[date]||(st[date]={n:0,p:0});
  if(f==='n'){delete c.l;delete c.b}
  c[f]=Math.max(0,Math.floor(+v)||0);
  if(!c.n&&!c.p&&!c.l&&!c.b)delete st[date];
  if(!S.demo)saveMeta();
}
function renderDays(){
  const st=CH(),td=todayStr(),n=daysIn(S.view);
  let h='';
  for(let i=1;i<=n;i++){const d=S.view+'-'+pad(i),dow=dowOf(d),we=dow===0||dow===6,c=st[d]||{},t=chTotal(c);
    h+=`<div class="d${we?' we':''}${d===td?' today':''}${d>td?' future':''}" data-date="${d}"><span class="bar"></span><span class="num">${pad(i)}</span><span class="w">${WD[dow]}</span>`+
      ['n','p'].map(f=>`<input type="number" min="0" inputmode="numeric" id="ch-${d}-${f}" data-f="${f}" value="${f==='n'?((c.n!=null?c.n:(+c.l||0)+(+c.b||0))||''):(c.p||'')}" placeholder="0" aria-label="${{n:'Загальна кількість',p:'Відкладені'}[f]}, ${i} число">`).join('')+
      `</div>`}
  $('days').innerHTML=h;refreshChats();
}
function refreshChats(){
  const st=CH(),n=daysIn(S.view);const vals=[];let max=1;
  for(let i=1;i<=n;i++){const t=chTotal(st[S.view+'-'+pad(i)]);vals.push(t);if(t>max)max=t}
  document.querySelectorAll('#days .d').forEach((row,i)=>{
    const t=vals[i];row.title=t?'Підсумок (без відкладених): '+t:'';
    const lv=chLevel(row.dataset.date,t),bar=row.querySelector('.bar');bar.className='bar'+(t>0&&lv.cls?' '+lv.cls:'');bar.style.width=t>0?Math.min(100,lv.ratio*100)+'%':'0%';
  });
  const sum=vals.reduce((a,b)=>a+b,0),all=vals.map((v,i)=>({v,d:i+1})).filter(x=>x.v!==0);
  const filled=all.filter(x=>dayHours(S.view+'-'+pad(x.d))>0),ws=filled.reduce((a,x)=>a+x.v,0);
  $('sumN').textContent=sum;
  $('avgN').textContent=filled.length?fmtN(ws/filled.length):'—';
  const hrs=filled.reduce((a,x)=>a+dayHours(S.view+'-'+pad(x.d)),0),diff=ws-nrate(S.view)*hrs;
  $('avgH').textContent=hrs?fmtN(ws/hrs):'—';
  const nb=$('normBox');nb.classList.toggle('ok',filled.length>0&&diff>0);nb.classList.toggle('lack',filled.length>0&&diff<0);
  $('normL').textContent=diff>0?'Перевиконано норму':'До норми ('+fmtN(nrate(S.view))+'/год)';
  $('normN').textContent=!filled.length?'—':diff>0?'+'+fmtN(diff)+' чатів':diff<0?fmtN(-diff)+' чатів':'норму виконано';
  const best=[...all].sort((a,b)=>b.v-a.v)[0];
  $('bestN').textContent=best&&best.v>0?best.v+' · '+pad(best.d)+'.'+S.view.slice(5):'—';
  if(zoomEl&&chartOn&&zoomEl.classList.contains('side'))renderChart();
}

/* calendar */
function calendarNameHTML(id){
  const main=id===S.main, parts=String(id).trim().split(/\s+/), initials=parts.slice(0,2).map(x=>Array.from(x)[0]?.toLocaleUpperCase('uk')||'').join('');
  return `<span class="n"><span class="n-desktop">${main?'★ ':''}${esc(short(id))}</span><span class="n-mobile">${main?'★':esc(initials)}</span></span>`;
}
function entryHTML(id,d,multi,hasOvertime=false){
  const mc=id===S.main?' mainu':'';
  const otc=!multi&&id===S.main&&hasOvertime?' with-ot':'';
  const p=personAt(id,d),c=p?p.sh[d]:null;
  const col=c?colorFor(shiftKey(c)):'var(--muted)';
  const transparentColor=col==='transparent'?' transparent-color':'';
  if(!c)return multi?`<div class="ent m none${mc}"><span class="t">—</span>${calendarNameHTML(id)}</div>`:`<div class="ent one none"><div class="row"><span class="t" style="color:var(--muted)">—</span></div></div>`;
  const tip=esc(id+(c.k==='work'?' · '+(c.r||c.s)+(c.l?' · обід '+c.l:'')+(c.b?' · перерва '+c.b:'')+(c.t?' · '+c.t:''):' · '+c.x));
  if(c.k==='work'){
    const time=c.r||c.s;const tg=c.t?`<span class="tag ${tagCls(c.t)}">${esc(c.t)}</span>`:'';
    const end=shiftEndTime(c,p),ms=end?`<span class="ms"><b>${esc(c.s)}</b><b>${esc(end)}</b></span>`:`<span class="ms"><b>${esc(c.s)}</b></span>`;
    if(!multi)return `<div class="ent one wk${mc}" style="--c:${col}" title="${tip}"><div class="row"><span class="t">${esc(time)}</span>${tg}</div>${c.l?`<div class="sub">обід ${c.l}${c.b?' · перерва '+c.b:''}</div>`:''}${ms}</div>`;
    return `<div class="ent m wk${mc}" style="--c:${col}" title="${tip}"><span class="t">${esc(c.s)}</span>${tg}${calendarNameHTML(id)}</div>`;
  }
  if(c.k==='vac'&&!multi)return `<div class="ent one off vac${otc}${transparentColor}" style="--c:${col}" title="${tip}"><div class="row"><span class="t">Відпустка</span></div></div>`;
  if(c.k==='vac')return `<div class="ent m off${mc}${otc}${transparentColor}" style="--c:${col}" title="${tip}"><span class="t">Відп</span>${calendarNameHTML(id)}</div>`;
  if(c.k==='sick')return `<div class="ent m sick${mc}${otc}${transparentColor}" style="--c:${col}" title="${tip}"><span class="t">Лік</span>${calendarNameHTML(id)}</div>`;
  const cls=(c.k==='off'?'off':'')+transparentColor;
  const chip=c.k==='off'?'':`<span class="tag ${c.k}">${esc(c.x.length>14?c.x.slice(0,13)+'…':c.x)}</span>`;
  if(!multi)return `<div class="ent one ${cls}${mc}${otc}" style="--c:${col}" title="${tip}"><div class="row"><span class="t">${c.k==='off'?'Вихідний':''}</span>${chip}</div></div>`;
  return `<div class="ent m ${cls}${mc}" style="--c:${col}" title="${tip}"><span class="t">${c.k==='off'?'Вих':''}</span>${chip}${calendarNameHTML(id)}</div>`;
}
function renderCal(){
  const ymv=S.view,first=ymv+'-01',last=ymv+'-'+pad(daysIn(ymv));
  const start=addDays(first,-((dowOf(first)+6)%7)),end=addDays(last,(7-dowOf(last))%7);
  const ids=shown(),multi=ids.length>1,hideOvertime=multi,st=CH(),td=todayStr(),keys=new Set();
  if(!ids.length){$('grid').classList.add('no-selection');$('grid').innerHTML='<div class="calendar-empty-state"><div class="empty-copy"><strong>Нікого не обрано.</strong><div class="empty-tip"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.4"/><path d="M2.8 19.5c.4-3.4 2.9-5.4 6.2-5.4s5.8 2 6.2 5.4M18.5 7.5v6M15.5 10.5h6"/></svg><span class="empty-desktop">Натисніть «+ Люди» у верхньому лівому куті.</span><span class="empty-mobile">Натисніть кнопку додавання людей унизу праворуч.</span></div></div></div>';renderLegend(keys);return}
  $('grid').classList.remove('no-selection');
  let h='',i=0;
  for(let d=start;d<=end;d=addDays(d,1),i++){
    const dow=dowOf(d),we=dow===0||dow===6,out=d.slice(0,7)!==ymv,day=+d.slice(8);
    const n=chTotal(st[d]);
    const hasFile=!!fileOf(d.slice(0,7));
    let body='';
    const ot=S.ot[d],otHTML=!hideOvertime&&S.main&&ot&&otHours(ot)>0?`<div class="otl" title="Переробка"><span class="otl-label">Переробка </span><span>${fmtH(otHours(ot))}</span><span>×${parseX(ot.x)}</span></div>`:'';let otPlaced=false;
    if(hasFile)ids.forEach(id=>{const p=personAt(id,d);if(p&&p.sh[d])keys.add(shiftKey(p.sh[d]));body+=entryHTML(id,d,multi,!!otHTML);if(id===S.main){body+=otHTML;otPlaced=true}});
    if(!otPlaced)body+=otHTML;
    const mo=out&&(day===1||i===0)?`<span class="mo">${MON3[+d.slice(5,7)-1]}</span>`:'';
    h+=`<div class="cell${we?' we':''}${out?' out':''}${d===td?' today':''}"${out?` data-go="${d.slice(0,7)}"`:''}><div class="ch"><span class="dn">${day}</span>${mo}<span class="wd">${WD[dow]}</span>${payBadge(d)}${n?(()=>{const lv=chLevel(d,n),ic=lv.cls==='g'?'M2.5 8.5 6 12l7.5-8':lv.cls==='y'?'M3 8h10':'M3.5 3.5l9 9M12.5 3.5l-9 9';return `<span class="cc ${lv.cls||'r'}" title="Закрито чатів: ${n} · норма за день: ${fmtN(lv.norm)}">${n}<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${ic}"/></svg></span>`})():''}</div><div class="cb">${body}</div></div>`;
  }
  $('grid').innerHTML=h;$('grid').dataset.n=ids.length;$('grid').dataset.weeks=Math.ceil((end-start+1)/7);
  renderLegend(keys);
}
function renderLegend(keys){
  const arr=[...keys].sort((a,b)=>{const sa=a[0]==='s',sb=b[0]==='s';return sa&&sb?(a<b?-1:1):sa?-1:sb?1:(a<b?-1:1)});
  $('legend').innerHTML=(arr.length?'<span class="lglbl">Зміни</span>':'')+arr.map(k=>`<button class="lg" type="button" data-lg style="--c:${colorFor(k)}"><i></i>${esc(keyLabel(k))}</button>`).join('')+'<button class="btn ghost sm" type="button" data-lg>Налаштувати кольори</button>';
}
function overviewDayCell(person,date){
  const c=personAt(person.id,date)?.sh[date];
  if(!c)return '<td class="overview-empty" colspan="4">—</td>';
  if(c.k!=='work')return `<td class="overview-status ${esc(c.k)}" colspan="4">${esc(c.x||'—')}</td>`;
  const bg=`color-mix(in srgb,${colorFor(shiftKey(c))} 17%,var(--surface))`;
  return `<td class="overview-time" style="--overview-shift:${colorFor(shiftKey(c))};background:${bg}">${esc(c.r||c.s||'—')}</td><td style="background:${bg}">${esc(c.l||'—')}</td><td style="background:${bg}">${esc(c.b||'—')}</td><td style="background:${bg}">${esc(c.t||'—')}</td>`;
}
let overviewCenter=todayStr();
let overviewCalendarMonth=overviewCenter.slice(0,7);
function overviewGroupInfo(value,leaders=[]){
  const raw=value||'Без групи',m=raw.match(/^(.*?)\s*\(\s*керівник\s+([^)]*)\s*\)$/i),name=(m?m[1]:raw).trim();
  const requested=(m?m[2]:'').toLocaleLowerCase('uk').split(/\s+/).filter(Boolean);
  const groupNo=Number(name.match(/група\s*(\d+)/i)?.[1]||0);
  const byOrder=groupNo>0&&groupNo<=7?leaders[groupNo-1]?.name:'';
  const matched=requested.length?leaders.find(p=>requested.every(token=>p.name.toLocaleLowerCase('uk').split(/\s+/).includes(token)))?.name:'';
  const fullName=byOrder||matched|| (m?m[2].trim():'');
  return {name,leader:fullName,label:fullName?`${name} · керівник: ${fullName}`:name};
}
function renderOverview(){
  const center=overviewCenter||todayStr(),mobileOverview=matchMedia('(max-width:760px)').matches,dates=mobileOverview?[center]:[addDays(center,-1),center,addDays(center,1)],people=peopleSource();
  const leaders=people.filter(p=>p.isLeader||(p.group||'').toLocaleLowerCase('uk')==='керівники груп');
  $('overviewDateBtn').textContent=new Date(center+'T12:00:00').toLocaleDateString('uk-UA',{weekday:'short',day:'numeric',month:'long',year:'numeric'});
  $('overviewRange').textContent=dates.map(d=>new Date(d+'T12:00:00').toLocaleDateString('uk-UA',{day:'numeric',month:'short'})).join(' · ');
  const groups=[...new Set(people.map(p=>p.group||'Без групи'))],prevGroup=$('overviewGroup').value;
  $('overviewGroup').innerHTML='<option value="">Усі групи</option>'+groups.map(g=>`<option value="${esc(g)}">${esc(overviewGroupInfo(g,leaders).label)}</option>`).join('');
  if(groups.includes(prevGroup))$('overviewGroup').value=prevGroup;
  const q=$('overviewSearch').value.trim().toLocaleLowerCase('uk'),group=$('overviewGroup').value;
  const rows=people.filter(p=>!group||(p.group||'Без групи')===group),matches=rows.filter(p=>q&&p.name.toLocaleLowerCase('uk').includes(q));
  const cols='<colgroup><col class="overview-col-name">'+dates.map(()=>'<col class="overview-col-start"><col class="overview-col-small"><col class="overview-col-small"><col class="overview-col-type">').join('')+'</colgroup>';
  const dayTitle=d=>mobileOverview?'Сьогодні':`${['Попередній день','Сьогодні','Наступний день'][dates.indexOf(d)]} · ${new Date(d+'T12:00:00').toLocaleDateString('uk-UA',{day:'2-digit',month:'2-digit'})}`;
  const head=`<table class="overview-table">${cols}<thead><tr><th class="overview-name" rowspan="2">Фахівець</th>${dates.map(d=>`<th colspan="4" class="overview-date${d===center?' is-today':''}">${dayTitle(d)}</th>`).join('')}</tr><tr>${dates.map(()=>'<th>Початок</th><th>Обід</th><th>Перерва</th><th>Тип</th>').join('')}</tr></thead><tbody>`;
  const personRow=(p,n)=>{const hit=!!q&&p.name.toLocaleLowerCase('uk').includes(q),cls=[p.id===S.main?'overview-main':'',p.id!==S.main&&S.sel.includes(p.id)?'overview-tracked':'',hit?'overview-hit':q?'overview-dim':''].filter(Boolean).join(' ');return `<tr class="${cls}" data-overview-person="${esc(p.id)}"><th class="overview-name" title="${esc(p.group||'Без групи')}"><span class="overview-number">${n}</span><span>${esc(p.name)}</span></th>${dates.map(d=>overviewDayCell(p,d)).join('')}</tr>`};
  let body='';
  if(group){rows.forEach((p,i)=>{if(!i)body+=`<tr class="overview-group-row"><th colspan="13">${esc(overviewGroupInfo(group,leaders).label)}</th></tr>`;body+=personRow(p,i+1)})}
  else{
    const visibleLeaders=rows.filter(p=>leaders.includes(p));
    const teams=new Map();rows.filter(p=>!visibleLeaders.includes(p)).forEach(p=>{const key=p.group||'Без групи';if(!teams.has(key))teams.set(key,[]);teams.get(key).push(p)});
    if(visibleLeaders.length)body+=`<tr class="overview-group-row overview-leaders-heading"><th colspan="13">Керівники груп</th></tr>`+visibleLeaders.map((p,i)=>personRow(p,i+1)).join('');
    teams.forEach((members,key)=>{const info=overviewGroupInfo(key,leaders);body+=`<tr class="overview-group-row"><th colspan="13">${esc(info.name)}${info.leader?' · керівник: '+esc(info.leader):''}</th></tr>`+members.map((p,i)=>personRow(p,i+1)).join('')});
  }
  $('overviewTable').innerHTML=people.length?head+(body||'<tr><td class="overview-message" colspan="13">У цій групі нікого не знайдено.</td></tr>')+'</tbody></table>':'<p class="overview-message">Немає завантажених людей для цього графіка.</p>';
  if(q&&matches.length){const row=$('overviewTable').querySelector('.overview-hit');row?.classList.add('overview-first-hit');row?.scrollIntoView({block:'nearest',inline:'nearest',behavior:'smooth'})}
}
function renderNote(){
  const f=fileOf(S.view),raw=!S.demo&&S.files[S.view];
  if(f){$('note').innerHTML='';return}
  if(raw&&raw.hidden)$('note').innerHTML=`<div class="note">Файл за цей місяць схований, тому графік не показується.<button class="btn sm" type="button" data-show="${S.view}">Показати</button></div>`;
  else $('note').innerHTML=`<div class="note">Для місяця «${monthName(S.view).toLowerCase()}» файлу немає. Додайте його, і графік з’явиться тут.<button class="btn sm" type="button" data-addfile>Додати файл</button></div>`;
}
function renderChips(){
  const me=S.main?`<span class="chip mine"><span class="st">★</span>${esc(short(S.main))}<button type="button" data-rmmain aria-label="Прибрати основного користувача">✕</button></span>`:'';
  const others=S.sel.filter(x=>x!==S.main).map(id=>`<span class="chip">${esc(short(id))}<button type="button" data-rm="${esc(id)}" aria-label="Прибрати ${esc(id)}">✕</button></span>`).join('');
  $('chips').innerHTML=(me+others)||'<span class="empty-note">Нікого не обрано. Натисніть «+ Люди».</span>';
}
function renderTop(){
  $('fileCount').textContent=S.demo?0:Object.keys(S.files).length;
  $('demoBanner').hidden=!S.demo;
  $('monthTitle').textContent=monthName(S.view);
  {const mn=monthName(S.view).split(' ');$('mTM').textContent=mn[0];$('mTY').textContent=mn.slice(1).join(' ')}
  $('otMonth').textContent=monthName(S.view);
}

/* overtime block */
function endOpts(iv){
  const m=parseT(iv.a);let o='<option value="">Кінець</option>';if(m==null)return o;
  for(let k=1;k<=12;k++){const t=(m+k*60)%1440,s=pad(Math.floor(t/60))+':'+pad(t%60);o+=`<option value="${s}"${s===iv.b?' selected':''}>${s} · +${k} год</option>`}
  return o;
}
const otExpandedDays=new Set(),ftExpandedDays=new Set();
function renderOT(){
  const ds=otDates();
  ds.forEach(d=>S.ot[d].iv.forEach(iv=>{const a=parseT(iv.a),b=parseT(iv.b);if(b!=null){const k=a==null?-1:((b-a+1440)%1440)/60;if(!(Number.isInteger(k)&&k>=1&&k<=12))iv.b=''}}));
  $('otList').innerHTML=ds.length?ds.map(d=>{const e=S.ot[d];
    const ivs=e.iv.map((iv,i)=>`<span class="iv"><input type="time" id="ot-${d}-a${i}" data-a="${i}" value="${iv.a}" aria-label="Початок"><span>–</span><select id="ot-${d}-b${i}" data-b="${i}" aria-label="Кінець, кратно годині"${iv.a?'':' disabled'}>${endOpts(iv)}</select><button type="button" data-ivdel="${i}" aria-label="Прибрати інтервал">✕</button></span>`).join('');
    const collapsed=d<todayStr()&&!otExpandedDays.has(d);
    return `<div class="otr ot-entry${collapsed?' ot-collapsed':''}" data-d="${d}" aria-expanded="${!collapsed}"><div class="otd"><b>${+d.slice(8)}</b><small>${WD[dowOf(d)]}</small></div><div class="otres"><div class="oth" data-h>${fmtH(otHours(e))}</div><div class="otm" data-m>${money(otMoney(e))}</div></div><label class="otx">×<input type="text" inputmode="decimal" id="otx-${d}" data-x value="${esc(e.x)}" aria-label="Кратність тарифу"></label><button class="btn ghost sm otdel delete-icon" type="button" data-otdel aria-label="Видалити день" title="Видалити"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 13h11l1-13M9 7V4h6v3"/></svg></button><div class="otfoot"><div class="ivs">${ivs}<button class="btn ghost sm" type="button" data-ivadd>+ інтервал</button></div></div></div>`}).join(''):'<p class="empty-note">Перепрацювань за цей місяць ще немає.</p>';
  refreshOT();
}
function refreshOT(){
  let H=0,M=0;
  otDates().forEach(d=>{const e=S.ot[d];H+=otHours(e);M+=otMoney(e);const row=document.querySelector(`.otr[data-d="${d}"]`);if(row){row.querySelector('[data-h]').textContent=fmtH(otHours(e));row.querySelector('[data-m]').textContent=money(otMoney(e))}});
  $('otH').textContent=fmtH(H);$('otM').textContent=money(M);refreshToday();refreshChats();
}
function renderPop(){
  const first=S.view+'-01',lead=(dowOf(first)+6)%7,n=daysIn(S.view);
  let h=`<h4>${monthName(S.view)}</h4><div class="mini">`+['Пн','Вт','Ср','Чт','Пт','Сб','Нд'].map(x=>`<span>${x}</span>`).join('')+'<i></i>'.repeat(lead);
  for(let i=1;i<=n;i++){const d=S.view+'-'+pad(i);h+=`<button type="button" data-pd="${d}" class="${S.ot[d]?'has':''}">${i}</button>`}
  $('otPop').innerHTML=h+'</div>';
}
function afterOtChange(){refreshOT();renderCal();renderSalary()}

function renderAll(){renderToday();renderTop();renderChips();renderPays();renderNote();renderCal();renderDays();renderOT();renderSalary();if(!$('ov6').hidden)renderFt();scrollToday()}
function scrollToday(){const t=document.querySelector('.d.today'),box=$('days');if(t)box.scrollTop=Math.max(0,t.offsetTop-box.offsetTop-70);else box.scrollTop=0}

/* people modal */
function renderPeople(){
  const q=$('q').value.trim().toLowerCase();const groups={};
  peopleSource().forEach(p=>{if(!q||p.name.toLowerCase().includes(q))(groups[p.group]=groups[p.group]||[]).push(p)});
  $('plist').innerHTML=Object.keys(groups).map(g=>`<div class="grp"><b>${esc(g)}</b><button class="btn ghost sm" type="button" data-grp="${esc(g)}">Додати групу</button></div>`+groups[g].map(p=>{const isMe=S.main===p.id;return `<div class="p"><button class="me${isMe?' on':''}" type="button" data-me="${esc(p.id)}" title="${isMe?'Це ви':'Зробити основним користувачем'}" aria-label="Це я: ${esc(p.name)}">★</button><label class="pl"><input type="checkbox" data-pid="${esc(p.id)}" ${isMe||S.sel.includes(p.id)?'checked':''} ${isMe?'disabled':''}><span class="nm">${esc(p.name)}</span><small>${[p.where,p.hours?p.hours+' год':''].filter(Boolean).join(' · ')}</small></label></div>`}).join('')).join('')||'<p class="empty-note" style="padding:16px">Нікого не знайдено.</p>';
  const peopleById=new Map(peopleSource().map(p=>[p.id,p]));
  const selected=shown().map(id=>peopleById.get(id)||{id,name:id});
  $('peopleSelectedWrap').hidden=!selected.length;
  $('peopleSelected').innerHTML=selected.map(p=>`<button class="people-selected-chip${p.id===S.main?' is-main':''}" type="button" data-selected-remove="${esc(p.id)}" aria-label="Прибрати ${esc(p.name)} з вибраних"><span>${p.id===S.main?'★ ':''}${esc(p.name)}</span><b aria-hidden="true">×</b></button>`).join('');
  $('mCount').textContent='Обрано: '+shown().length;
}
let selectedColorKey='',draftColor='',draftHue=220,draftSat=78,draftLight=55;
function updateColorDraft(){draftColor=`hsl(${draftHue} ${draftSat}% ${draftLight}%)`;const plane=$('colorPlane');plane.style.setProperty('--hue',`hsl(${draftHue} 100% 50%)`);$('colorCursor').style.left=draftSat+'%';$('colorCursor').style.top=(100-draftLight)+'%';const a=(draftHue-90)*Math.PI/180;$('hueCursor').style.left=`${50+Math.cos(a)*43}%`;$('hueCursor').style.top=`${50+Math.sin(a)*43}%`;$('colorPreview').style.background=draftColor}
function renderColors(){
  const {keys}=allKeys();
  $('clist').innerHTML=keys.map(k=>`<button class="cr${k===selectedColorKey?' active':''}" type="button" data-color-select="${esc(k)}"><i style="--swatch:${colorFor(k)}"></i><span class="cl">${esc(keyLabel(k))}</span></button>`).join('');
  const selected=keys.includes(selectedColorKey);$('colorSelectedLabel').textContent=selected?keyLabel(selectedColorKey):'Оберіть зміну';
  $('colorApply').disabled=!selected;$('colorCancel').disabled=!selected;$('colorCancel').style.visibility=selected?'visible':'hidden';$('colorCancel').setAttribute('aria-hidden',String(!selected));$('colorHue').value=draftHue;updateColorDraft();
}
function pointColor(e){const r=$('colorPlane').getBoundingClientRect();draftSat=Math.round(Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*100);draftLight=Math.round((1-Math.max(0,Math.min(1,(e.clientY-r.top)/r.height)))*100);updateColorDraft()}
function pointHue(e){const r=$('colorHueWheel').getBoundingClientRect();draftHue=(Math.round(Math.atan2(e.clientY-r.top-r.height/2,e.clientX-r.left-r.width/2)*180/Math.PI+90)+360)%360;updateColorDraft()}
let armed='';
let scheduleSource=null;
async function loadScheduleSource(){
  if(!sb||!ME||ME.role!=='admin')return;
  const {data,error}=await sb.from('shared_schedule_source').select('*').eq('id',1).maybeSingle();
  if(error){scheduleSource={error:error.message};}
  else scheduleSource=data||null;
  renderScheduleSource();
}
function renderScheduleSource(){
  const admin=!!(ME&&ME.role==='admin');$('sourceManager').hidden=!admin;
  if(!admin)return;
  const has=!!(scheduleSource&&!scheduleSource.error);
  $('sourceUrl').value=has?scheduleSource.source_url:'';
  $('sourceAdd').textContent=has?'Змінити':'Додати посилання';
  $('sourceRefresh').hidden=!has;$('sourceDelete').hidden=!has;
  const st=$('sourceStatus');
  if(scheduleSource&&scheduleSource.error){st.textContent='Не вдалося прочитати налаштування джерела: '+scheduleSource.error+' (перевірте shared_schedule_files.sql у Supabase)';return}
  if(!has){st.textContent='Посилання ще не додано.';return}
  const synced=scheduleSource.last_synced_at?'Остання синхронізація: '+new Date(scheduleSource.last_synced_at).toLocaleString():'Очікує першої синхронізації Apps Script.';
  st.textContent=(scheduleSource.sync_error?'Помилка синхронізації: '+scheduleSource.sync_error+' · ':'')+synced;
}
function extractSheetId(url){try{const u=new URL(url);if(u.hostname.toLowerCase()!=='docs.google.com')return '';const p=u.pathname.split('/'),i=p.indexOf('d');return p[p.indexOf('spreadsheets')+1]==='d'&&p[i+1]?p[i+1]:u.searchParams.get('id')||''}catch(e){return ''}}
async function saveScheduleSource(){
  if(!ME||ME.role!=='admin')return;
  const url=$('sourceUrl').value.trim(),fileId=extractSheetId(url);
  if(!fileId){toast('Вставте коректне посилання Google Таблиці.');return}
  const row={id:1,source_url:url,file_id:fileId,refresh_requested_at:new Date().toISOString(),sync_error:null,updated_by:ME.id,updated_at:new Date().toISOString()};
  const{error}=await sb.from('shared_schedule_source').upsert(row,{onConflict:'id'});
  if(error){toast('Не вдалося зберегти посилання: '+error.message+' (запустіть міграцію shared_schedule_files.sql)');return}
  scheduleSource={...scheduleSource,...row};renderScheduleSource();toast('Посилання збережено. Apps Script синхронізує графік під час наступного запуску.');
}
async function requestScheduleRefresh(){
  if(!scheduleSource||!ME||ME.role!=='admin')return;
  const now=new Date().toISOString(),{error}=await sb.from('shared_schedule_source').update({refresh_requested_at:now,sync_error:null,updated_by:ME.id,updated_at:now}).eq('id',1);
  if(error){toast('Не вдалося запросити оновлення: '+error.message);return}
  scheduleSource.refresh_requested_at=now;scheduleSource.sync_error=null;renderScheduleSource();toast('Оновлення запитано. Apps Script перевірить файл під час наступного запуску.');
}
async function deleteScheduleSource(){
  if(!scheduleSource||!ME||ME.role!=='admin'||!confirm('Видалити посилання та завантажені з нього графіки?'))return;
  const linked=await sb.from('shared_schedule_files').select('*').eq('source_file_id',scheduleSource.file_id);
  if(linked.error){toast('Не вдалося перевірити пов’язані графіки: '+linked.error.message);return}
  const removed=(linked.data||[]).map(r=>({...r,hidden:true,deleted:true,updated_by:ME.id,updated_at:new Date().toISOString()}));
  if(removed.length){const{error}=await sb.from('shared_schedule_files').upsert(removed,{onConflict:'month'});if(error){toast('Не вдалося видалити синхронізовані графіки: '+error.message);return}}
  const{error}=await sb.from('shared_schedule_source').delete().eq('id',1);
  if(error){toast('Не вдалося видалити посилання: '+error.message);return}
  scheduleSource=null;await loadSharedSchedules();renderScheduleSource();toast('Посилання та синхронізовані графіки видалено.');
}
function renderFiles(){
  const current=todayStr().slice(0,7),ks=Object.keys(S.files).sort((a,b)=>a===current?-1:b===current?1:b.localeCompare(a)),admin=!!(ME&&ME.role==='admin');
  $('fileActions').hidden=!admin;$('fAdd').hidden=!admin;
  $('flist').innerHTML=S.demo||!ks.length?'<p class="empty-note" style="padding:16px">Ще немає графіків.</p>':ks.map(k=>{const f=S.files[k],shared=!!f.sharedVersion,isCurrent=k===current;return `<div class="fr${f.hidden?' off':''}${isCurrent?' current-file':''}"><div class="fi"><b>${monthName(k)}${isCurrent?' · Поточний місяць':' · Архів'}${shared?' · Спільний':''}</b><small title="${esc(f.name)}">${esc(f.name)} · ${f.data.people.length} людей · додано ${esc(f.loadedAt)}</small></div><button class="btn source-icon-btn" type="button" data-fview="${k}" aria-label="Відкрити графік" title="Відкрити"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4zM8 9h8M8 13h8M8 17h5"/></svg></button>${admin?`<button class="btn source-icon-btn" type="button" data-fhide="${k}" aria-label="${f.hidden?'Показати':'Сховати'} графік" title="${f.hidden?'Показати':'Сховати'}"><svg viewBox="0 0 24 24" aria-hidden="true">${f.hidden?'<path d="M3 12s3.2-6 9-6 9 6 9 6-3.2 6-9 6-9-6-9-6Z"/><circle cx="12" cy="12" r="2.5"/>':'<path d="m3 3 18 18M10.6 6.2A9.8 9.8 0 0 1 12 6c5.8 0 9 6 9 6a14 14 0 0 1-3.1 3.6M6.2 6.8C4.1 8.1 3 12 3 12s3.2 6 9 6c1 0 1.9-.2 2.7-.5"/>'}</svg></button><button class="btn source-icon-btn danger${armed===k?' armed':''}" type="button" data-fdel="${k}" aria-label="${armed===k?'Підтвердити видалення':'Видалити'}" title="${armed===k?'Підтвердити видалення':'Видалити'}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 13h11l1-13M9 7V4h6v3"/></svg></button>`:''}</div>`}).join('');
}
/* modals */
const MODALS={ov:()=>{save();renderAll()},ov2:()=>save(),ov3:()=>{armed=''},ov4:()=>save()};
function save(){if(!S.demo||S.main||S.sel.length||Object.keys(S.chats).length)saveMeta()}
function openM(id){$(id).hidden=false}
function closeM(id){$(id).hidden=true;(MODALS[id]||(()=>{}))()}
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>closeM(b.dataset.close)));
Object.keys(MODALS).forEach(id=>$(id).addEventListener('click',e=>{if(e.target.id===id)closeM(id)}));
function closeOverview(){$('ovOverview').hidden=true;$('overviewDatePop').hidden=true;$('overviewDateBtn').setAttribute('aria-expanded','false')}
function renderOverviewDatePop(){
  const ym=overviewCalendarMonth,first=ym+'-01',lead=(dowOf(first)+6)%7,n=daysIn(ym);
  let h=`<div class="overview-date-pophead"><button type="button" class="btn ghost sm overview-arrow" data-overview-month="-1" aria-label="Попередній місяць"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 5-7 7 7 7"/></svg></button><b>${monthName(ym)}</b><button type="button" class="btn ghost sm overview-arrow" data-overview-month="1" aria-label="Наступний місяць"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 5 7 7-7 7"/></svg></button></div><div class="mini">`+['Пн','Вт','Ср','Чт','Пт','Сб','Нд'].map(x=>`<span>${x}</span>`).join('')+'<i></i>'.repeat(lead);
  for(let i=1;i<=n;i++){const d=ym+'-'+pad(i);h+=`<button type="button" data-overview-date="${d}" class="${d===overviewCenter?'has':''}">${i}</button>`}
  $('overviewDatePop').innerHTML=h+'</div>';
}
function showOverview(){overviewCenter=todayStr();overviewCalendarMonth=overviewCenter.slice(0,7);$('overviewSearch').value='';$('overviewGroup').value='';$('overviewDatePop').hidden=true;$('overviewDateBtn').setAttribute('aria-expanded','false');renderOverview();$('ovOverview').hidden=false;$('overviewSearch').focus()}
$('overviewOpen').addEventListener('click',showOverview);
$('mOverview').addEventListener('click',showOverview);
$('overviewClose').addEventListener('click',closeOverview);
$('ovOverview').addEventListener('click',e=>{if(e.target===$('ovOverview'))closeOverview()});
$('overviewSearch').addEventListener('input',renderOverview);
$('overviewGroup').addEventListener('change',renderOverview);
$('overviewDateBtn').addEventListener('click',()=>{const pop=$('overviewDatePop'),open=pop.hidden;overviewCalendarMonth=overviewCenter.slice(0,7);renderOverviewDatePop();pop.hidden=!open;$('overviewDateBtn').setAttribute('aria-expanded',String(open))});
$('overviewDatePop').addEventListener('click',e=>{const m=e.target.closest('[data-overview-month]'),d=e.target.closest('[data-overview-date]');if(m){overviewCalendarMonth=shiftYm(overviewCalendarMonth,+m.dataset.overviewMonth);renderOverviewDatePop();return}if(d){overviewCenter=d.dataset.overviewDate;overviewCalendarMonth=overviewCenter.slice(0,7);renderOverview();$('overviewDatePop').hidden=true;$('overviewDateBtn').setAttribute('aria-expanded','false')}});
$('overviewPrev').addEventListener('click',()=>{overviewCenter=addDays(overviewCenter,-3);overviewCalendarMonth=overviewCenter.slice(0,7);$('overviewDatePop').hidden=true;renderOverview()});
$('overviewNext').addEventListener('click',()=>{overviewCenter=addDays(overviewCenter,3);overviewCalendarMonth=overviewCenter.slice(0,7);$('overviewDatePop').hidden=true;renderOverview()});
document.addEventListener('click',e=>{if(!e.target.closest('#overviewDateWrap')){$('overviewDatePop').hidden=true;$('overviewDateBtn').setAttribute('aria-expanded','false')}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){Object.keys(MODALS).forEach(id=>{if(!$(id).hidden)closeM(id)});closeOverview();$('otPop').hidden=true}});

$('addBtn').onclick=()=>{$('q').value='';renderPeople();openM('ov');$('q').focus()};
$('q').oninput=renderPeople;
$('mClear').onclick=()=>{S.sel=[];S.main='';renderPeople()};
$('plist').addEventListener('change',e=>{const id=e.target.dataset.pid;if(id==null)return;S.sel=e.target.checked?[...S.sel,id]:S.sel.filter(x=>x!==id);renderPeople()});
$('peopleSelected').addEventListener('click',e=>{const chip=e.target.closest('[data-selected-remove]');if(!chip)return;const id=chip.dataset.selectedRemove;if(S.main===id)S.main='';else S.sel=S.sel.filter(x=>x!==id);save();renderPeople();renderAll()});
$('plist').addEventListener('click',e=>{
  const me=e.target.closest('[data-me]');if(me){const id=me.dataset.me;S.main=S.main===id?'':id;S.sel=S.sel.filter(x=>x!==id);renderPeople();return}
  const g=e.target.dataset.grp;if(!g)return;peopleSource().filter(p=>p.group===g).forEach(p=>{if(p.id!==S.main&&!S.sel.includes(p.id))S.sel.push(p.id)});renderPeople();
});
$('chips').addEventListener('click',e=>{
  if(e.target.closest('[data-rmmain]')){S.main='';save();renderAll();return}
  const id=e.target.dataset.rm;if(id==null)return;S.sel=S.sel.filter(x=>x!==id);save();renderAll();
});

/* calendar nav */
function go(ym){S.view=ym;save();renderAll()}
$('prevM').onclick=()=>go(shiftYm(S.view,-1));
$('nextM').onclick=()=>go(shiftYm(S.view,1));
$('todayBtn').onclick=()=>go(todayStr().slice(0,7));
$('grid').addEventListener('click',e=>{const c=e.target.closest('[data-go]');if(c)go(c.dataset.go)});
$('note').addEventListener('click',e=>{
  if(e.target.closest('[data-addfile]')){if(ME&&ME.role==='admin')document.getElementById('fileInp').click();else toast('\u0414\u043e\u0434\u0430\u0432\u0430\u0442\u0438\u0020\u0433\u0440\u0430\u0444\u0456\u043a\u0438\u0020\u043c\u043e\u0436\u0443\u0442\u044c\u0020\u043b\u0438\u0448\u0435\u0020\u0430\u0434\u043c\u0456\u043d\u0456\u0441\u0442\u0440\u0430\u0442\u043e\u0440\u0438\u002e')};
  const s=e.target.closest('[data-show]');if(s){S.files[s.dataset.show].hidden=false;saveMeta();renderAll()}
});
$('legend').addEventListener('click',e=>{if(e.target.closest('[data-lg]')){renderColors();openM('ov2')}});

/* colours */
$('clist').addEventListener('click',e=>{const b=e.target.closest('[data-color-select]');if(!b)return;selectedColorKey=b.dataset.colorSelect;draftColor=colorFor(selectedColorKey);renderColors()});
$('colorPlane').addEventListener('pointerdown',e=>{if(!selectedColorKey)return;e.preventDefault();$('colorPlane').setPointerCapture(e.pointerId);pointColor(e)});
$('colorPlane').addEventListener('pointermove',e=>{if(e.buttons&&selectedColorKey)pointColor(e)});
$('colorHueWheel').addEventListener('pointerdown',e=>{if(!selectedColorKey)return;e.preventDefault();$('colorHueWheel').setPointerCapture(e.pointerId);pointHue(e)});
$('colorHueWheel').addEventListener('pointermove',e=>{if(e.buttons&&selectedColorKey)pointHue(e)});
$('colorHue').addEventListener('input',e=>{draftHue=+e.target.value;updateColorDraft()});
$('colorApply').onclick=()=>{if(!selectedColorKey)return;S.colors[selectedColorKey]=draftSat===0&&draftLight>=99?'transparent':draftColor;renderColors();renderCal();saveMeta()};
$('colorCancel').onclick=()=>{selectedColorKey='';draftColor='';renderColors()};
$('colReset').onclick=()=>{S.colors={};renderColors();renderCal()};

/* chats inputs */
$('days').addEventListener('input',e=>{const f=e.target.dataset.f;if(!f)return;const date=e.target.closest('.d').dataset.date;setChat(date,f,e.target.value);refreshChats();renderCal();renderToday()});

/* settings + rate + rank */
$('rank').innerHTML=RANKS.map(r=>`<option value="${r.id}">${r.label} · ${r.pct}%</option>`).join('');
$('rate').addEventListener('input',e=>{S.rate=e.target.value===''?0:Math.max(0,parseFloat(e.target.value)||0);saveMeta();refreshOT();renderSalary()});
$('rank').onchange=e=>{S.rank=e.target.value;saveMeta();renderSalary()};

document.addEventListener('wheel',e=>{
  const input=e.target.closest('input#rate,input#tdN,input#tdP,input[data-f],input[data-x]');
  if(!input||document.activeElement!==input||Math.abs(e.deltaY)<1)return;
  e.preventDefault();
  const step=input.matches('[data-x]')?.25:1;
  const current=parseFloat(String(input.value||'0').replace(',','.'))||0;
  input.value=String(Math.max(0,+(current+(e.deltaY<0?step:-step)).toFixed(2)));
  input.dispatchEvent(new Event('input',{bubbles:true}));
},{passive:false});

/* overtime events */
$('otAdd').onclick=e=>{e.stopPropagation();renderPop();$('otPop').hidden=!$('otPop').hidden};
document.addEventListener('click',e=>{if(!e.target.closest('.popwrap'))$('otPop').hidden=true});
$('otPop').addEventListener('click',e=>{
  const d=e.target.dataset.pd;if(!d)return;
  if(!S.ot[d])S.ot[d]={iv:[{a:'',b:''}],x:'1.5'};
  saveMeta();$('otPop').hidden=true;renderOT();renderCal();renderSalary();
  const inp=$('ot-'+d+'-a0');if(inp){inp.scrollIntoView({block:'nearest'});inp.focus()}
});
$('otList').addEventListener('input',e=>{
  const row=e.target.closest('.otr');if(!row)return;const ent=S.ot[row.dataset.d];const t=e.target;
  if(t.dataset.a!=null){const i=+t.dataset.a,iv=ent.iv[i],oa=parseT(iv.a),ob=parseT(iv.b);iv.a=t.value;const na=parseT(iv.a);
    if(na==null||oa==null||ob==null)iv.b='';else{const nb=(na+((ob-oa+1440)%1440))%1440;iv.b=pad(Math.floor(nb/60))+':'+pad(nb%60)}
    const sel=$('ot-'+row.dataset.d+'-b'+i);sel.disabled=na==null;sel.innerHTML=endOpts(iv)}
  else if(t.dataset.b!=null)ent.iv[+t.dataset.b].b=t.value;
  else if(t.dataset.x!=null)ent.x=t.value;
  else return;
  saveMeta();afterOtChange();
});
$('otList').addEventListener('click',e=>{
  const row=e.target.closest('.otr');if(!row)return;const d=row.dataset.d,ent=S.ot[d];
  if(e.target.closest('[data-otdel]')){delete S.ot[d];saveMeta();renderOT();renderCal();renderSalary();return}
  if(e.target.closest('[data-ivadd]')){ent.iv.push({a:'',b:''});saveMeta();renderOT();const i=ent.iv.length-1;$('ot-'+d+'-a'+i).focus();return}
  const dl=e.target.closest('[data-ivdel]');if(dl){ent.iv.splice(+dl.dataset.ivdel,1);saveMeta();renderOT();renderCal();renderSalary();return}
  if(e.target.closest('input,select,button,label,a'))return;
  if(d<todayStr()){const collapse=!row.classList.contains('ot-collapsed');row.classList.toggle('ot-collapsed',collapse);row.setAttribute('aria-expanded',String(!collapse));if(collapse)otExpandedDays.delete(d);else otExpandedDays.add(d)}
});

/* files */
$('filesBtn').onclick=()=>{renderFiles();openM('ov3');if(ME&&ME.role==='admin')loadScheduleSource()};
$('sourceAdd').onclick=saveScheduleSource;$('sourceRefresh').onclick=requestScheduleRefresh;$('sourceDelete').onclick=deleteScheduleSource;
$('fAdd').onclick=()=>{if(ME&&ME.role==='admin')$('fileInp').click()};
$('fileInp').onchange=e=>{if(ME&&ME.role==='admin')[...e.target.files].forEach(readFile);e.target.value=''};
$('flist').addEventListener('click',async e=>{
  const v=e.target.closest('[data-fview]');if(v){S.view=v.dataset.fview;saveMeta();renderAll();closeM('ov3');return}
  const h=e.target.closest('[data-fhide]');if(h){if(!ME||ME.role!=='admin')return;const k=h.dataset.fhide,f=S.files[k];f.hidden=!f.hidden;if(f.sharedVersion)await persistSharedSchedule(k);else saveMeta();renderFiles();renderAll();return}
  const d=e.target.closest('[data-fdel]');if(d){if(!ME||ME.role!=='admin')return;const k=d.dataset.fdel;
    if(armed!==k){armed=k;renderFiles();return}
    if(S.files[k].sharedVersion){const row=sharedSchedules[k];const{error}=await sb.from('shared_schedule_files').upsert({month:k,name:S.files[k].name,loaded_at:S.files[k].loadedAt,hidden:true,deleted:true,data:S.files[k].data,source_url:row&&row.source_url||null,source_file_id:row&&row.source_file_id||null,updated_by:ME.id,updated_at:new Date().toISOString()},{onConflict:'month'});if(error){toast('Не вдалося видалити спільний графік: '+error.message);return}sharedSchedules[k]={...row,month:k,deleted:true}}
    delete S.files[k];try{localStorage.removeItem(LF+k)}catch(x){}armed='';
    if(!Object.keys(S.files).length){S.main='';S.sel=[];saveMeta();initDemo();renderFiles();renderAll();return}
    cleanSel();if(!S.files[S.view])S.view=Object.keys(S.files).sort().pop();saveMeta();renderFiles();renderAll()}
});
function parseExcelBuffer(buffer,name,source={}){
  if(typeof XLSX==='undefined')throw new Error('Модуль читання Excel не завантажився. Оновіть сторінку.');
  const wb=XLSX.read(buffer,{type:'array'}),found={};
  for(const n of wb.SheetNames){const rows=XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,raw:true,defval:null}),g=parseGrid(rows);if(g){found[g.dates[0].slice(0,7)]=g;break}}
  const ks=Object.keys(found);if(!ks.length)throw new Error('Не знайдено таблицю змін: потрібен рядок із датами місяця та імена у стовпці C.');
  return addFiles(ks.map(k=>({ym:k,data:found[k]})),name,source);
}
function readFile(f){
  if(!ME||ME.role!=='admin'){toast('Додавати графіки можуть лише адміністратори.');return}
  const r=new FileReader();r.onload=()=>{try{parseExcelBuffer(r.result,f.name)}catch(err){toast('Не вдалося прочитати файл: '+err.message)}};r.readAsArrayBuffer(f);
}
async function addFiles(list,name,source={}){
  if(!ME||ME.role!=='admin'){toast('Додавати графіки можуть лише адміністратори.');return}
  const n=new Date(),at=pad(n.getDate())+'.'+pad(n.getMonth()+1)+' '+pad(n.getHours())+':'+pad(n.getMinutes());
  if(S.demo){S.demo=false;S.main='';S.sel=[]}
  for(const {ym,data} of list){
    const row={month:ym,name,loaded_at:at,hidden:false,deleted:false,data,source_url:source.url||null,source_file_id:source.fileId||null,updated_by:ME.id,updated_at:new Date().toISOString()};
    const{error}=await sb.from('shared_schedule_files').upsert(row,{onConflict:'month'});
    if(error){toast('Не вдалося опублікувати графік: '+error.message+' (перевірте міграцію shared_schedule_files.sql у Supabase)');return}
    sharedSchedules[ym]=row;S.files[ym]=index({name,loadedAt:at,hidden:false,data,sharedVersion:row.updated_at,sourceUrl:row.source_url,sourceFileId:row.source_file_id});_sf(ym);
  }
  S.view=list[list.length-1].ym;cleanSel();saveMeta();renderAll();if(!$('ov3').hidden)renderFiles();toast('Графік опубліковано для всіх користувачів.');
}

let dragN=0;
addEventListener('dragenter',e=>{if(!ME||ME.role!=='admin')return;e.preventDefault();dragN++;$('drop').hidden=false});
addEventListener('dragleave',e=>{if(!ME||ME.role!=='admin')return;dragN--;if(dragN<=0){dragN=0;$('drop').hidden=true}});
addEventListener('dragover',e=>{if(ME&&ME.role==='admin')e.preventDefault()});
addEventListener('drop',e=>{if(!ME||ME.role!=='admin')return;e.preventDefault();dragN=0;$('drop').hidden=true;[...(e.dataTransfer?e.dataTransfer.files:[])].forEach(readFile)});
const NORM=7.5,QB=7;
const nrate=ym=>S.qb[ym]?9:7.5;
const fmtN=v=>(Math.round(v*10)/10).toString().replace('.',',');
function dayBase(d){const p=S.main?personAt(S.main,d):null,c=p&&p.sh[d];return c&&c.k==='work'?shiftHours(c,p):(p?0:8)}
const otOf=d=>S.main&&S.ot[d]?otHours(S.ot[d]):0;
const dayHours=d=>dayBase(d)+otOf(d);
function renderToday(){
  const d=todayStr(),p=S.main?personAt(S.main,d):null,c=p?p.sh[d]:null;
  $('tdDate').textContent=WD[dowOf(d)]+' '+pad(+d.slice(8))+'.'+d.slice(5,7)+'.'+d.slice(0,4);
  $('tdWho').textContent=S.main?short(S.main):'';
  const data=fileOf(d.slice(0,7)),leaders=data?data.data.people.filter(x=>(x.isLeader||x.group==='Керівники груп')&&x.sh[d]&&x.sh[d].k==='work'):[];
  $('tdLeaders').innerHTML=leaders.map(x=>{const raw=x.sh[d].s||x.sh[d].r||'',start=(String(raw).match(/\d{1,2}:\d{2}/)||[])[0]||'—',mins=parseT(start),end=mins==null?'—':pad(Math.floor(((mins+540)%1440)/60))+':'+pad((mins+540)%60);return `<span class="leader-chip"><span>${esc(x.name)}</span><small>${esc(start)}–${esc(end)}</small></span>`}).join('');$('tdLeadersWrap').hidden=!leaders.length;
  $('tdInfo').innerHTML=!S.main?'<p class="empty-note">Оберіть основного користувача (★ у «Люди»), щоб побачити обід і перерву.</p>'
    :!c?'<p class="empty-note">Немає даних про зміну на сьогодні.</p>'
    :c.k!=='work'?`<p class="empty-note">${esc(c.x)}</p>`
    :`<div class="stats3"><div class="stat"><small>Зміна</small><b>${esc(c.r||c.s)}</b></div><div class="stat"><small>Обід</small><b>${c.l||'–'}</b></div><div class="stat"><small>Перерва</small><b>${c.b||'–'}</b></div></div>`;
  const cur=CH()[d]||{};
  $('tdN').value=((cur.n!=null?cur.n:(+cur.l||0)+(+cur.b||0)))||'';
  $('tdP').value=cur.p||'';
  refreshToday();
}
function refreshToday(){
  const d=todayStr(),n=Math.max(0,Math.floor(+$('tdN').value)||0),p=Math.max(0,Math.floor(+$('tdP').value)||0);
  const nr=nrate(d.slice(0,7)),net=n-p,h=dayBase(d),oh=otOf(d),norm=nr*(h+oh),diff=net-norm,off=h+oh===0;
  $('tdOt').innerHTML=oh>0?`<div class="stat"><small>На перепрацювання · +${fmtN(oh)} год</small><b>${fmtN(nr*oh)} чатів</b></div>`:'';
  $('tdRes').innerHTML=`<div class="stat"><small title="Без відкладених">Закрито</small><b>${net}</b></div>
    <div class="stat"><small title="${fmtN(h+oh)} год × ${fmtN(nr)}">Норма ${fmtN(nr)}/год</small><b>${fmtN(norm)}</b></div>
    <div class="stat ${off?'':diff>0?'ok':diff<0?'lack':''}"><small>${off?'Вихідний':diff>0?'Перевиконано':diff<0?'До норми':'Норма ✓'}</small><b>${off?'—':diff>0?'+'+fmtN(diff):diff<0?fmtN(-diff):'0'}</b></div>`;
}
$('todayCard').addEventListener('input',refreshToday);
$('tdSave').onclick=()=>{
  const d=todayStr();setChat(d,'n',$('tdN').value);setChat(d,'p',$('tdP').value);
  renderDays();renderCal();renderToday();scrollToday();toast('Збережено в списку чатів за '+pad(+d.slice(8))+'.'+d.slice(5,7));
};

let tt;function toast(m){const t=$('toast');t.textContent=m;t.hidden=false;clearTimeout(tt);tt=setTimeout(()=>t.hidden=true,4200)}

/* theme */
const SUN='<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1"/></svg>';
const MOON='<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M13.5 9.6A5.6 5.6 0 0 1 6.4 2.5 5.6 5.6 0 1 0 13.5 9.6Z"/></svg>';
const THEMES=[['light','Світла',SUN],['light-warm','Світла тепла',SUN],['dark','Темна нічна',MOON],['dark-blue','Темна синя',MOON]];
const effTheme=()=>document.documentElement.dataset.theme||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
function setTheme(t){if(!THEMES.some(x=>x[0]===t))t='light';document.documentElement.dataset.theme=t;try{localStorage.setItem('shifts.theme',t)}catch(e){}themeIcon();renderThemeOptions('themeMenu');renderThemeOptions();if($('themeOptionsModal'))renderThemeOptions('themeOptionsModal')}
function themeIcon(){$('themeBtn').innerHTML=effTheme().startsWith('dark')?SUN:MOON}
function renderThemeOptions(id='themeOptions'){const root=$(id);if(!root)return;const current=effTheme();root.innerHTML=THEMES.map(([key,label,icon])=>`<button class="theme-option${current===key?' active':''}" type="button" data-theme-choice="${key}">${icon}<span>${label}</span></button>`).join('');root.querySelectorAll('[data-theme-choice]').forEach(b=>b.onclick=()=>{setTheme(b.dataset.themeChoice);if(id==='themeMenu'){$('themeMenu').hidden=true;$('themeBtn').setAttribute('aria-expanded','false')}})}
function initTheme(){try{const t=localStorage.getItem('shifts.theme');if(THEMES.some(x=>x[0]===t))document.documentElement.dataset.theme=t}catch(e){}themeIcon();renderThemeOptions();renderThemeOptions('themeMenu')}
$('themeBtn').onclick=()=>{const menu=$('themeMenu'),open=menu.hidden;renderThemeOptions('themeMenu');menu.hidden=!open;$('themeBtn').setAttribute('aria-expanded',String(open))};
document.addEventListener('click',e=>{if(!e.target.closest('.theme-menu-wrap')){$('themeMenu').hidden=true;$('themeBtn').setAttribute('aria-expanded','false')}});

initTheme();load();

/* ===== cloud: auth, database sync, admin, free time ===== */
const CFG=window.APP_CONFIG||{};let sb=null,ME=null,READY=false,pushT=null,IS_MAIN_ADMIN=false,MAIN_ADMIN_EMAILS=[],ADMIN_EXCEPTIONS_OPEN=false;const sharedSchedules={};
const freshS=()=>({files:{},demo:true,demoF:null,demoChats:{},view:'',main:'',sel:[],chats:{},ot:{},rate:null,rank:'spec',cur:'UAH',colors:{},ft:{},qb:{}});
function clearLocal(){Object.keys(localStorage).filter(k=>k===LS||k.startsWith(LF)||k==='shifts.v1').forEach(k=>localStorage.removeItem(k))}
function blob(){const fm={},files={};Object.keys(S.files).forEach(k=>{const f=S.files[k];fm[k]={name:f.name,loadedAt:f.loadedAt,hidden:f.hidden,sharedVersion:f.sharedVersion,sourceUrl:f.sourceUrl,sourceFileId:f.sourceFileId};files[k]=f.data});
  return{meta:{files:fm,main:S.main,sel:S.sel,chats:S.chats,ot:S.ot,rate:S.rate,rank:S.rank,cur:S.cur,colors:S.colors,view:S.view,ft:S.ft,qb:S.qb},files}}
function cloudPush(){if(!sb||!ME||!READY)return;clearTimeout(pushT);pushT=setTimeout(async()=>{const{error}=await sb.from('user_state').upsert({user_id:ME.id,data:blob(),updated_at:new Date().toISOString()});if(error)toast('Не вдалося зберегти в базі: '+error.message)},1500)}
const _sm=saveMeta,_sf=saveFile;saveMeta=function(){_sm();cloudPush()};saveFile=function(k){_sf(k);cloudPush();if(ME&&ME.role==='admin'&&S.files[k]&&S.files[k].sharedVersion)setTimeout(()=>persistSharedSchedule(k),500)};
async function persistSharedSchedule(k){const f=S.files[k];if(!f||!f.sharedVersion||!ME||ME.role!=='admin')return;const row={month:k,name:f.name,loaded_at:f.loadedAt,hidden:!!f.hidden,deleted:false,data:f.data,source_url:f.sourceUrl||null,source_file_id:f.sourceFileId||null,updated_by:ME.id,updated_at:new Date().toISOString()};const{error}=await sb.from('shared_schedule_files').upsert(row,{onConflict:'month'});if(error){toast('Не вдалося зберегти спільний графік: '+error.message);return}f.sharedVersion=row.updated_at;sharedSchedules[k]=row;_sm()}
async function loadSharedSchedules(){
  if(!sb||!ME)return;
  const{data,error}=await sb.from('shared_schedule_files').select('*').order('month');
  if(error){toast('Could not load shared schedules: '+error.message);return}
  Object.keys(sharedSchedules).forEach(k=>delete sharedSchedules[k]);
  let changed=false;
  (data||[]).forEach(row=>{
    sharedSchedules[row.month]=row;
    const local=S.files[row.month];
    if(row.deleted){if(local&&local.sharedVersion){delete S.files[row.month];try{localStorage.removeItem(LF+row.month)}catch(e){}changed=true}return}
    if(!local||!local.sharedVersion||local.sharedVersion!==row.updated_at){
      S.demo=false;
      S.files[row.month]=index({name:row.name,loadedAt:row.loaded_at,hidden:row.hidden,data:row.data,sharedVersion:row.updated_at,sourceUrl:row.source_url,sourceFileId:row.source_file_id});
      lsSet(LF+row.month,row.data);changed=true;
    }
  });
  if(!changed)return;
  if(Object.keys(S.files).length){S.demo=false;if(!S.files[S.view])S.view=Object.keys(S.files).sort().pop();cleanSel()}
  else initDemo();
  _sm();renderAll();
}
let sharedRefreshTimer=0;async function refreshSharedSchedules(){if(!ME)return;await loadSharedSchedules();if(!$('ov3').hidden){renderFiles();if(ME.role==='admin')await loadScheduleSource()}}
function applyCloud(d){clearLocal();lsSet(LS,d.meta);Object.keys(d.files||{}).forEach(k=>lsSet(LF+k,d.files[k]));S=freshS();load();$('rate').value=S.rate!=null?S.rate:(S.demo?140:'');$('rank').value=S.rank;renderAll()}
const gMsg=t=>$('gMsg').textContent=t;
const setAppLoading=on=>{$('webLoading').hidden=!on;$('mobileLoading').hidden=!on;$('topLoadingActions').hidden=!on;$('topMailSlot').hidden=!on};
async function initAuth(){
  setAppLoading(true);
  if(!CFG.SUPABASE_URL||!CFG.SUPABASE_ANON_KEY||!window.supabase){setAppLoading(false);gMsg('Підключення до бази не налаштовано: заповніть config.js (див. README).');$('gStep1').hidden=true;return}
  sb=supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY);
  let ses=null;try{ses=(await sb.auth.getSession()).data.session}catch(e){}
  if(ses){$('gate').hidden=true;enter(ses.user).catch(e=>{setAppLoading(false);$('gate').hidden=false;gMsg("Не вдалося підключитися: "+e.message);$('gStep1').hidden=false})}else{setAppLoading(false);gMsg('Введіть пошту, ми надішлемо одноразовий код для входу.');$('gStep1').hidden=false}
}
$('gSend').onclick=async()=>{const email=$('gEmail').value.trim().toLowerCase();if(!email)return;if(!sb)return;$('gSend').disabled=true;
  const{error}=await sb.auth.signInWithOtp({email,options:{shouldCreateUser:true}});$('gSend').disabled=false;
  if(error){const msg=error.message||'Помилка входу';gMsg(/database error saving new user|registration is allowed only/i.test(msg)?'Нові облікові записи можуть створити лише адреси @novaposhta.ua або адреси, попередньо дозволені головним адміністратором.':'Помилка: '+msg);return}
  gMsg('Код надіслано на '+email+'. Введіть його нижче.');$('gStep1').hidden=true;$('gStep2').hidden=false;$('gCode').focus()};
$('gBack').onclick=()=>{$('gStep2').hidden=true;$('gStep1').hidden=false;gMsg('Введіть пошту, ми надішлемо одноразовий код для входу.')};
$('gVerify').onclick=async()=>{const email=$('gEmail').value.trim().toLowerCase(),token=$('gCode').value.trim();if(!token)return;
  const{data,error}=await sb.auth.verifyOtp({email,token,type:'email'});
  if(error){gMsg('Невірний або прострочений код.');return}enter(data.user)};
$('gEmail').onkeydown=e=>{if(e.key==='Enter')$('gSend').click()};$('gCode').onkeydown=e=>{if(e.key==='Enter')$('gVerify').click()};
async function enter(user){
  const own=localStorage.getItem('shifts.owner');
  if(own&&own!==user.id){clearLocal();S=freshS();load();renderAll()}
  localStorage.setItem('shifts.owner',user.id);
  const{data:pr}=await sb.from('profiles').select('*').eq('id',user.id).maybeSingle();
  if(!pr){gMsg('Профіль не знайдено. Перевірте, що виконано supabase/schema.sql.');$('gStep1').hidden=false;return}
  ME=pr;document.body.dataset.role=ME.role;try{const{data:main}=await sb.rpc('is_super_admin');IS_MAIN_ADMIN=main===true}catch(e){IS_MAIN_ADMIN=false}
  const{data:st}=await sb.from('user_state').select('data').eq('user_id',user.id).maybeSingle();
  if(st&&st.data&&st.data.meta)applyCloud(st.data);
  READY=true;if(!(st&&st.data&&st.data.meta))cloudPush();
  $('gate').hidden=true;setAppLoading(false);$('meMail').textContent=ME.email;$('meMail').hidden=false;$('outBtn').hidden=false;
  $('admBtn').hidden=ME.role!=='admin';$('dataBtn').hidden=false;$('ftOpen').hidden=!(ME.role==='admin'||ME.can_free_time);renderFiles();loadScheduleSource().catch(e=>toast('Не вдалося прочитати налаштування джерела: '+e.message));if(sharedRefreshTimer)clearInterval(sharedRefreshTimer);sharedRefreshTimer=setInterval(()=>{if(document.visibilityState==='visible')refreshSharedSchedules()},60000);loadSharedSchedules().catch(e=>toast('Не вдалося оновити спільні графіки: '+e.message));if(location.hash==='#data')$('dataBtn').click();else if(location.hash==='#admin'&&ME.role==='admin')$('admBtn').click();
}
$('outBtn').onclick=async()=>{await sb.auth.signOut();clearLocal();localStorage.removeItem('shifts.owner');location.reload()};
/* admin */
async function callAdmin(action,extra={}){
  const{data,error}=await sb.functions.invoke('admin-management',{body:{action,...extra}});
  if(error){let msg=error.message||'Помилка адміністративної дії';try{const r=error.context;if(r&&typeof r.json==='function'){const j=await r.json();msg=j.error||msg}}catch(e){}toast(msg);return null}
  if(data&&data.error){toast(data.error);return null}return data;
}
async function renderAdm(){
  const[{data,error},controls]=await Promise.all([
    sb.from('profiles').select('*').order('email'),
    callAdmin('get_controls')
  ]);
  if(error){$('admList').textContent=error.message;return}
  if(controls){IS_MAIN_ADMIN=!!controls.caller_is_main;MAIN_ADMIN_EMAILS=controls.main_admin_emails||[]}else{IS_MAIN_ADMIN=false;MAIN_ADMIN_EMAILS=[]}
  $('exceptionToggle').hidden=!IS_MAIN_ADMIN;
  $('adminAccessTools').hidden=!IS_MAIN_ADMIN||!ADMIN_EXCEPTIONS_OPEN;
  $('exceptionToggle').textContent=ADMIN_EXCEPTIONS_OPEN?'Закрити винятки':'Керувати винятками для пошти';
  $('exceptionRows').innerHTML=IS_MAIN_ADMIN?(controls.exceptions||[]).map(x=>`<div class="admin-access-row"><span>${esc(x.email)}</span><button class="btn ghost sm" type="button" data-exception-remove="${esc(x.email)}">Видалити виняток</button></div>`).join('')||'<small class="hint">Винятків поки немає.</small>':'';
  const warning=!controls?'<p class="empty-note">Не вдалося завантажити керування доступом. Перевірте міграцію admin_access.sql і розгортання Edge Function admin-management.</p>':'';
  const mainUsers=[],admins=[],regularUsers=[];
  data.forEach(u=>{const primary=MAIN_ADMIN_EMAILS.includes(String(u.email||'').toLowerCase());if(primary)mainUsers.push(u);else if(u.role==='admin')admins.push(u);else regularUsers.push(u)});
  const row=u=>{
    const email=String(u.email||''),primary=MAIN_ADMIN_EMAILS.includes(email.toLowerCase()),isAdmin=u.role==='admin';
    const badge=primary?'Головний адміністратор':isAdmin?'Адміністратор':'Користувач';
    const roleAction=IS_MAIN_ADMIN&&!primary?`<button class="btn sm" type="button" data-admin-action="${isAdmin?'revoke':'grant'}" data-uid="${u.id}">${isAdmin?'Забрати адміна':'Надати адміна'}</button>`:'';
    const freeTime=`<label><input type="checkbox" data-ft-user="${u.id}" ${isAdmin||u.can_free_time?'checked':''} ${isAdmin?'disabled':''}> Вільний час</label>`;
    const canDelete=!primary&&u.id!==ME.id&&(!isAdmin||IS_MAIN_ADMIN);
    const remove=canDelete?`<button class="btn ghost sm danger" type="button" data-admin-action="delete" data-uid="${u.id}">Видалити профіль</button>`:'';
    return `<div class="admin-user-row"><span class="admin-user-label">${esc(email)} <small class="sub2">${badge}</small></span><div class="admin-user-actions">${freeTime}${roleAction}${remove}</div></div>`;
  };
  const section=(title,items)=>`<section class="admin-section"><h4>${title}<span>${items.length}</span></h4>${items.map(row).join('')}</section>`;
  $('admList').innerHTML=warning+section('Головні адміністратори',mainUsers)+section('Адміністратори',admins)+section('Звичайні користувачі',regularUsers);
}
$('admBtn').onclick=()=>{$('ov5').hidden=false;renderAdm()};
$('admClose').onclick=()=>{$('ov5').hidden=true};
$('exceptionToggle').onclick=()=>{ADMIN_EXCEPTIONS_OPEN=!ADMIN_EXCEPTIONS_OPEN;$('adminAccessTools').hidden=!ADMIN_EXCEPTIONS_OPEN;$('exceptionToggle').textContent=ADMIN_EXCEPTIONS_OPEN?'Закрити винятки':'Керувати винятками для пошти'};
$('exceptionAdd').onclick=async()=>{const email=$('exceptionEmail').value.trim();if(!email)return;const ok=await callAdmin('add_exception',{email});if(ok){$('exceptionEmail').value='';toast('Виняток додано');renderAdm()}};
$('exceptionEmail').onkeydown=e=>{if(e.key==='Enter')$('exceptionAdd').click()};
$('admList').addEventListener('change',async e=>{const t=e.target.closest('[data-ft-user]');if(!t)return;const old=!t.checked,ok=await callAdmin('set_free_time',{user_id:t.dataset.ftUser,can_free_time:t.checked});if(!ok)t.checked=old;else toast(t.checked?'Доступ до вільного часу надано':'Доступ до вільного часу прибрано')});
$('admList').addEventListener('click',async e=>{
  const b=e.target.closest('[data-admin-action]');if(!b)return;const action=b.dataset.adminAction,userId=b.dataset.uid;
  if(action==='delete'&&!confirm('Видалити обліковий запис і всі пов’язані з ним дані? Цю дію не можна скасувати.'))return;
  if(action==='revoke'&&!confirm('Забрати права адміністратора в цього користувача?'))return;
  const ok=action==='delete'?await callAdmin('delete_user',{user_id:userId}):await callAdmin('set_admin',{user_id:userId,can_free_time:action==='grant'});
  if(ok){toast(action==='delete'?'Обліковий запис видалено':action==='grant'?'Права адміністратора надано':'Права адміністратора забрано');renderAdm()}
});
$('exceptionRows').addEventListener('click',async e=>{const b=e.target.closest('[data-exception-remove]');if(!b)return;if(!confirm(`Забрати дозвіл для ${b.dataset.exceptionRemove}?`))return;const ok=await callAdmin('remove_exception',{email:b.dataset.exceptionRemove});if(ok){toast('Виняток видалено');renderAdm()}});const nextYM=ym=>{const y=+ym.slice(0,4),m=+ym.slice(5);return m===12?(y+1)+'-01':y+'-'+pad(m+1)};
const fdm=(ym,o)=>WD[dowOf(ym+'-'+pad(o.day))]+' '+pad(o.day)+'.'+ym.slice(5)+(ym.slice(0,4)!==S.view.slice(0,4)?'.'+ym.slice(0,4):'');
/* free time */
const fmtMin=m=>m>=60?Math.floor(m/60)+' год'+(m%60?' '+m%60+' хв':''):m+' хв';
const ftMinutes=e=>{let t=+e.m||0;e.iv.forEach(i=>{const a=parseT(i.a),b=parseT(i.b);if(a!=null&&b!=null)t+=(b-a+1440)%1440});return t};
const ftDays=()=>Object.keys(S.ft).filter(d=>d.startsWith(S.view)).sort((a,b)=>b.localeCompare(a));
function ftSummary(){const ds=ftDays(),t=ds.reduce((a,d)=>a+ftMinutes(S.ft[d]),0);$('ftSumM').textContent=fmtMin(t);$('ftAvg').textContent=ds.length?fmtMin(Math.round(t/ds.length)):'—';$('ftCnt').textContent=ds.length?'· '+ds.length+' дн.':''}
function renderFt(){
  $('ftMonth').textContent=monthName(S.view);
  $('ftList').innerHTML=ftDays().map(d=>{const e=S.ft[d];
    const ivs=e.iv.map((i,k)=>`<span class="iv"><input type="time" data-fa="${k}" value="${i.a}" aria-label="Початок"><span>–</span><input type="time" data-fb="${k}" value="${i.b}" aria-label="Кінець"><button type="button" data-fid="${k}" aria-label="Прибрати інтервал">✕</button></span>`).join('');
    const collapsed=d<todayStr()&&!ftExpandedDays.has(d);
    return `<div class="otr ft-entry${collapsed?' ft-collapsed':''}" data-d="${d}" aria-expanded="${!collapsed}"><div class="otd"><b>${+d.slice(8)}</b><small>${WD[dowOf(d)]}</small></div><div class="ft-collapsed-summary"><span>${fmtMin(ftMinutes(e))} вільного часу</span></div><div class="otres"><div class="oth" data-t>${fmtMin(ftMinutes(e))}</div><div class="otm">вільний час</div></div><button class="btn ghost sm otdel delete-icon" type="button" data-fdel aria-label="Видалити день" title="Видалити"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 13h11l1-13M9 7V4h6v3"/></svg></button><div class="otfoot"><div class="ivs">${ivs}<button class="btn ghost sm" type="button" data-fadd>+ інтервал</button></div></div></div>`}).join('')||'<p class="empty-note">За цей місяць записів ще немає.</p>';
  ftSummary();
}
$('ftList').addEventListener('input',e=>{const t=e.target,row=t.closest('.otr');if(!row)return;const en=S.ft[row.dataset.d];if(!en)return;
  if(t.dataset.fa!=null)en.iv[+t.dataset.fa].a=t.value;else if(t.dataset.fb!=null)en.iv[+t.dataset.fb].b=t.value;else if(t.dataset.fm!=null)en.m=Math.max(0,Math.floor(+t.value)||0);else return;
  saveMeta();row.querySelector('[data-t]').textContent=fmtMin(ftMinutes(en));ftSummary()});
$('ftList').addEventListener('click',e=>{const row=e.target.closest('.otr');if(!row)return;const d=row.dataset.d,en=S.ft[d];if(!en)return;
  if(e.target.closest('[data-fdel]'))delete S.ft[d];
  else if(e.target.closest('[data-fadd]'))en.iv.push({a:'',b:''});
  else if(e.target.closest('[data-fid]')){const b=e.target.closest('[data-fid]');en.iv.splice(+b.dataset.fid,1)}
  else if(e.target.closest('input,select,button,label,a'))return;
  else if(d<todayStr()){const collapse=!row.classList.contains('ft-collapsed');row.classList.toggle('ft-collapsed',collapse);row.setAttribute('aria-expanded',String(!collapse));if(collapse)ftExpandedDays.delete(d);else ftExpandedDays.add(d);return}
  saveMeta();renderFt()});
function renderFtPop(){const first=S.view+'-01',lead=(dowOf(first)+6)%7,n=daysIn(S.view);
  let h=`<h4>${monthName(S.view)}</h4><div class="mini">`+['Пн','Вт','Ср','Чт','Пт','Сб','Нд'].map(x=>`<span>${x}</span>`).join('')+'<i></i>'.repeat(lead);
  for(let i=1;i<=n;i++){const d=S.view+'-'+pad(i);h+=`<button type="button" data-pd="${d}" class="${S.ft[d]?'has':''}">${i}</button>`}
  $('ftPop').innerHTML=h+'</div>'}
$('ftAddDay').onclick=e=>{e.stopPropagation();renderFtPop();$('ftPop').hidden=!$('ftPop').hidden};
document.addEventListener('click',e=>{if(!e.target.closest('#ov6 .popwrap'))$('ftPop').hidden=true});
$('ftPop').addEventListener('click',e=>{const d=e.target.dataset.pd;if(!d)return;if(!S.ft[d])S.ft[d]={iv:[{a:'',b:''}],m:0};saveMeta();$('ftPop').hidden=true;renderFt()});
$('ftOpen').onclick=()=>{$('ftPop').hidden=true;$('ov6').hidden=false;renderFt()};
const ftClose=()=>{$('ov6').hidden=true;if(document.body.dataset.tab==='ft'){document.body.dataset.tab='cal';document.querySelectorAll('#mNav [data-tab]').forEach(b=>b.classList.toggle('on',b.dataset.tab==='cal'))}};
$('ftClose').onclick=ftClose;$('ov6').addEventListener('mousedown',e=>{if(e.target===$('ov6'))ftClose()});
/* zoom a block to focus on it */
let zoomEl=null;
let zoomPlaceholder=null;
function zoomOff(){if(!zoomEl)return;zoomEl.classList.remove('zoom');zoomEl.querySelector('.zbtn').innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg>';zoomPlaceholder?.remove();zoomPlaceholder=null;$('zoomPeople').hidden=true;zoomEl=null;$('zbk').hidden=true;document.body.style.overflow='';syncChart()}
document.addEventListener('click',e=>{const add=e.target.closest('#zoomPeopleAdd');if(add){$('addBtn').click();return}const b=e.target.closest('[data-zoom]');if(!b)return;const el=b.closest('.card');if(el===zoomEl){zoomOff();return}zoomOff();const r=el.getBoundingClientRect();zoomPlaceholder=document.createElement('div');zoomPlaceholder.className='card zoom-placeholder';zoomPlaceholder.style.width=r.width+'px';zoomPlaceholder.style.height=r.height+'px';el.before(zoomPlaceholder);zoomEl=el;el.classList.add('zoom');if(el.classList.contains('cal')){$('zoomPeople').innerHTML='<b>Відстежую</b><span>'+$('chips').innerHTML+'</span><button class="btn sm" type="button" id="zoomPeopleAdd">+ Люди</button>';$('zoomPeople').hidden=false}b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8h8v8H8zM3 8V3h5m8 0h5v5M3 16v5h5m8 0h5v-5"/></svg>';$('zbk').hidden=false;document.body.style.overflow='hidden';syncChart()});
$('zbk').onclick=zoomOff;
document.addEventListener('keydown',e=>{if(e.key==='Escape'){zoomOff();ftClose()}});
/* ===== */
/* chat level by daily norm: r < 50%, y >= 50%, g >= norm */
function chLevel(d,v){const norm=nrate(d.slice(0,7))*dayHours(d);if(v<=0)return{norm,ratio:0,cls:v<0?'r':''};const ratio=norm>0?v/norm:Infinity;return{norm,ratio,cls:ratio>=1?'g':ratio>=.5?'y':'r'}}
let chartOn=localStorage.getItem('shifts.chart')!=='0';
function syncChart(){const on=!!(zoomEl&&zoomEl.classList.contains('side')&&chartOn);document.body.classList.toggle('zchart',on);$('chartP').hidden=!on;$('chartToggle').textContent=chartOn?'Сховати графік':'Показати графік';if(on)renderChart()}
function renderChart(){
  const n=daysIn(S.view),st=CH(),W=560,H=300,L=34,Rg=8,T=14,B=26,pw=W-L-Rg,ph=H-T-B,rows=[];let mx=1;
  for(let i=1;i<=n;i++){const d=S.view+'-'+pad(i),v=chTotal(st[d]),lv=chLevel(d,v);rows.push({i,v,norm:lv.norm,cls:lv.cls});mx=Math.max(mx,v,lv.norm)}
  const step=mx<=20?5:mx<=60?10:mx<=150?25:50,top=Math.ceil(mx*1.05/step)*step,y=v=>T+ph-v/top*ph,bw=pw/n,col={g:'--good',y:'--warn',r:'--bad'};
  let g='',bars='',nl='';
  for(let v=0;v<=top;v+=step)g+=`<line x1="${L}" x2="${W-Rg}" y1="${y(v)}" y2="${y(v)}" style="stroke:var(--line)"/><text x="${L-6}" y="${y(v)+3}" text-anchor="end" style="fill:var(--muted);font-size:10px">${v}</text>`;
  rows.forEach(r=>{const x=L+(r.i-1)*bw;
    if(r.v>0)bars+=`<rect x="${x+bw*.15}" y="${y(r.v)}" width="${bw*.7}" height="${Math.max(1,T+ph-y(r.v))}" rx="2" style="fill:var(${col[r.cls]||'--bad'})"><title>${pad(r.i)}.${S.view.slice(5)}: ${r.v} (норма ${fmtN(r.norm)})</title></rect>`;
    if(r.norm>0)nl+=`<line x1="${x+1}" x2="${x+bw-1}" y1="${y(r.norm)}" y2="${y(r.norm)}" style="stroke:var(--fg);stroke-width:1.6;stroke-dasharray:3 2"/>`;
    if(r.i%2===1||n<=16)g+=`<text x="${x+bw/2}" y="${H-8}" text-anchor="middle" style="fill:var(--muted);font-size:9.5px">${r.i}</text>`});
  $('chSvg').innerHTML=`<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Чати по днях">${g}${bars}${nl}</svg>`;
  $('chMonth').textContent=monthName(S.view);
}
$('chartToggle').onclick=()=>{chartOn=!chartOn;try{localStorage.setItem('shifts.chart',chartOn?'1':'0')}catch(e){}syncChart()};
/* export / import */
const canFt=()=>!!ME&&(ME.role==='admin'||ME.can_free_time);
$('dataBtn').onclick=()=>{$('dataWhat').textContent='У файл потрапляють чати, перепрацювання'+(canFt()?', вільний час':'')+' та налаштування (тема, ставка, розряд, кольори змін). Графіки змін (xlsx) не входять, їх додають окремо.';$('ov7').hidden=false};
$('dataClose').onclick=()=>{$('ov7').hidden=true};
$('ov7').addEventListener('mousedown',e=>{if(e.target===$('ov7'))$('ov7').hidden=true});
$('expBtn').onclick=()=>{const o={app:'grafik-zmin',v:1,exported:new Date().toISOString(),chats:S.chats,ot:S.ot,settings:{theme:document.documentElement.dataset.theme||null,rate:S.rate,rank:S.rank,cur:S.cur,colors:S.colors}};if(canFt())o.ft=S.ft;
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(o,null,1)],{type:'application/json'}));a.download='grafik-data-'+todayStr()+'.json';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)};
$('impBtn').onclick=()=>$('impInp').click();
$('impInp').onchange=async e=>{
  const f=e.target.files[0];e.target.value='';if(!f)return;
  let o;try{o=JSON.parse(await f.text())}catch(x){toast('Файл не схожий на експорт: некоректний JSON.');return}
  if(!o||typeof o!=='object'||o.app!=='grafik-zmin'){toast('Це не файл експорту цього сайту.');return}
  const mode=document.querySelector('input[name=impMode]:checked').value;
  const isD=k=>/^\d{4}-\d{2}-\d{2}$/.test(k),tv=v=>{v=String(v||'');return /^\d{2}:\d{2}$/.test(v)?v:''},nn=v=>Math.max(0,Math.floor(+v)||0);
  const ivs=a=>(Array.isArray(a)?a:[]).map(i=>({a:tv(i&&i.a),b:tv(i&&i.b)}));
  const chats={},ot={},ft={};
  Object.entries(o.chats||{}).forEach(([d,c])=>{if(!isD(d)||!c||typeof c!=='object')return;const r={};['n','p','l','b'].forEach(k=>{if(c[k]!=null)r[k]=nn(c[k])});if(Object.keys(r).length)chats[d]=r});
  Object.entries(o.ot||{}).forEach(([d,x])=>{if(isD(d)&&x&&typeof x==='object')ot[d]={iv:ivs(x.iv),x:String(x.x!=null?x.x:'1.5')}});
  const withFt=canFt()&&o.ft&&typeof o.ft==='object';
  if(withFt)Object.entries(o.ft).forEach(([d,x])=>{if(isD(d)&&x&&typeof x==='object')ft[d]={iv:ivs(x.iv),m:nn(x.m)}});
  const st=o.settings&&typeof o.settings==='object'?o.settings:null,sets={};
  if(st){
    if(st.theme==='light'||st.theme==='dark')sets.theme=st.theme;
    if(st.rate===null||(typeof st.rate==='number'&&isFinite(st.rate)&&st.rate>=0))sets.rate=st.rate;
    if(typeof st.rank==='string'&&[...$('rank').options].some(x=>x.value===st.rank))sets.rank=st.rank;
    if(typeof st.cur==='string'&&CURS[st.cur])sets.cur=st.cur;
    if(st.colors&&typeof st.colors==='object'){sets.colors={};Object.entries(st.colors).forEach(([k,v])=>{if(typeof v==='string'&&k.length<=120&&/^#[0-9a-f]{3,8}$/i.test(v))sets.colors[k]=v})}
  }
  if(mode==='replace'){S.chats=chats;S.ot=ot;if(withFt)S.ft=ft}else{Object.assign(S.chats,chats);Object.assign(S.ot,ot);if(withFt)Object.assign(S.ft,ft)}
  if('rate' in sets)S.rate=sets.rate;if(sets.rank)S.rank=sets.rank;if(sets.cur)S.cur=sets.cur;
  if(sets.colors)S.colors=mode==='replace'?sets.colors:Object.assign(S.colors,sets.colors);
  if(sets.theme){document.documentElement.dataset.theme=sets.theme;try{localStorage.setItem('shifts.theme',sets.theme)}catch(x){}themeIcon()}
  $('rate').value=S.rate!=null?S.rate:(S.demo?140:'');$('rank').value=S.rank;
  saveMeta();renderAll();$('ov7').hidden=true;
  toast('Імпортовано: чати '+Object.keys(chats).length+' дн., перепрацювання '+Object.keys(ot).length+' дн.'+(withFt?', вільний час '+Object.keys(ft).length+' дн.':''));
};

$('qbChk').onchange=e=>{S.qb[S.view]=e.target.checked;saveMeta();renderSalary();refreshToday();refreshChats();renderCal()};

// Desktop module visibility is a local presentation preference; mobile tabs remain unchanged.
const DESKTOP_MODULES_KEY='shifts.desktopModules.v1';
const desktopModules={today:true,chats:true,ot:true,pay:true};
try{Object.assign(desktopModules,JSON.parse(localStorage.getItem(DESKTOP_MODULES_KEY)||'{}'))}catch{}
function applyDesktopModules(){
  const layout=document.querySelector('.layout');if(!layout)return;
  layout.classList.toggle('module-hide-today',!desktopModules.today);
  layout.classList.toggle('module-hide-chats',!desktopModules.chats);
  layout.classList.toggle('module-hide-ot',!desktopModules.ot);
  layout.classList.toggle('module-hide-pay',!desktopModules.pay);
  document.querySelectorAll('[data-module-toggle]').forEach(input=>input.checked=desktopModules[input.dataset.moduleToggle]!==false);
}
applyDesktopModules();
$('moduleMenuBtn').addEventListener('click',()=>{const menu=$('moduleMenu'),open=menu.hidden;menu.hidden=!open;$('moduleMenuBtn').setAttribute('aria-expanded',String(open))});
$('moduleMenu').addEventListener('change',e=>{const input=e.target.closest('[data-module-toggle]');if(!input)return;desktopModules[input.dataset.moduleToggle]=input.checked;try{localStorage.setItem(DESKTOP_MODULES_KEY,JSON.stringify(desktopModules))}catch{}applyDesktopModules()});
document.addEventListener('click',e=>{if(!e.target.closest('#moduleMenuWrap')){$('moduleMenu').hidden=true;$('moduleMenuBtn').setAttribute('aria-expanded','false')}});

$('rate').value=S.rate!=null?S.rate:(S.demo?140:'');
$('rank').value=S.rank;
renderAll();initAuth();

/* ===== mobile app shell (<=760px): tabs, swipe, settings sheet, PWA ===== */
(function(){
  const mq=matchMedia('(max-width:760px)'),body=document.body;
  function setTab(t){
    body.dataset.tab=t;
    document.querySelectorAll('#mNav [data-tab]').forEach(b=>b.classList.toggle('on',b.dataset.tab===t));
    renderTop();
    if(t==='chats')requestAnimationFrame(()=>{scrollToday()});
    const l=document.querySelector('.layout');if(l)l.scrollTop=0;
  }
  $('mNav').addEventListener('click',e=>{
    const b=e.target.closest('[data-tab]');if(!b)return;
    if(b.dataset.tab==='ft'&&$('ftOpen').hidden){toast('Щоб отримати доступ до цієї функції, зверніться до адміністратора.');return}
    if(b.dataset.tab==='ft'){$('ov6').hidden=false;$('ftPop').hidden=true;renderFt();setTab('ft');return}
    $('ov6').hidden=true;
    setTab(b.dataset.tab);
  });
  /* month title in non-calendar tabs: keep "section + month" in sync after any re-render */
  const _rt=renderTop;renderTop=function(){_rt();if(body.dataset.tab!=='cal'){const t=body.dataset.tab,mn=monthName(S.view).split(' ');$('mTM').textContent=({today:'Сьогодні',chats:'Закрито чатів',ot:'Переробка',pay:'Зарплата',ft:'Вільний час'})[t]||'';$('mTY').textContent=mn[0].toLowerCase()+' '+mn.slice(1).join(' ')}};
  $('mTitle').onclick=()=>{$('todayBtn').click()};
  $('mPrev').onclick=()=>$('prevM').click();
  $('mNext').onclick=()=>$('nextM').click();
  $('mFiles').onclick=()=>$('filesBtn').click();
  $('mFab').onclick=()=>$('addBtn').click();

  /* free-time tab only with access */
  const ftb=$('ftOpen'),ftt=$('mFtTab');
  const syncFt=()=>{ftt.hidden=false;ftt.classList.toggle('ft-locked',ftb.hidden);ftt.setAttribute('aria-disabled',String(ftb.hidden));ftt.setAttribute('aria-label',ftb.hidden?'Вільний час недоступний — зверніться до адміністратора':'Вільний час')};
  new MutationObserver(syncFt).observe(ftb,{attributes:true,attributeFilter:['hidden']});syncFt();

  /* swipe the calendar up/down to change month */
  const g=$('grid');let sx=null,sy=0,st=0;
  g.addEventListener('touchstart',e=>{if(e.touches.length!==1){sx=null;return}sx=e.touches[0].clientX;sy=e.touches[0].clientY;st=Date.now()},{passive:true});
  g.addEventListener('touchend',e=>{
    if(sx==null||!mq.matches)return;
    const t=e.changedTouches[0],dx=t.clientX-sx,dy=t.clientY-sy;sx=null;
    if(Math.abs(dy)>45&&Math.abs(dy)>Math.abs(dx)*1.3&&Date.now()-st<900)swipe(dy<0?1:-1);
  },{passive:true});
  g.addEventListener('touchcancel',()=>{sx=null},{passive:true});
  function swipe(n){
    go(shiftYm(S.view,n));
    g.classList.remove('sw-next','sw-prev');void g.offsetWidth;g.classList.add(n>0?'sw-next':'sw-prev');
  }
  g.addEventListener('animationend',()=>g.classList.remove('sw-next','sw-prev'));
  /* keyboard/mouse fallback on narrow desktop windows */
  g.addEventListener('wheel',e=>{if(!mq.matches||Math.abs(e.deltaY)<40)return;e.preventDefault();if(swipe.t&&Date.now()-swipe.t<500)return;swipe.t=Date.now();swipe(e.deltaY>0?1:-1)},{passive:false});

  /* settings sheet */
  const sh=$('ovS');
  function sheetOpen(){
    $('sMail').textContent=$('meMail').textContent||'';
    $('sAdm').hidden=$('admBtn').hidden;$('sData').hidden=$('dataBtn').hidden;$('sOut').hidden=$('outBtn').hidden;
    renderThemeOptions();
    sh.hidden=false;
  }
  $('mSet').onclick=sheetOpen;
  $('settingsContact').onclick=()=>{$('ovS').hidden=true;$('contactOverlay').hidden=false};
  $('themeOpen').onclick=()=>{renderThemeOptions();$('themeOverlay').hidden=false};
  $('themeClose').onclick=()=>$('themeOverlay').hidden=true;
  $('themeOverlay').addEventListener('click',e=>{if(e.target===$('themeOverlay'))$('themeOverlay').hidden=true});
  $('sClose').onclick=()=>{sh.hidden=true};
  sh.addEventListener('click',e=>{
    if(e.target===sh){sh.hidden=true;return}
    const b=e.target.closest('[data-s]');if(!b)return;
    const a=b.dataset.s;
    if(a==='theme'){renderThemeOptions();return}
    sh.hidden=true;
    if(a==='cur')openM('ov4');
    else if(a==='colors'){renderColors();openM('ov2')}
    else if(a==='data')$('dataBtn').click();
    else if(a==='adm')$('admBtn').click();
    else if(a==='out')$('outBtn').click();
  });

  /* PWA: offline shell */
  if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol)){
    addEventListener('load',()=>{navigator.serviceWorker.register('sw.js').catch(()=>{})});
  }
})();

