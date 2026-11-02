interface LoaderProps {
  diameter?: number;
  text?: string;
}

export const Loader = ({ diameter = 24, text = 'Loading' }: LoaderProps) => (
  <div className="spinner-wrap" role="status" aria-live="polite">
    <svg className="spinner" width={diameter} height={diameter} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="none" strokeWidth="4" />
    </svg>
    <span className="sr-only">{text}</span>
  </div>
);
