'use client';

import AuthGuard from '@/components/auth/AuthGuard';
import AppLayout from '@/components/layout/AppLayout';

export default function VaultPage() {
  return (
    <AuthGuard>
      <AppLayout initialTab={2} />
    </AuthGuard>
  );
}
