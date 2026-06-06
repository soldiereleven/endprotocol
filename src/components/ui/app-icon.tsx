import clsx from "clsx";

type IconProps = React.SVGProps<SVGSVGElement> & {
  size?: number;
};

const base = (size?: number) => ({
  width: size ?? 16,
  height: size ?? 16,
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor",
  xmlns: "http://www.w3.org/2000/svg",
});

export function RefreshIcon({ size, className, ...rest }: IconProps) {
  return (
    <svg {...base(size)} className={className} {...rest}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

export function ChevronLeftIcon({ size, className, ...rest }: IconProps) {
  return (
    <svg {...base(size)} className={className} {...rest}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 19l-7-7 7-7"
      />
    </svg>
  );
}

export function ChevronRightIcon({ size, className, ...rest }: IconProps) {
  return (
    <svg {...base(size)} className={className} {...rest}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
}

export function ChevronDownIcon({ size, className, ...rest }: IconProps) {
  return (
    <svg {...base(size)} className={className} {...rest}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );
}

export function CloseIcon({ size, className, ...rest }: IconProps) {
  return (
    <svg {...base(size)} className={className} {...rest}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

export function PlusIcon({ size, className, ...rest }: IconProps) {
  return (
    <svg {...base(size)} className={className} {...rest}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4v16m8-8H4"
      />
    </svg>
  );
}

export function EditIcon({ size, className, ...rest }: IconProps) {
  return (
    <svg {...base(size)} className={className} {...rest}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      />
    </svg>
  );
}

export function CheckIcon({ size, className, ...rest }: IconProps) {
  return (
    <svg {...base(size)} className={className} {...rest}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

export function SwitchIcon({ size, className, ...rest }: IconProps) {
  return (
    <svg {...base(size)} className={className} {...rest}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
      />
    </svg>
  );
}

export function MinimizeIcon({ size, className, ...rest }: IconProps) {
  return (
    <svg {...base(size)} className={className} {...rest}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M20 12H4"
      />
    </svg>
  );
}

export function MaximizeIcon({ size, className, ...rest }: IconProps) {
  return (
    <svg {...base(size)} className={className} {...rest}>
      <rect x="5" y="5" width="14" height="14" rx="2" strokeWidth={2} />
    </svg>
  );
}

export function RestoreIcon({ size, className, ...rest }: IconProps) {
  return (
    <svg {...base(size)} className={className} {...rest}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"
      />
    </svg>
  );
}

export function MenuIcon({ size, className, ...rest }: IconProps) {
  return (
    <svg {...base(size)} className={className} {...rest}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6h16M4 12h16M4 18h16"
      />
    </svg>
  );
}

export function StatusDot({
  tone = "default",
  pulse = false,
  size = "md",
  className,
}: {
  tone?: "success" | "warning" | "danger" | "default";
  pulse?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClass = {
    sm: "w-2 h-2",
    md: "w-3 h-3",
    lg: "w-4 h-4",
  }[size];

  const toneClass = {
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
    default: "bg-default-400",
  }[tone];

  return (
    <span className={clsx("relative flex-shrink-0 inline-block", className)}>
      <span className={clsx("rounded-full", sizeClass, toneClass)} />
      {pulse && (
        <span
          className={clsx(
            "absolute inset-0 rounded-full opacity-25 animate-ping",
            toneClass,
          )}
        />
      )}
    </span>
  );
}
