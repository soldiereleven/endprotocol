import { useState } from "react";
import { Button } from "@heroui/react";
import { useTranslation } from "react-i18next";

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

  const handleClick = () => {
    if (isExpanded) {
      // Collapse
      setIsExpanded(false);
    } else {
      // Expand
      setIsExpanded(true);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Expanded menu */}
      {isExpanded && (
        <div className="absolute bottom-16 right-0 flex flex-col gap-2 animate-in slide-in-from-bottom-2 fade-in duration-200">
          {/* Add Card button */}
          <Button
            variant="primary"
            size="lg"
            onPress={() => {
              onAddCard();
              // Keep menu expanded after action
            }}
            className="shadow-lg min-w-[160px] flex items-center gap-2"
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
                d="M12 4v16m8-8H4"
              />
            </svg>
            {t("dashboard.add_card_button") || "Add Card"}
          </Button>

          {/* Edit mode toggle */}
          <Button
            variant={isEditMode ? "danger" : "secondary"}
            size="lg"
            onPress={() => {
              onToggleEdit();
              // Keep menu expanded after action
            }}
            className="shadow-lg min-w-[160px] flex items-center gap-2"
          >
            {isEditMode ? (
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
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
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
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            )}
            {isEditMode
              ? t("dashboard.exit_edit") || "Exit Edit"
              : t("dashboard.edit_mode") || "Edit Mode"}
          </Button>
        </div>
      )}

      {/* Main FAB button */}
      <Button
        isIconOnly
        variant={isEditMode ? "danger" : "primary"}
        size="lg"
        onPress={handleClick}
        className={`w-14 h-14 shadow-xl transition-transform duration-300 rounded-full ${
          isExpanded ? "rotate-90" : "rotate-0"
        }`}
      >
        <svg
          className="w-6 h-6 transition-transform duration-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={isExpanded ? "M6 18L18 6M6 6l12 12" : "M12 4v16m8-8H4"}
          />
        </svg>
      </Button>
    </div>
  );
}
