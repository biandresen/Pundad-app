import { useCallback, useEffect, type ReactNode } from "react";
import { useLanguage } from "../../contexts/LanguageContext";

type ModalVariant = "confirm" | "info" | "custom";

type ModalProps = {
  isOpen: boolean;
  title?: string;

  message?: string;
  children?: ReactNode;

  onClose?: () => void;
  onCancel?: () => void;
  closeOnBackdrop?: boolean;

  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;

  variant?: ModalVariant;
  autoCloseMs?: number;
};

const Modal = ({
  isOpen,
  title,
  message,
  children,

  onClose,
  onCancel,
  closeOnBackdrop = true,

  onConfirm,
  confirmText,
  cancelText,

  variant = "confirm",
  autoCloseMs,
}: ModalProps) => {
  const { t } = useLanguage();

  const close = useCallback(() => {
    const handler = onClose ?? onCancel;
    handler?.();
  }, [onClose, onCancel]);
  const resolvedConfirmText = confirmText ?? t("modal.confirm");
  const resolvedCancelText = cancelText ?? t("modal.cancel");
  const resolvedCloseText = t("modal.close");

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };

    document.addEventListener("keydown", handleEscape);

    let timeoutId: number | undefined;
    if (variant === "info" && autoCloseMs) {
      timeoutId = window.setTimeout(() => close(), autoCloseMs);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [isOpen, close, variant, autoCloseMs]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50 z-[100]"
      onClick={closeOnBackdrop ? close : undefined}
    >
      <div
        className="bg-[var(--primary-shade)] text-[var(--text2)] rounded-2xl p-6 shadow-2xl
                   w-[min(92vw,32rem)] max-h-[95vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-3">
          {title ?
            <h2 className="text-xl font-semibold">{title}</h2>
          : <span />}
          <button
            type="button"
            onClick={close}
            className="rounded-lg px-2 py-1 hover:bg-white/5"
            aria-label={t("modal.closeAria")}
            title={t("modal.closeTitle")}
          >
            ✕
          </button>
        </div>

        {message ?
          <p className="mb-4 whitespace-pre-wrap">{message}</p>
        : null}
        {children}

        {variant === "confirm" && (
          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={close}
              className="px-4 py-2 rounded-xl bg-[var(--primary)] text-[var(--text2)] hover:bg-[var(--primary-tint)] transition"
            >
              {resolvedCancelText}
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 rounded-xl bg-[var(--error)] text-white hover:bg-red-400 transition"
            >
              {resolvedConfirmText}
            </button>
          </div>
        )}

        {variant === "info" && (
          <div className="flex justify-end mt-4">
            <button
              onClick={close}
              className="px-4 py-2 rounded-xl bg-[var(--primary-shade)] text-[var(--text2)] hover:bg-[var(--primary-tint)] transition"
            >
              {resolvedCloseText}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
