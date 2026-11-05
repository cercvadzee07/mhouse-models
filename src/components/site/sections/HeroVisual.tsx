"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

// The WebGL scene is client-only and code-split from the rest of the page.
const HeroCanvas = dynamic(() => import("@/components/three/HeroCanvas"), { ssr: false });

export function HeroVisual(props: ComponentProps<typeof HeroCanvas>) {
  return <HeroCanvas {...props} />;
}
