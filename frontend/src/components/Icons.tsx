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

export const Clock = (props: IconProps) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
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
