import io from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3081';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ||
    (typeof window !== 'undefined'
        ? (
            (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                ? `http://${window.location.hostname}:3081`
                : `${window.location.protocol}//${window.location.hostname}`  // producción: usa nginx sin puerto
        )
        : 'http://localhost:3081');

// En el cliente, si no hay URL definida, intentamos usar el host actual (incluyendo puerto 3001 cuando corresponde)
const getSocketUrl = () => {
    if (typeof window !== 'undefined') {
        const protocol = window.location.protocol;
        const host = window.location.hostname;
        const port = window.location.port;

        if (process.env.NEXT_PUBLIC_SOCKET_URL) return process.env.NEXT_PUBLIC_SOCKET_URL;

        // Caso localhost o desarrollo
        if (host === 'localhost' || host === '127.0.0.1' || port === '3000') {
            return `${protocol}//${host}:3081`;
        }
        // Caso IP del VPS
        if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
            return `${protocol}//${host}:3081`;
        }
        // Caso dominio normal (se asume que Nginx proxy está configurado)
        return `${protocol}//${host}`;
    }
    return SOCKET_URL;
};

let socketInstance: any = null;

export const getSocket = () => {
    if (typeof window === 'undefined') return null;

    if (!socketInstance) {
        socketInstance = io(getSocketUrl(), {
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });
    }
    return socketInstance;
};
