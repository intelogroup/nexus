"use client";

import { useEffect, useState, ReactNode } from "react";

export function MountedOnly({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div
      aria-hidden={!mounted}
      style={{
        display: "contents",
        visibility: mounted ? "visible" : "hidden",
      }}
    >
      {children}
    </div>
  );
}
