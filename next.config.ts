import withPWAInit from "@ducanh2912/next-pwa";
import path from "path";
import fs from "fs";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  // Cambia a false para probar la PWA en local (npm run build && npm start)
  disable: process.env.NODE_ENV === "development",
  fallbacks: {
    document: "/offline",
  },
  customWorkerSrc: "worker",
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      // Imágenes del menú y logos — Cache First (sirve rápido, actualiza en fondo)
      {
        urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "capriccio-images",
          expiration: { maxEntries: 80, maxAgeSeconds: 30 * 24 * 60 * 60 },
        },
      },
      // API de menú y productos — Network First con fallback (datos frescos siempre)
      {
        urlPattern: /\/api\/(pizzas|products|menu|categorias)/i,
        handler: "NetworkFirst",
        options: {
          cacheName: "capriccio-api-menu",
          expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 },
          networkTimeoutSeconds: 5,
        },
      },
      // Google Fonts — Cache First
      {
        urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com/i,
        handler: "CacheFirst",
        options: {
          cacheName: "google-fonts",
          expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 },
        },
      },
    ],
  },
});

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  webpack: (config) => {
    // Fix: webpack en Windows resuelve el mismo módulo con distinto casing
    // (D:\WEB\ vs D:\web\), creando dos instancias de layout-router.js
    // que rompen el contexto de React ("invariant expected layout router").
    // Normalizamos el snapshot root a la ruta real del proyecto.
    // fs.realpathSync devuelve el path con el casing real del filesystem (D:\WEB\ no D:\web\)
    const projectRoot = fs.realpathSync(process.cwd());
    config.snapshot = {
      ...config.snapshot,
      managedPaths: [path.join(projectRoot, 'node_modules')],
    };
    // Deshabilitar symlinks para evitar resolución de rutas con distinto casing
    config.resolve = {
      ...config.resolve,
      symlinks: false,
    };
    return config;
  },
};

export default withPWA(nextConfig);
