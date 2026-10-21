const base = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export const PlusIcon = () => (
  <svg {...base}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const TrashIcon = () => (
  <svg {...base}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
  </svg>
);
export const DotsIcon = () => (
  <svg {...base}>
    <path d="M5 12h.01M12 12h.01M19 12h.01" strokeWidth={3} />
  </svg>
);
export const CheckIcon = () => (
  <svg {...base} strokeWidth={2.6}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);
export const ChevronRight = () => (
  <svg {...base} width={18} height={18}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);
export const ChevronLeft = () => (
  <svg {...base} width={18} height={18}>
    <path d="m15 6-6 6 6 6" />
  </svg>
);
export const ArrowUp = () => (
  <svg {...base} width={18} height={18}>
    <path d="m6 14 6-6 6 6" />
  </svg>
);
export const ArrowDown = () => (
  <svg {...base} width={18} height={18}>
    <path d="m6 10 6 6 6-6" />
  </svg>
);
export const PlayIcon = () => (
  <svg {...base} fill="currentColor" stroke="none">
    <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
  </svg>
);
export const NoteIcon = () => (
  <svg {...base} width={16} height={16}>
    <path d="M4 5h16M4 10h16M4 15h10" />
  </svg>
);
