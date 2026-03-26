"use client";

import { useEffect, useState, ReactNode } from "react";

export function MountedOnly({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div style={{ visibility: mounted ? 'visible' : 'hidden' }}>
      {children}
    </div>
  );
}
