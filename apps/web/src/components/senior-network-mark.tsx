/**
 * Tight Senior hub mark — canonical Ask geometry, plum brackets, Senior node palette.
 */
export function SeniorNetworkMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 36 36"
      width="36"
      height="36"
      fill="none"
      aria-hidden
      focusable="false"
    >
      <path
        d="M9 5H5v26h4"
        stroke="#681860"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M27 5h4v26h-4"
        stroke="#681860"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="18" y1="11.2" x2="18" y2="18" stroke="#082860" strokeWidth="1.2" />
      <line x1="12.2" y1="18" x2="18" y2="18" stroke="#082860" strokeWidth="1.2" />
      <line x1="23.8" y1="18" x2="18" y2="18" stroke="#082860" strokeWidth="1.2" />
      <line x1="18" y1="24.8" x2="18" y2="18" stroke="#082860" strokeWidth="1.2" />
      <circle cx="18" cy="18" r="2.1" fill="#082860" />
      <circle cx="18" cy="10.2" r="2.5" fill="#F86008" />
      <circle cx="11.2" cy="18" r="2.5" fill="#18B8E0" />
      <circle cx="24.8" cy="18" r="2.5" fill="#88C828" />
      <circle cx="18" cy="25.8" r="2.5" fill="#8B5CF6" />
    </svg>
  );
}
