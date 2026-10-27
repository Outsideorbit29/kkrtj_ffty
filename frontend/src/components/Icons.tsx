import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const base: IconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
};

export const ChevronLeft = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="m15 18-6-6 6-6" />
  </svg>
);

export const ChevronRight = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="m9 18 6-6-6-6" />
  </svg>
);

export const Download = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" />
  </svg>
);

export const WindMark = (props: IconProps) => (
  <svg viewBox="0 0 34 34" aria-hidden focusable={false} {...props}>
    <rect width="34" height="34" rx="8" fill="var(--accent)" />
    <g fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
      <path d="M7 13h13a3.5 3.5 0 1 0-3.5-3.5" />
      <path d="M7 18h18a3.5 3.5 0 1 1-3.5 3.5" />
      <path d="M7 23h8" />
    </g>
  </svg>
);

export const IconOverview = (props: IconProps) => (
  <svg {...base} {...props}>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </svg>
);

export const IconDecision = (props: IconProps) => (
  <svg {...base} {...props}>
    <rect x="3" y="4" width="18" height="17" rx="2" />
    <path d="M3 9h18M8 2v4M16 2v4M8 14h3M8 17h6" />
  </svg>
);

export const IconAccuracy = (props: IconProps) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1" />
  </svg>
);

export const IconTable = (props: IconProps) => (
  <svg {...base} {...props}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 10h18M3 15h18M9 10v10" />
  </svg>
);

export const IconSun = (props: IconProps) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

export const IconMoon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
  </svg>
);

export const IconArrowRight = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M5 12h14m-6-6 6 6-6 6" />
  </svg>
);

export const IconSort = ({ dir, ...props }: IconProps & { dir: 'asc' | 'desc' | 'none' }) => (
  <svg {...base} strokeWidth={2.4} {...props}>
    <path d="m8 10 4-4 4 4" opacity={dir === 'desc' ? 0.25 : 1} />
    <path d="m8 14 4 4 4-4" opacity={dir === 'asc' ? 0.25 : 1} />
  </svg>
);
