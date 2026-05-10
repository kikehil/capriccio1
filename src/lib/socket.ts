import io from 'socket.io-client';

// NEXT_PUBLIC_* se baka en el bundle en tiempo de build.
// .env.production  → https://capricciopizzeria.com  (usado cuando se corre `next build`)
// .env.development.local → http://localhost:3081    (usado cuando se corre `next dev`)
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3081';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3081';

let socketInstance: any = null;

export const getSocket = () => {
    if (typeof window === 'undefined') return null;

    if (!socketInstance) {
        socketInstance = io(SOCKET_URL, {
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });
    }
    return socketInstance;
};
