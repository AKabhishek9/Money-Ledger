'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, Users, Shield, Search, MoreHorizontal } from 'lucide-react';

interface NavItem {
  icon: React.ReactNode;
  label: string;
  href: string;
  match: string[];
}

const NAV_ITEMS: NavItem[] = [
  {
    icon: <BookOpen size={22} />,
    label: 'Personal',
    href: '/personal',
    match: ['/personal'],
  },
  {
    icon: <Users size={22} />,
    label: 'People',
    href: '/people',
    match: ['/people'],
  },
  {
    icon: <Shield size={22} />,
    label: 'Vault',
    href: '/vault',
    match: ['/vault'],
  },
  {
    icon: <Search size={22} />,
    label: 'Search',
    href: '/search',
    match: ['/search'],
  },
  {
    icon: <MoreHorizontal size={22} />,
    label: 'More',
    href: '/settings',
    match: ['/settings', '/archive', '/tab'],
  },
];

interface BottomNavProps {
  onMoreClick?: () => void;
}

export default function BottomNav({ onMoreClick }: BottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    NAV_ITEMS.filter((item) => item.label !== 'More').forEach((item) => router.prefetch(item.href));
  }, [router]);

  // Listen for keyboard-toggle custom event from EntryInput
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setKeyboardOpen(detail?.open ?? false);
    };
    window.addEventListener('keyboard-toggle', handler);
    return () => window.removeEventListener('keyboard-toggle', handler);
  }, []);

  const isActive = (item: NavItem) =>
    item.match.some((m) => pathname === m || pathname.startsWith(m + '?'));

  const handleClick = (item: NavItem) => {
    if (item.label === 'More' && onMoreClick) {
      onMoreClick();
    } else {
      router.push(item.href);
    }
  };

  // Hide the nav completely when the mobile keyboard is open
  if (keyboardOpen) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex justify-center"
      style={{
        paddingBottom: 'max(env(safe-area-inset-bottom), 12px)',
        paddingLeft: 12,
        paddingRight: 12,
      }}
    >
      <div
        className="glass-heavy flex w-full max-w-md items-end justify-around rounded-2xl"
        style={{
          paddingBottom: 8,
          paddingTop: 6,
        }}
      >
        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          const content = (
            <>
              <div
                className="flex h-8 items-center justify-center transition-transform duration-200 ease-out"
                style={{ transform: active ? 'translateY(-1px)' : 'translateY(0)' }}
              >
                {item.icon}
              </div>
              <span className="text-[0.625rem] font-semibold uppercase tracking-wide">{item.label}</span>
              {active && (
                <span
                  className="absolute left-1/2 top-1 h-0.5 w-7 -translate-x-1/2 rounded-full"
                  style={{ background: 'var(--color-accent)', opacity: 0.95 }}
                  aria-hidden
                />
              )}
            </>
          );

          const className = "relative flex min-h-[50px] min-w-[52px] flex-col items-center justify-end gap-0.5 rounded-xl px-3 pb-1 pt-1 transition-[color,transform] duration-200";
          const style = { color: active ? 'var(--color-accent)' : 'var(--color-text-muted)' };

          if (item.label === 'More') {
            return (
              <button
                type="button"
                key={item.label}
                onClick={() => handleClick(item)}
                className={className}
                style={style}
              >
                {content}
              </button>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href}
              className={className}
              style={style}
              prefetch={true}
            >
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
