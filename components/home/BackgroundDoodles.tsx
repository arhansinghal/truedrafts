function GradCapDoodle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 80"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polygon points="50,8 95,30 50,52 5,30" />
      <polyline points="95,30 95,56" />
      <circle cx="95" cy="61" r="4" />
      <path d="M22,42 L22,65 Q50,78 78,65 L78,42" />
    </svg>
  );
}

function BookDoodle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 70"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M50,12 C42,7 24,6 8,11 L8,65 C24,60 42,61 50,67" />
      <path d="M50,12 C58,7 76,6 92,11 L92,65 C76,60 58,61 50,67" />
      <line x1="50" y1="12" x2="50" y2="67" />
      <line x1="20" y1="22" x2="44" y2="19" />
      <line x1="20" y1="32" x2="44" y2="29" />
      <line x1="20" y1="42" x2="44" y2="39" />
      <line x1="56" y1="19" x2="80" y2="22" />
      <line x1="56" y1="29" x2="80" y2="32" />
      <line x1="56" y1="39" x2="80" y2="42" />
    </svg>
  );
}

function PencilDoodle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 34 110"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="7" y="10" width="20" height="68" rx="2" />
      <path d="M7,78 L17,100 L27,78" />
      <line x1="7" y1="20" x2="27" y2="20" />
      <line x1="7" y1="78" x2="27" y2="78" />
      <rect x="7" y="10" width="20" height="10" rx="2" />
    </svg>
  );
}

function DocumentDoodle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 70 88"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M8,6 L48,6 L62,20 L62,82 L8,82 Z" />
      <path d="M48,6 L48,20 L62,20" />
      <line x1="18" y1="34" x2="52" y2="34" />
      <line x1="18" y1="44" x2="52" y2="44" />
      <line x1="18" y1="54" x2="52" y2="54" />
      <line x1="18" y1="64" x2="40" y2="64" />
    </svg>
  );
}

function BuildingDoodle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 82"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="5" y="38" width="90" height="42" />
      <polygon points="50,8 5,38 95,38" />
      <rect x="40" y="57" width="20" height="23" />
      <rect x="12" y="46" width="15" height="14" />
      <rect x="73" y="46" width="15" height="14" />
      <line x1="50" y1="8" x2="50" y2="2" />
      <circle cx="50" cy="0" r="3" />
    </svg>
  );
}

function StarDoodle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 50 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polygon points="25,3 30,18 46,18 33,28 38,44 25,34 12,44 17,28 4,18 20,18" />
    </svg>
  );
}

function QuillDoodle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 60 105"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M55,5 C55,5 20,30 28,90" />
      <path d="M55,5 C65,28 52,55 28,90" />
      <path d="M55,5 C38,22 32,58 28,90" />
      <path d="M24,83 Q28,92 32,83" />
      <line x1="28" y1="92" x2="28" y2="102" />
    </svg>
  );
}

function DiplomaScroll({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 90 62"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12,8 C12,4 18,4 18,8 L18,54 C18,58 12,58 12,54 Z" />
      <path d="M78,8 C78,4 72,4 72,8 L72,54 C72,58 78,58 78,54 Z" />
      <rect x="18" y="4" width="54" height="54" />
      <line x1="28" y1="22" x2="62" y2="22" />
      <line x1="28" y1="30" x2="62" y2="30" />
      <circle cx="45" cy="44" r="7" />
    </svg>
  );
}

/**
 * Renders all doodles scattered across a full-bleed container,
 * matching the same positioning and opacity as the auth layout.
 * Place inside a `relative overflow-hidden` parent.
 */
export function BackgroundDoodles() {
  return (
    <div
      className="pointer-events-none select-none absolute inset-0"
      aria-hidden="true"
    >
      <GradCapDoodle className="absolute top-10 left-8 w-32 text-blue-500 opacity-[0.07] -rotate-12" />
      <BookDoodle className="absolute top-12 right-16 w-40 text-blue-500 opacity-[0.06] rotate-6" />
      <PencilDoodle className="absolute top-[30%] left-5 w-12 text-blue-500 opacity-[0.07] rotate-[15deg]" />
      <QuillDoodle className="absolute top-[40%] right-6 w-16 text-blue-500 opacity-[0.06] -rotate-[18deg]" />
      <DocumentDoodle className="absolute bottom-24 left-14 w-24 text-blue-500 opacity-[0.06] -rotate-[8deg]" />
      <BuildingDoodle className="absolute bottom-10 right-12 w-44 text-blue-500 opacity-[0.06] rotate-[3deg]" />
      <DiplomaScroll className="absolute top-[55%] left-[22%] w-20 text-blue-500 opacity-[0.06] rotate-[20deg]" />
      <StarDoodle className="absolute top-7 left-[42%] w-9 text-blue-500 opacity-[0.08]" />
      <StarDoodle className="absolute bottom-[32%] right-[28%] w-6 text-blue-500 opacity-[0.07] rotate-12" />
      <StarDoodle className="absolute top-[22%] right-[38%] w-11 text-blue-500 opacity-[0.07] -rotate-6" />
      <BookDoodle className="absolute bottom-16 left-[38%] w-28 text-blue-500 opacity-[0.05] -rotate-[5deg]" />
      <GradCapDoodle className="absolute top-[60%] right-[18%] w-24 text-blue-500 opacity-[0.06] rotate-[8deg]" />
    </div>
  );
}
