import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BiVi — Una compañía cuando no hay nadie cerca',
    short_name: 'BiVi',
    description: 'Compañía conversacional por voz para adultos mayores',
    start_url: '/talk',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    theme_color: '#1B75BC',
    background_color: '#F4F8FB',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-maskable.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    screenshots: [
      {
        src: '/screenshot-1.png',
        sizes: '540x720',
        type: 'image/png',
        form_factor: 'narrow',
      },
    ],
  };
}
