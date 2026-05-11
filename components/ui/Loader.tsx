interface LoaderProps {
  label?: string;
  fullScreen?: boolean;
  className?: string;
}

export default function Loader({ label = 'Loading...', fullScreen = false, className = '' }: LoaderProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-5 ${fullScreen ? 'fixed inset-0 z-50' : 'py-16'} ${className}`.trim()}
      style={{ background: fullScreen ? 'var(--color-bg)' : 'transparent' }}
      role="status"
      aria-live="polite"
    >
      {/* Concentric spinner rings */}
      <div className="spinner-ring spinner-outer">
        <div className="spinner-ring spinner-mid">
          <div className="spinner-ring spinner-inner" />
        </div>
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
