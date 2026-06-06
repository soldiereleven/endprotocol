import { useState, useEffect } from "react";
import { Button } from "@heroui/react";
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

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isExpanded && (
        <div className="absolute bottom-16 right-0 flex flex-col gap-2 animate-fade-in">
          <Button
            variant="primary"
            size="lg"
            onPress={onAddCard}
            className="shadow-lg min-w-[160px] flex items-center gap-2"
          >
            <PlusIcon size={20} />
            {t("dashboard.add_card_button") || "Add Card"}
          </Button>

          <Button
            variant={isEditMode ? "danger" : "secondary"}
            size="lg"
            onPress={onToggleEdit}
            className="shadow-lg min-w-[160px] flex items-center gap-2"
          >
            {isEditMode ? <CheckIcon size={20} /> : <EditIcon size={20} />}
            {isEditMode
              ? t("dashboard.exit_edit") || "Exit Edit"
              : t("dashboard.edit_mode") || "Edit Mode"}
          </Button>
        </div>
      )}

      <Button
        isIconOnly
        variant={isEditMode ? "danger" : "primary"}
        size="lg"
        onPress={() => setIsExpanded((v) => !v)}
        aria-label="FAB toggle"
        className={`w-14 h-14 shadow-xl transition-transform duration-300 rounded-full ${
          isExpanded ? "rotate-90" : "rotate-0"
        }`}
      >
        {isExpanded ? <CloseIcon size={24} /> : <PlusIcon size={24} />}
      </Button>
    </div>
  );
}
