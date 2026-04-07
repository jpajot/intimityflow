export default function BoardIcon({ className, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Outer frame */}
      <rect x="1.5" y="1.5" width="21" height="21" rx="2.5" />
      {/* Top ribbon */}
      <line x1="1.5" y1="6" x2="22.5" y2="6" />
      {/* Ribbon tabs */}
      <rect x="3" y="3" width="3" height="1.5" rx="0.4" />
      <rect x="7" y="3" width="3" height="1.5" rx="0.4" />
      <rect x="11" y="3" width="2" height="1.5" rx="0.4" />
      {/* Row 1 - left card */}
      <rect x="3" y="8.5" width="4" height="3.5" rx="0.5" />
      <line x1="8.5" y1="9.5" x2="11" y2="9.5" />
      <line x1="8.5" y1="11" x2="11" y2="11" />
      <line x1="8.5" y1="12.5" x2="10" y2="12.5" />
      {/* Row 1 - right card */}
      <rect x="13" y="8.5" width="4" height="3.5" rx="0.5" />
      <line x1="18.5" y1="9.5" x2="21" y2="9.5" />
      <line x1="18.5" y1="11" x2="21" y2="11" />
      <line x1="18.5" y1="12.5" x2="20" y2="12.5" />
      {/* Row 2 - left card */}
      <rect x="3" y="14.5" width="4" height="3.5" rx="0.5" />
      <line x1="8.5" y1="15.5" x2="11" y2="15.5" />
      <line x1="8.5" y1="17" x2="11" y2="17" />
      <line x1="8.5" y1="18.5" x2="10" y2="18.5" />
      {/* Row 2 - right card */}
      <rect x="13" y="14.5" width="4" height="3.5" rx="0.5" />
      <line x1="18.5" y1="15.5" x2="21" y2="15.5" />
      <line x1="18.5" y1="17" x2="21" y2="17" />
      <line x1="18.5" y1="18.5" x2="20" y2="18.5" />
    </svg>
  );
}