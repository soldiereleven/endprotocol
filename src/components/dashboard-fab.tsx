import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  PlusIcon,
  EditIcon,
  CheckIcon,
  CloseIcon,
} from "@/components/ui/app-icon";

interface DashboardFABProps {
  onAddCard: () => void;
  onToggleEdit: () => void;
  isEditMode: boolean;
}

export function DashboardFAB({
  onAddCard,
  onToggleEdit,
  isEditMode,
}: DashboardFABProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (isEditMode) setIsExpanded(true);
  }, [isEditMode]);

  return createPortal(
    <div className="fixed bottom-6 right-6 z-50">
      {isExpanded && (
        <div className="absolute bottom-16 right-0 flex flex-col gap-2 animate-fade-in">
          <button
            type="button"
            onClick={onAddCard}
            className="glass-surface-strong flex min-w-[160px] items-center justify-center gap-2 rounded-2xl border border-primary/50 px-4 h-11 text-sm font-medium text-primary shadow-lg transition-all duration-200 cursor-pointer hover:border-primary/90 hover:brightness-110"
          >
            <PlusIcon size={20} />
            {t("dashboard.add_card_button") || "Add Card"}
          </button>

          <button
            type="button"
            onClick={onToggleEdit}
            className="glass-surface-strong flex min-w-[160px] items-center justify-center gap-2 rounded-2xl border border-separator/70 px-4 h-11 text-sm font-medium text-foreground shadow-lg transition-all duration-200 cursor-pointer hover:border-primary/50 hover:text-primary"
          >
            {isEditMode ? <CheckIcon size={20} /> : <EditIcon size={20} />}
            {isEditMode
              ? t("dashboard.exit_edit") || "Exit Edit"
              : t("dashboard.edit_mode") || "Edit Mode"}
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        aria-label="FAB toggle"
        className={`glass-surface-strong flex h-14 w-14 items-center justify-center rounded-full border border-primary/50 text-primary shadow-xl transition-transform duration-300 cursor-pointer hover:border-primary/90 hover:brightness-110 ${
          isExpanded ? "rotate-90" : "rotate-0"
        }`}
      >
        {isExpanded ? <CloseIcon size={24} /> : <PlusIcon size={24} />}
      </button>
    </div>,
    document.body,
  );
}
