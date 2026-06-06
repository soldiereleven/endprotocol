import { forwardRef } from "react";
import { Modal } from "@heroui/react";
import { CloseIcon } from "@/components/ui/app-icon";

type ModalSize = "xs" | "sm" | "md" | "lg" | "full" | "cover";

/**
 * 应用级 Modal 兼容层
 * 内部基于 HeroUI v3 Modal,保留向后兼容的 size 语义
 * 新代码请直接使用 HeroUI Modal
 *
 * 关键说明：HeroUI v3 中 `full` / `cover` 会强制 `rounded-none` 并撑满全屏，
 * 因此大尺寸（xl 及以上）只能映射到 `lg`，并通过 `!max-w-*` 还原 v2 的实际宽度。
 */
const SIZE_CONFIG: Record<
  string,
  { size: ModalSize; widthClass: string }
> = {
  sm: { size: "sm", widthClass: "!w-[90vw] !max-w-[90vw]" },
  md: { size: "md", widthClass: "!w-[90vw] !max-w-[90vw]" },
  lg: { size: "lg", widthClass: "!w-[90vw] !max-w-[90vw]" },
  xl: { size: "lg", widthClass: "!w-[90vw] !max-w-[90vw]" }, // 90vw — 角色详情/选人
  "2xl": { size: "lg", widthClass: "!w-[90vw] !max-w-[90vw]" }, // 90vw — 账户切换
  "3xl": { size: "lg", widthClass: "!w-[90vw] !max-w-[90vw]" },
  "4xl": { size: "lg", widthClass: "!w-[90vw] !max-w-[90vw]" },
  "5xl": { size: "lg", widthClass: "!w-[90vw] !max-w-[90vw]" },
};

interface CustomModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: keyof typeof SIZE_CONFIG;
  /** 锁定点击背景关闭 */
  disableBackdropClick?: boolean;
  /** 是否使用固定高度（用于长内容） */
  height?: "auto" | "fixed";
}

export const CustomModal: React.FC<CustomModalProps> = ({
  isOpen,
  onClose,
  children,
  size = "md",
  disableBackdropClick = false,
  height = "auto",
}) => {
  const config = SIZE_CONFIG[size] ?? SIZE_CONFIG.md;
  const dialogHeightClass =
    height === "fixed"
      ? "!h-[90vh] !max-h-[90vh]"
      : "!max-h-[90vh]";

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Backdrop
        variant="blur"
        isDismissable={!disableBackdropClick}
        className="z-[100]"
      >
        <Modal.Container
          size={config.size}
          placement="center"
          scroll="outside"
        >
          <Modal.Dialog
            className={`bg-background border border-separator rounded-2xl !p-0 ${config.widthClass} ${dialogHeightClass} flex flex-col`}
          >
            {children}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};

interface ModalHeaderProps {
  children: React.ReactNode;
  onClose?: () => void;
  rightContent?: React.ReactNode;
  className?: string;
}

export const CustomModalHeader: React.FC<ModalHeaderProps> = ({
  children,
  onClose,
  rightContent,
  className,
}) => {
  return (
    <Modal.Header
      className={`relative flex items-center justify-between border-b border-separator px-6 py-4 shrink-0 ${className ?? ""}`}
    >
      <div className="text-lg font-semibold text-foreground">{children}</div>
      <div className="flex items-center gap-2">{rightContent}</div>
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 rounded-full bg-default-50 hover:bg-default-100 transition-colors text-muted hover:text-foreground shadow-sm"
          aria-label="Close"
        >
          <CloseIcon size={20} />
        </button>
      )}
    </Modal.Header>
  );
};

interface ModalBodyProps {
  children: React.ReactNode;
  className?: string;
  onScroll?: React.UIEventHandler<HTMLDivElement>;
}

export const CustomModalBody = forwardRef<HTMLDivElement, ModalBodyProps>(
  ({ children, className, onScroll }, ref) => {
    return (
      <Modal.Body
        ref={ref}
        onScroll={onScroll}
        className={`flex-1 min-h-0 px-6 py-4 overflow-y-auto ${className ?? ""}`}
      >
        {children}
      </Modal.Body>
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
  className,
}) => {
  return (
    <Modal.Footer
      className={`flex items-center justify-end gap-2 px-6 py-4 border-t border-separator shrink-0 ${className ?? ""}`}
    >
      {children}
    </Modal.Footer>
  );
};
