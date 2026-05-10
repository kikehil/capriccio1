// ─── PUSH NOTIFICATIONS — Capriccio Pizzería ─────────────────────────────────
// Este archivo es el custom worker source para @ducanh2912/next-pwa.
// Se compila y se INYECTA en el service worker generado (sw.js).

// ─── LIMPIAR CACHÉS VIEJOS AL ACTIVAR ────────────────────────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((names) =>
            Promise.all(names.map((name) => caches.delete(name)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('push', (event) => {
    if (!event.data) return;

    let data;
    try { data = event.data.json(); }
    catch { data = { title: 'Capriccio', body: event.data.text() }; }

    const options = {
        body: data.body || '',
        icon: data.icon || '/icons/icon-192x192.png',
        badge: data.badge || '/icons/icon-72x72.png',
        tag: data.tag || 'capriccio-notif',
        renotify: true,
        requireInteraction: false,
        vibrate: [200, 100, 200],
        data: { url: data.url || '/' },
        actions: data.url === '/?open=pedidos'
            ? [{ action: 'ver', title: '📦 Ver pedido' }]
            : [],
    };

    event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (const client of windowClients) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.focus();
                    client.navigate(url);
                    return;
                }
            }
            if (clients.openWindow) return clients.openWindow(url);
        })
    );
});
