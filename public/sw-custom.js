// Service Worker personalizado de Capriccio Pizzería
// Este archivo extiende el SW generado por next-pwa (Workbox)

// ─── FORZAR ACTUALIZACIÓN AL ACTIVAR ─────────────────────────────────────────
// Limpia todos los cachés viejos cuando se activa un nuevo SW
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) =>
            Promise.all(cacheNames.map((name) => caches.delete(name)))
        ).then(() => self.clients.claim())
    );
});

// ─── PUSH NOTIFICATIONS ──────────────────────────────────────────────────────
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

// ─── CLICK EN NOTIFICACIÓN ────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // Si ya hay una ventana abierta, la enfoca y navega
            for (const client of windowClients) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.focus();
                    client.navigate(url);
                    return;
                }
            }
            // Si no hay ventana, abre una nueva
            if (clients.openWindow) return clients.openWindow(url);
        })
    );
});
