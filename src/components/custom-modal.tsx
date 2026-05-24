import { useEffect, useRef, forwardRef } from "react";
import clsx from "clsx";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  height?: "auto" | "fixed";
  disableBackdropClick?: boolean; // 禁用点击背景关闭
  bgClass?: string; // 背景颜色类，默认为 bg-background
}

export const CustomModal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  size = "md",
  height = "fixed",
  disableBackdropClick = false,
  bgClass = "bg-background",
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // 处理ESC键关闭
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  // 点击背景关闭
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (!disableBackdropClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };
  return (
    <>
      {/* Backdrop - 覆盖整个屏幕，让背景模糊 */}
      <div
        className={clsx(
          "fixed top-0 left-0 w-screen h-screen z-[9999] bg-transparent backdrop-blur-md transition-all duration-300",
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none",
        )}
        onClick={handleBackdropClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            handleBackdropClick(e as any);
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Close modal"
      />

      {/* Modal content - 完全不透明，在模糊层之上 */}
      <div
        className={clsx(
          "fixed top-0 left-0 w-screen h-screen z-[10000] flex items-center justify-center p-4 pointer-events-none",
          isOpen ? "opacity-100" : "opacity-0",
        )}
      >
        <div
          ref={modalRef}
          className={clsx(
            "relative w-full rounded-xl shadow-2xl border border-separator pointer-events-auto transform transition-all duration-300 ease-out overflow-hidden",
            "bg-background",
            bgClass,
            sizeClasses[size],
            height === "auto" ? "max-h-[90vh]" : "max-h-[85vh]",
            isOpen
              ? "opacity-100 scale-100 translate-y-0"
              : "opacity-0 scale-95 translate-y-4",
          )}
        >
          {children}
        </div>
      </div>
    </>
  );
};

interface ModalHeaderProps {
  children: React.ReactNode;
  onClose?: () => void;
  rightContent?: React.ReactNode; // 右侧额外内容
}

export const CustomModalHeader: React.FC<ModalHeaderProps> = ({
  children,
  onClose,
  rightContent,
}) => {
  return (
    <div className="relative flex items-center justify-between px-6 py-4 border-b border-separator">
      <div className="text-lg font-semibold text-foreground">{children}</div>
      <div className="flex items-center gap-2">{rightContent}</div>
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded-full bg-default-50 hover:bg-default-100 transition-colors text-muted hover:text-foreground shadow-sm"
          aria-label="Close"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </div>
  );
};

interface ModalBodyProps {
  children: React.ReactNode;
  className?: string;
  onScroll?: React.UIEventHandler<HTMLDivElement>;
}

export const CustomModalBody = forwardRef<HTMLDivElement, ModalBodyProps>(
  ({ children, className = "", onScroll }, ref) => {
    return (
      <div
        ref={ref}
        onScroll={onScroll}
        className={clsx(
          "px-6 py-4 max-h-[70vh] overflow-y-auto relative",
          className,
        )}
      >
        {children}
      </div>
    );
  },
);

CustomModalBody.displayName = "CustomModalBody";

interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const CustomModalFooter: React.FC<ModalFooterProps> = ({
  children,
  className = "",
}) => {
  return (
    <div
      className={clsx(
        "flex items-center justify-end gap-2 px-6 py-4 border-t border-separator",
        className,
      )}
    >
      {children}
    </div>
  );
};
