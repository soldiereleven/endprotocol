import React from "react";
import { MorphIcon, type MorphHandle } from "morphicons/react";
import type { IconInput } from "morphicons";

export type { MorphHandle, IconInput };

export type IconSvgProps = React.SVGProps<SVGSVGElement> & {
  size?: number;
};

export function createMorphIcon(lucideData: IconInput) {
  const C = React.forwardRef<MorphHandle, IconSvgProps>(
    ({ size, className, style, ...rest }, ref) => {
      const { from, to, ref: _ref, ...svgRest } = rest as any;
      return (
        <MorphIcon
          ref={ref}
          icon={lucideData}
          size={size}
          className={className}
          style={style}
          {...svgRest}
        />
      );
    },
  );
  C.displayName = "MorphIcon";
  return C;
}
