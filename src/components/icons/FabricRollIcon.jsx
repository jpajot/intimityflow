export default function FabricRollIcon({ className, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Roll cylinder */}
      <path d="M7 4a3 3 0 0 0-3 3v10a3 3 0 0 0 6 0V7a3 3 0 0 0-3-3z" />
      {/* Center dot */}
      <circle cx="7" cy="17" r="1" fill="currentColor" stroke="none" />
      {/* Unrolled fabric sheet */}
      <path d="M10 7h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H10" />
    </svg>
  );
}