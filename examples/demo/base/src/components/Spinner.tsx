type SpinnerProps = { size?: number; label?: string };

export function Spinner({ size = 24, label = 'Loading' }: SpinnerProps) {
  return (
    <div role="status" aria-live="polite" className="spinner-wrap">
      <svg width={size} height={size} viewBox="0 0 24 24" className="spinner">
        <circle cx="12" cy="12" r="10" strokeWidth="4" fill="none" />
      </svg>
      <span className="sr-only">{label}</span>
    </div>
  );
}
