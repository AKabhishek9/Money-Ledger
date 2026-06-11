'use client';

import { useEffect } from 'react';

export default function RegisterSW() {
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator
    ) {
      if (process.env.NODE_ENV === 'production') {
        const handleRegister = () => {
          navigator.serviceWorker
            .register('/sw.js')
            .then((registration) => {
              console.log('Service Worker registered with scope:', registration.scope);
              registration.update();
            })
            .catch((error) => {
              console.error('Service Worker registration failed:', error);
            });
        };

        if (document.readyState === 'complete') {
          handleRegister();
        } else {
          window.addEventListener('load', handleRegister);
        }

        return () => {
          window.removeEventListener('load', handleRegister);
        };
      } else {
        // In development, actively unregister any existing service workers
        // to prevent caching collisions when opening the PWA from the home screen icon
        navigator.serviceWorker.getRegistrations().then(function (registrations) {
          for (const registration of registrations) {
            registration.unregister();
            console.log('Service Worker unregistered in dev mode');
          }
        });
      }
    }
  }, []);

  return null;
}
