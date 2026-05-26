'use client';

import AuthGuard from '@/components/auth/AuthGuard';
import AppLayout from '@/components/layout/AppLayout';

export default function SearchPage() {
  return (
    <AuthGuard>
      <AppLayout initialTab={3} />
    </AuthGuard>
  );
}
