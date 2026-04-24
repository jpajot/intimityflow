export default function DCperCOTIcon({ className, ...props }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      fill="none"
      stroke="currentColor"
      strokeWidth="5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Discount badge (top-left) */}
      <path d="M22 6 L25 2 L28 6 L32 5 L33 9 L37 10 L36 14 L40 17 L37 20 L39 24 L35 25 L34 29 L30 28 L28 32 L25 30 L22 32 L20 28 L16 29 L15 25 L11 24 L13 20 L10 17 L14 14 L13 10 L17 9 L18 5 Z" />
      <circle cx="22" cy="18" r="2.5" />
      <circle cx="30" cy="26" r="2.5" />
      <line x1="19" y1="27" x2="33" y2="13" />

      {/* Top-right box */}
      <rect x="56" y="4" width="36" height="34" rx="4" />
      <path d="M68 4 L72 12 L76 4" />
      <rect x="63" y="26" width="14" height="6" rx="2" />

      {/* Bottom-left box */}
      <rect x="4" y="42" width="42" height="38" rx="4" />
      <path d="M18 42 L25 54 L32 42" />
      <rect x="13" y="68" width="18" height="7" rx="2" />

      {/* Bottom-right box */}
      <rect x="52" y="42" width="42" height="38" rx="4" />
      <path d="M66 42 L73 54 L80 42" />
      <rect x="61" y="68" width="18" height="7" rx="2" />

      {/* Cart / trolley base */}
      <rect x="4" y="83" width="90" height="10" rx="5" />
      <circle cx="22" cy="96" r="4" />
      <circle cx="76" cy="96" r="4" />
    </svg>
  );
}