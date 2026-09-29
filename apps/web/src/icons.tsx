import type { ReactNode } from 'react';

// Hand-drawn 24px stroke icons; they take the text colour, so one set serves
// both themes.

interface IconProps {
  size?: number;
  strokeWidth?: number;
}

function IconFrame({
  size = 24,
  strokeWidth = 1.8,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export function ArchiveIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M4.5 8h15v10.5a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5z" />
      <path d="M3.5 4.5h17V8h-17z" />
      <path d="M10 12h4" />
    </IconFrame>
  );
}

export function CameraIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M4 8.5h3l1.8-2.5h6.4L17 8.5h3a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13.5" r="3.2" />
    </IconFrame>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M4 7.5h9.5M18.5 7.5H20M4 16.5h1.5M10.5 16.5H20" />
      <circle cx="16" cy="7.5" r="2.5" />
      <circle cx="8" cy="16.5" r="2.5" />
    </IconFrame>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </IconFrame>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M12 15.5V4.5M7.5 9 12 4.5 16.5 9M5 19.5h14" />
    </IconFrame>
  );
}

export function BackIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />
    </IconFrame>
  );
}

export function ClearIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="m7 7 10 10M17 7 7 17" />
    </IconFrame>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="m4.5 7.5 7.5 5.5 7.5-5.5" />
    </IconFrame>
  );
}

export function ShareIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="17.5" cy="5.5" r="2.5" />
      <circle cx="6.5" cy="12" r="2.5" />
      <circle cx="17.5" cy="18.5" r="2.5" />
      <path d="m8.7 10.7 6.6-3.9M8.7 13.3l6.6 3.9" />
    </IconFrame>
  );
}
