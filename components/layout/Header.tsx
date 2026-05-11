'use client';

import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  showBack?: boolean;
  rightAction?: React.ReactNode;
  accent?: string;
}

export default function Header({
  title,
  subtitle,
  onBack,
  showBack,
  rightAction,
  accent,
}: HeaderProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) onBack();
    else router.back();
  };

  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 safe-top"
      style={{
        background: 'var(--color-nav)',
        borderBottom: '1px solid var(--color-border)',
        minHeight: 56,
      }}
    >
      {showBack && (
        <button
          onClick={handleBack}
          className="p-2 -ml-2 rounded-xl"
          style={{ color: 'var(--color-accent)' }}
        >
          <ChevronLeft size={22} />
        </button>
      )}

      <div className="flex-1 min-w-0">
        <h1
          className="font-semibold text-base truncate leading-tight"
          style={{ color: accent || 'var(--color-text)' }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs truncate mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {subtitle}
          </p>
        )}
      </div>

      {rightAction && <div className="flex items-center gap-1 shrink-0">{rightAction}</div>}
    </header>
  );
}
