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
            // Proactively check for updates in the background
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
    }
  }, []);

  return null;
}
