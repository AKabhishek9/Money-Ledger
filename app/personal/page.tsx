'use client';

import AuthGuard from '@/components/auth/AuthGuard';
import AppLayout from '@/components/layout/AppLayout';

export default function PersonalPage() {
  return (
    <AuthGuard>
      <AppLayout initialTab={0} />
    </AuthGuard>
  );
}
