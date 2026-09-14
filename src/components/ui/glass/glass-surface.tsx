import { useRef } from "react";
import LiquidGlass from "liquid-glass-react";
import { cn } from "@/lib/cn";

export interface GlassSurfaceProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Glass intensity: "light" (blur 12px) | "medium" (blur 16px) | "strong" (blur 24px) */
  intensity?: "light" | "medium" | "strong";
  /** Enable interactive displacement effect (default: true) */
  interactive?: boolean;
  /** Additional LiquidGlass props */
  displacementScale?: number;
  blurAmount?: number;
  saturation?: number;
  aberrationIntensity?: number;
  elasticity?: number;
  cornerRadius?: number;
  padding?: string;
  onClick?: () => void;
}

const intensityConfig = {
  light: {
    displacementScale: 40,
    blurAmount: 0.04,
    saturation: 130,
    aberrationIntensity: 1,
    elasticity: 0.1,
  },
  medium: {
    displacementScale: 60,
    blurAmount: 0.0625,
    saturation: 140,
    aberrationIntensity: 2,
    elasticity: 0.15,
  },
  strong: {
    displacementScale: 80,
    blurAmount: 0.1,
    saturation: 150,
    aberrationIntensity: 3,
    elasticity: 0.2,
  },
};

export function GlassSurface({
  children,
  className,
  style,
  intensity = "medium",
  interactive = true,
  displacementScale,
  blurAmount,
  saturation,
  aberrationIntensity,
  elasticity,
  cornerRadius = 16,
  padding,
  onClick,
}: GlassSurfaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const config = intensityConfig[intensity];

  return (
    <div ref={containerRef} className={cn("relative", className)} style={style}>
      <LiquidGlass
        displacementScale={displacementScale ?? config.displacementScale}
        blurAmount={blurAmount ?? config.blurAmount}
        saturation={saturation ?? config.saturation}
        aberrationIntensity={aberrationIntensity ?? config.aberrationIntensity}
        elasticity={elasticity ?? config.elasticity}
        cornerRadius={cornerRadius}
        padding={padding}
        mouseContainer={interactive ? containerRef : undefined}
        onClick={onClick}
      >
        {children}
      </LiquidGlass>
    </div>
  );
}
