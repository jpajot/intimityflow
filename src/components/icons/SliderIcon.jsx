export default function SliderIcon({ className, ...props }) {
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
      {/* Top slider */}
      <line x1="4" y1="6" x2="14" y2="6" />
      <circle cx="17" cy="6" r="2.5" />
      <line x1="20" y1="6" x2="20" y2="6" />
      
      {/* Middle slider */}
      <line x1="10" y1="12" x2="20" y2="12" />
      <circle cx="6.5" cy="12" r="2.5" />
      <line x1="4" y1="12" x2="4" y2="12" />
      
      {/* Bottom slider */}
      <line x1="4" y1="18" x2="14" y2="18" />
      <circle cx="17" cy="18" r="2.5" />
      <line x1="20" y1="18" x2="20" y2="18" />
    </svg>
  );
}