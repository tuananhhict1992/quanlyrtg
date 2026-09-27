import React, { useEffect, useState } from "react";

let logoData = '';
let logoRequest: Promise<string> | undefined;
const loadLogo = () => logoRequest ||= import('../assets/hict').then(module => {
  logoData = module.default;
  const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]') || document.createElement('link');
  icon.rel = 'icon'; icon.type = 'image/png'; icon.href = logoData;
  if (!icon.isConnected) document.head.append(icon);
  return logoData;
});

/** Display the supplied artwork without changing its pixels or proportions. */
export function BrandLogo({ className = "" }: { className?: string }) {
  const [source, setSource] = useState(logoData);
  useEffect(() => {
    let active = true;
    loadLogo().then(value => { if (active) setSource(value); }).catch(() => {});
    return () => { active = false; };
  }, []);
  return (
    <svg
      role="img"
      aria-label="HICT — Saigon Newport"
      viewBox="100 730 3880 1460"
      className={`hict-logo ${className}`}
    >
      {source ? <image href={source} width="4000" height="3000" /> : <text x="100" y="1900" fontSize="1200" fontWeight="bold" fill="#006eae">HICT</text>}
    </svg>
  );
}

export function UserAvatar({
  name,
  src,
  className = "",
}: {
  name: string;
  src?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = (
    parts.length > 1
      ? parts[0][0] + parts[parts.length - 1][0]
      : parts[0]?.slice(0, 2) || "RT"
  ).toLocaleUpperCase("vi");
  return src && !failed ? (
    <img
      src={src}
      alt={name}
      className={`hict-avatar ${className}`}
      onError={() => setFailed(true)}
    />
  ) : (
    <span
      role="img"
      aria-label={name}
      className={`hict-avatar hict-avatar-fallback ${className}`}
    >
      {initials}
    </span>
  );
}
