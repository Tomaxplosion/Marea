import React, { useId } from 'react';

export default function KoiPattern() {
  const id = useId();
  const body = 'M0-114C-26-115-44-91-42-60C-41-23-14 15-7 48C-3 66-10 86-18 101C-7 94 2 86 8 72C24 41 31 16 29-13C27-47 18-76 20-94C18-105 10-113 0-114Z';
  return (
    <svg className="koi-pattern" viewBox="0 0 520 620" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={`${id}-body`}><path d={body} /></clipPath>
        <pattern id={`${id}-scales`} width="16" height="14" patternUnits="userSpaceOnUse">
          <path d="M-8 0Q0 14 8 0M8 0Q16 14 24 0M0 7Q8 21 16 7" fill="none" stroke="currentColor" strokeWidth=".65" opacity=".6" />
        </pattern>
        <g id={`${id}-fish`} stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round">
          <path className="koi-fin" d="M-35-57C-61-60-78-37-72-17C-60-27-43-22-26-28M25-40C51-44 71-23 65-4C51-14 39-5 26-9" />
          <path d="M-40-50Q-58-42-67-23M-35-40Q-54-35-63-25M32-32Q51-27 60-11M32-20Q46-21 56-13" fill="none" opacity=".65" />
          <path className="koi-fin" d="M-6 67C4 82 33 91 41 118C24 118 8 103 0 94C-13 111-31 119-46 116C-40 97-27 86-18 80Z" />
          <path d="M0 90Q18 103 33 113M-6 91Q-24 106-37 112" fill="none" />
          <path className="koi-body" d={body} />
          <g clipPath={`url(#${id}-body)`} stroke="none">
            <path className="koi-patch" d="M-48-106Q-21-115-9-95T17-77Q-10-56-39-71Z" />
            <path className="koi-patch" d="M-38-26Q-5-43 13-24T40-6L34 27Q4 37-8 11T-38-5Z" />
            <path className="koi-patch" d="M-3 53Q22 35 30 54L8 83Q-7 83-3 53Z" />
            <path d={body} fill={`url(#${id}-scales)`} />
          </g>
          <path d="M-27-74Q-8-63 14-78M-10-59C-17-27 13 2 3 49M-10-50Q3-43 7-24M7-24Q0-16 3-5" fill="none" opacity=".75" />
          <ellipse cx="-27" cy="-94" rx="2.2" ry="3" fill="currentColor" stroke="none" />
          <ellipse cx="9" cy="-101" rx="2.2" ry="3" fill="currentColor" stroke="none" />
          <path d="M-11-111Q-8-117-3-113M-35-91Q-49-101-54-96M15-98Q29-112 34-105" fill="none" />
        </g>
      </defs>
      <g transform="translate(155 250) rotate(-30) scale(1.45)"><use href={`#${id}-fish`} /></g>
      <g transform="translate(365 410) rotate(150) scale(1.5)"><use href={`#${id}-fish`} /></g>
    </svg>
  );
}
