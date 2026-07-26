import { useState, useCallback, useEffect } from "react";
import { AlertDialog, Button, Modal } from "@heroui/react";

type ConfirmTone = "primary" | "danger" | "warning";

interface ConfirmOptions {
  title: string;
  body?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  tone?: ConfirmTone;
}

let externalHandler: ((opts: ConfirmOptions) => Promise<boolean>) | null = null;

/** 编程式触发确认弹窗(替代 window.confirm) */
export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  return externalHandler ? externalHandler(opts) : Promise.resolve(false);
}

/** 挂载的 Host 组件 */
export function ConfirmDialogHost() {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const [resolveFn, setResolveFn] = useState<((v: boolean) => void) | null>(
    null,
  );

  const handler = useCallback(
    (o: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setOpts(o);
        setOpen(true);
        setResolveFn(() => resolve);
      }),
    [],
  );

  useEffect(() => {
    externalHandler = handler;
    return () => {
      if (externalHandler === handler) externalHandler = null;
    };
  }, [handler]);

  const close = (value: boolean) => {
    setOpen(false);
    resolveFn?.(value);
    setResolveFn(null);
  };

  if (!opts) return null;

  const variant = opts.tone === "danger" ? "danger" : "primary";

  return (
    <Modal
      isOpen={open}
      onOpenChange={(o) => !o && close(false)}
    >
      <Modal.Backdrop variant="blur" className="z-[100]">
        <Modal.Container size="sm" placement="center" scroll="outside">
          <Modal.Dialog className="glass-surface-strong border border-separator/90">
            <Modal.Header>
              <Modal.Heading>{opts.title}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>{opts.body}</Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" onPress={() => close(false)}>
                {opts.cancelText ?? "Cancel"}
              </Button>
              <Button variant={variant} onPress={() => close(true)}>
                {opts.confirmText ?? "Confirm"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

/** 开发者模式警告 - 复用 AlertDialog 风格 */
interface DevWarningDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  body: string;
  confirmText: string;
  cancelText: string;
}

export function DevWarningDialog({
  isOpen,
  onOpenChange,
  onConfirm,
  title,
  body,
  confirmText,
  cancelText,
}: DevWarningDialogProps) {
  return (
    <AlertDialog isOpen={isOpen} onOpenChange={onOpenChange}>
      <AlertDialog.Backdrop>
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-[400px]">
            <AlertDialog.CloseTrigger />
            <AlertDialog.Header>
              <AlertDialog.Icon status="warning" />
              <AlertDialog.Heading>{title}</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>{body}</p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button
                variant="tertiary"
                onPress={() => onOpenChange(false)}
              >
                {cancelText}
              </Button>
              <Button
                variant="primary"
                onPress={() => {
                  onConfirm();
                  onOpenChange(false);
                }}
              >
                {confirmText}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}
