export default function StylesIcon({ className, ...props }) {
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
      {/* Open box bottom */}
      <path d="M3 12.5l1.5 7.5h15l1.5-7.5" />
      {/* Box bottom base line */}
      <line x1="3" y1="12.5" x2="21" y2="12.5" />
      {/* Left flap */}
      <path d="M3 12.5L5.5 8H12l-1.5 4.5" />
      {/* Right flap */}
      <path d="M21 12.5L18.5 8H12l1.5 4.5" />
      {/* Center fold line on box */}
      <line x1="12" y1="12.5" x2="12" y2="20" />

      {/* Round object (ball/sphere) inside box - left */}
      <path d="M8 12.5a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" />
      <path d="M6.5 8.5 Q7.5 7.5 9 8" strokeWidth="1.2" />

      {/* Card/tablet inside box - right, tilted slightly */}
      <rect x="13" y="5" width="5" height="7" rx="1" transform="rotate(8 15.5 8.5)" />
      <line x1="15.5" y1="6.5" x2="15.5" y2="9" transform="rotate(8 15.5 8.5)" />
    </svg>
  );
}