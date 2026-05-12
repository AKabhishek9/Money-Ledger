'use client';

export default function OfflinePage() {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen px-6 text-center"
      style={{ background: 'var(--color-bg)' }}
    >
      <div className="text-6xl mb-4">📒</div>
      <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--color-text)' }}>
        You're offline
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
        Your data is saved locally. Connect to sync.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="px-6 py-3 rounded-2xl text-sm font-semibold"
        style={{ background: 'var(--color-accent)', color: '#fff' }}
      >
        Try Again
      </button>
    </div>
  );
}
