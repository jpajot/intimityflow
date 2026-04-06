export default function ProjectsIcon({ className, ...props }) {
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
      {/* Rays */}
      <line x1="12" y1="1" x2="12" y2="2.5" />
      <line x1="5.5" y1="3" x2="6.5" y2="4" />
      <line x1="18.5" y1="3" x2="17.5" y2="4" />
      <line x1="2.5" y1="8.5" x2="3.8" y2="9" />
      <line x1="21.5" y1="8.5" x2="20.2" y2="9" />
      <line x1="4" y1="14.5" x2="5.2" y2="13.8" />
      <line x1="20" y1="14.5" x2="18.8" y2="13.8" />

      {/* Bulb shape */}
      <path d="M9 17.5V17c0-.4-.2-.7-.5-1A5 5 0 1 1 15.5 16c-.3.3-.5.6-.5 1v.5" />

      {/* Base bands */}
      <rect x="9" y="17.5" width="6" height="1.2" rx="0.6" />
      <rect x="9.5" y="18.7" width="5" height="1" rx="0.5" />

      {/* Pencil body */}
      <rect x="10.8" y="9" width="2.4" height="7" rx="0.3" />
      {/* Pencil tip */}
      <polygon points="12,6.5 10.8,9 13.2,9" />
      {/* Pencil center line */}
      <line x1="12" y1="9" x2="12" y2="16" />
    </svg>
  );
}