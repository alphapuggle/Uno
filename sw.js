self.addEventListener('install', function(e) {
    e.waitUntil(
      caches.open('Uno').then(function(cache) {
        //Preload images
        var filesToCache = ["/ErrorPages/OFFLINE.html","./","/Uno","./index.html","./Client.js","./Style.css","./Uno.webmanifest","./Cards/unoFavicon-512.webp","./Cards/unoFavicon-192.webp",]
        for (color = 0; color < 4; color++) {
            for (number = 0; number < 10; number++) {
                filesToCache.push(`./Cards/${["RED", "GREEN", "BLUE", "YELLOW"][color]}_${number}.webp`);
            }
            for (number = 0; number < 3; number++) {
                filesToCache.push(`./Cards/${["RED", "GREEN", "BLUE", "YELLOW"][color]}_${["REVERSE", "SKIP", "PLUS2"][number]}.webp`);
            }
        }
        filesToCache.push(`./Cards/WILD_PLUS4WILD.webp`);
        filesToCache.push(`./Cards/WILD_WILD.webp`);
        return cache.addAll(filesToCache);
      })
    );
   });
self.addEventListener('fetch', function(event) {
    if (event.request.mode !== 'navigate') {
        return;
      }
      event.respondWith(
          fetch(event.request)
              .catch(() => {
                return caches.open("Uno")
                    .then((cache) => {
                      return cache.match('/ErrorPages/OFFLINE.html');
                    });
              })
      );
});
self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then((keyList) => {
          return Promise.all(keyList.map((key) => {
            if (key !== "Uno") {
              console.log('[ServiceWorker] Removing old cache', key);
              return caches.delete(key);
            }
          }));
        })
    );
  });