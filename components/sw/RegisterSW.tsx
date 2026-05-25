'use client';

import { useEffect } from 'react';

export default function RegisterSW() {
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      process.env.NODE_ENV === 'production'
    ) {
      const handleRegister = () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('Service Worker registered with scope:', registration.scope);
            // Proactively check for updates
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

      // Reload page when the new service worker takes control, but only if there was an active controller before (representing an update)
      let refreshing = false;
      const hasController = !!navigator.serviceWorker.controller;
      const handleControllerChange = () => {
        if (hasController && !refreshing) {
          refreshing = true;
          window.location.reload();
        }
      };

      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

      return () => {
        window.removeEventListener('load', handleRegister);
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      };
    }
  }, []);

  return null;
}
