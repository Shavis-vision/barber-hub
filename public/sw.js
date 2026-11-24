// Trabalhador de fundo do Cortesy.
// Regra: SEMPRE busca na internet primeiro (nunca prende o usuário numa versão antiga).
// Só quando o celular está sem conexão mostra a página "Sem conexão".
const CACHE = "cortesy-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL, "/icons/icon-192.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  // Só páginas (navegação). Dados do Supabase, imagens e scripts seguem direto para a internet.
  if (request.mode !== "navigate") return;
  event.respondWith(
    fetch(request).catch(async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match(OFFLINE_URL)) || Response.error();
    }),
  );
});
