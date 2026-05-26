'use client';

import AuthGuard from '@/components/auth/AuthGuard';
import AppLayout from '@/components/layout/AppLayout';

export default function PeoplePage() {
  return (
    <AuthGuard>
      <AppLayout initialTab={1} />
    </AuthGuard>
  );
}
