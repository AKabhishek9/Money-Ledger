'use client';

import { useRef, useEffect } from 'react';
import PersonalContent from '@/components/tabs/PersonalContent';
import PeopleContent from '@/components/tabs/PeopleContent';
import VaultContent from '@/components/tabs/VaultContent';
import SearchContent from '@/components/tabs/SearchContent';

interface TabContainerProps {
  activeTab: number;
}

const TAB_COUNT = 4;

/**
 * Horizontal tab strip that renders all 4 main content panels side by side.
 * Slides between them using CSS transform for buttery smooth transitions.
 * All panels stay mounted so state and scroll position are preserved.
 */
export default function TabContainer({ activeTab }: TabContainerProps) {
  const stripRef = useRef<HTMLDivElement>(null);

  // On first render, disable the transition so the initial tab appears instantly
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    // Force the initial position without animation
    el.style.transition = 'none';
    el.style.transform = `translateX(-${activeTab * 100}%)`;
    // Re-enable transition after a frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = '';
      });
    });
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="tab-strip">
      <div
        ref={stripRef}
        className="tab-strip-inner"
        style={{ transform: `translateX(-${activeTab * 100}%)` }}
      >
        {/* Panel 0: Personal */}
        <div className="tab-panel">
          <PersonalContent />
        </div>

        {/* Panel 1: People */}
        <div className="tab-panel">
          <PeopleContent />
        </div>

        {/* Panel 2: Vault */}
        <div className="tab-panel">
          <VaultContent />
        </div>

        {/* Panel 3: Search */}
        <div className="tab-panel">
          <SearchContent />
        </div>
      </div>
    </div>
  );
}
