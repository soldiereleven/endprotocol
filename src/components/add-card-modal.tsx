import { useState } from "react";
import { Button, Card } from "@heroui/react";
import {
  CustomModal,
  CustomModalHeader,
  CustomModalBody,
  CustomModalFooter,
} from "./custom-modal";
import { useTranslation } from "react-i18next";
import { getAvailableCards } from "./cards/registry/loader";

interface AddCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (cardType: string) => void;
  existingTypes: string[];
}

export function AddCardModal({
  isOpen,
  onClose,
  onAdd,
  existingTypes,
}: AddCardModalProps) {
  const { t, i18n } = useTranslation();
  const [selectedType, setSelectedType] = useState<string | null>(null);

  // Get available cards from registry
  const availableCards = getAvailableCards();

  // Filter cards based on allowMultiple setting
  const displayCards = availableCards.filter((card) => {
    // If allowMultiple is true or not set, always show
    if (card.allowMultiple !== false) return true;

    // If allowMultiple is false, only show if not already added
    return !existingTypes.includes(card.id);
  });

  const handleConfirm = () => {
    if (selectedType) {
      onAdd(selectedType);
      setSelectedType(null);
      onClose();
    }
  };

  const handleClose = () => {
    setSelectedType(null);
    onClose();
  };

  return (
    <CustomModal isOpen={isOpen} onClose={handleClose} size="md">
      <CustomModalHeader onClose={handleClose}>
        {t("dashboard.add_card.title") || "Add Card"}
      </CustomModalHeader>
      <CustomModalBody>
        <div className="space-y-3">
          {displayCards.length === 0 ? (
            <div className="text-center py-8 text-muted">
              {t("dashboard.add_card.no_available_cards") ||
                "No available cards"}
            </div>
          ) : (
            displayCards.map((card) => {
              const isSelected = selectedType === card.id;

              return (
                <Card
                  key={card.id}
                  className={`p-4 cursor-pointer transition-all ${
                    isSelected
                      ? "border-[3px] border-blue-500 bg-blue-50 dark:bg-blue-900/40 shadow-md scale-[1.02]"
                      : "hover:border-blue-400/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-2 border-transparent"
                  }`}
                  onClick={() => setSelectedType(card.id)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{card.icon}</span>
                    <div className="flex-1">
                      <h3 className="font-semibold">
                        {card.name[i18n.language] || card.name.en}
                      </h3>
                      <p className="text-sm text-muted">
                        {card.description[i18n.language] || card.description.en}
                      </p>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </CustomModalBody>
      <CustomModalFooter>
        <Button variant="secondary" onPress={handleClose}>
          {t("common.cancel") || "Cancel"}
        </Button>
        <Button
          color="primary"
          isDisabled={!selectedType}
          onPress={handleConfirm}
        >
          {t("common.confirm") || "Confirm"}
        </Button>
      </CustomModalFooter>
    </CustomModal>
  );
}
