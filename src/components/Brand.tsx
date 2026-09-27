import React, { useEffect, useState } from "react";

/** Display the supplied artwork without changing its pixels or proportions. */
export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <svg
      role="img"
      aria-label="HICT — Saigon Newport"
      viewBox="100 730 3880 1460"
      className={`hict-logo ${className}`}
    >
      <image href="/brand/hict-logo.png" width="4000" height="3000" />
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
