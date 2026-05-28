'use client';

import dynamic from 'next/dynamic';
import animationData from '@/public/loading.json';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

interface LoaderProps {
  label?: string;
  fullScreen?: boolean;
  className?: string;
}

export default function Loader({ label = 'Loading...', fullScreen = false, className = '' }: LoaderProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 ${fullScreen ? 'fixed inset-0 z-50' : 'py-16'} ${className}`.trim()}
      style={{ background: fullScreen ? 'var(--color-bg)' : 'transparent' }}
      role="status"
      aria-live="polite"
    >
      <div className="w-64 h-64 flex items-center justify-center">
        <Lottie animationData={animationData} loop={true} />
      </div>

      {label && (
        <p
          className="text-xs font-medium tracking-wide"
          style={{ color: 'var(--color-text-muted)' }}
        >
          {label}
        </p>
      )}
    </div>
  );
}
