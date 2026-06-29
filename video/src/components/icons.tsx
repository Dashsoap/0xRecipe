import React from "react";
import { COLORS } from "../theme";

type P = { size?: number; color?: string; sw?: number };
const S: React.FC<P & { children: React.ReactNode }> = ({ size = 64, color = COLORS.white, sw = 1.8, children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

export const IconAgent: React.FC<P> = (p) => (
  <S {...p}>
    <rect x="4" y="8" width="16" height="12" rx="3" />
    <path d="M12 8V4M9 4h6" />
    <circle cx="9" cy="13" r="1.1" fill={p.color ?? COLORS.white} />
    <circle cx="15" cy="13" r="1.1" fill={p.color ?? COLORS.white} />
    <path d="M9 16.5h6" />
  </S>
);

export const IconWallet: React.FC<P> = (p) => (
  <S {...p}>
    <rect x="3" y="6" width="18" height="13" rx="3" />
    <path d="M3 9h18" />
    <circle cx="16.5" cy="13" r="1.3" fill={p.color ?? COLORS.white} />
  </S>
);

export const IconLock: React.FC<P> = (p) => (
  <S {...p}>
    <rect x="5" y="10" width="14" height="10" rx="2.5" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    <circle cx="12" cy="15" r="1.4" fill={p.color ?? COLORS.white} />
  </S>
);

export const IconCard: React.FC<P> = (p) => (
  <S {...p}>
    <rect x="3" y="6" width="18" height="12" rx="2.5" />
    <path d="M3 10h18M6 14h4" />
  </S>
);

export const IconKey: React.FC<P> = (p) => (
  <S {...p}>
    <circle cx="8" cy="8" r="4" />
    <path d="M11 11l8 8M16 16l2-2M19 19l1.5-1.5" />
  </S>
);

export const IconUser: React.FC<P> = (p) => (
  <S {...p}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20a7 7 0 0 1 14 0" />
  </S>
);

/** Wraps any node with a prohibition (no) ring + slash. */
export const Banned: React.FC<{ size?: number; children: React.ReactNode }> = ({ size = 120, children }) => (
  <div style={{ position: "relative", width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <div style={{ opacity: 0.55 }}>{children}</div>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={COLORS.violetBright} strokeWidth={1.6}
      style={{ position: "absolute", inset: 0 }}>
      <circle cx="12" cy="12" r="10.2" />
      <path d="M5 5l14 14" />
    </svg>
  </div>
);

export const IconCheck: React.FC<P> = (p) => (
  <S {...p}><path d="M4 12.5l5 5L20 6.5" /></S>
);

export const IconBolt: React.FC<P> = (p) => (
  <S {...p}><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" /></S>
);

export const IconScale: React.FC<P> = (p) => (
  <S {...p}>
    <path d="M12 3v18M7 21h10M5 7h14l-3 7H8L5 7zM5 7l-2 5h4M19 7l2 5h-4" />
  </S>
);

export const IconDoc: React.FC<P> = (p) => (
  <S {...p}>
    <path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" />
  </S>
);

export const IconLink: React.FC<P> = (p) => (
  <S {...p}>
    <path d="M9.5 14.5l5-5M8 12l-2 2a3.5 3.5 0 0 0 5 5l2-2M16 12l2-2a3.5 3.5 0 0 0-5-5l-2 2" />
  </S>
);

export const IconSignature: React.FC<P> = (p) => (
  <S {...p}>
    <path d="M3 17c3-1 4-9 6-9s1 7 3 7 3-4 5-4 2 3 4 2" /><path d="M3 20h18" />
  </S>
);
