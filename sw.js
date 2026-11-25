/* Service worker: офлайн-оболонка застосунку. Дані користувача живуть у Supabase і сюди не кешуються. */
const VER='v346';
const SHELL=['./','index.html','templates.html','config.js','manifest.webmanifest','styles.css','app.js','templates.css','templates.js','image/info_wages_pc.png','image/info_wages_mobile.png','icons/icon-192.png','icons/icon-512.png','icons/icon-maskable-512.png','icons/apple-touch-icon.png'];
const LIBS=['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js','https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'];
const CDN=/^https:\/\/(cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;

self.addEventListener('install',e=>{
  e.waitUntil((async()=>{
    const c=await caches.open(VER);
    await Promise.allSettled(SHELL.map(u=>c.add(new Request(u,{cache:'reload'}))));
    await Promise.allSettled(LIBS.map(u=>c.add(new Request(u,{mode:'no-cors'}))));
    self.skipWaiting();
  })());
});
self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    for(const k of await caches.keys())if(k!==VER)await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;
  const u=new URL(r.url);
  if(u.origin===location.origin){
    /* свій сайт: спершу мережа (щоб оновлення приходили одразу), без мережі - кеш */
    e.respondWith((async()=>{
      try{
        const res=await fetch(r);
        if(res&&res.ok){const c=await caches.open(VER);c.put(r,res.clone())}
        return res;
      }catch(err){
        const c=await caches.open(VER);
        return (await c.match(r,{ignoreSearch:true}))||(r.mode==='navigate'?await c.match('index.html'):undefined)||Response.error();
      }
    })());
    return;
  }
  if(CDN.test(r.url)){
    /* бібліотеки й шрифти: з кешу, у фоні оновлюємо */
    e.respondWith((async()=>{
      const c=await caches.open(VER),hit=await c.match(r);
      const net=fetch(r).then(res=>{if(res&&(res.ok||res.type==='opaque'))c.put(r,res.clone());return res}).catch(()=>null);
      return hit||(await net)||Response.error();
    })());
  }
  /* Supabase та інше: напряму в мережу */
});



