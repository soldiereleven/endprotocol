import { useState } from "react";
import { Button, Card } from "@heroui/react";
import {
  CustomModal,
  CustomModalHeader,
  CustomModalBody,
  CustomModalFooter,
} from "./custom-modal";
import { CardType } from "@/types/dashboard";
import { useTranslation } from "react-i18next";

interface AddCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (cardType: CardType) => void;
  existingTypes: CardType[];
}

export function AddCardModal({
  isOpen,
  onClose,
  onAdd,
  existingTypes,
}: AddCardModalProps) {
  const { t } = useTranslation();
  const [selectedType, setSelectedType] = useState<CardType | null>(null);

  // Define available card types with metadata
  const availableCards = [
    {
      type: CardType.CHARACTER_LIST,
      name: t("dashboard.cards.character_list") || "Character List",
      description:
        t("dashboard.cards.character_list_desc") || "Display pinned characters",
      icon: "👥",
    },
    // Future card types can be added here
  ];

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
          {availableCards.map((card) => {
            const isDisabled = existingTypes.includes(card.type);
            const isSelected = selectedType === card.type;

            return (
              <Card
                key={card.type}
                className={`p-4 cursor-pointer transition-all ${
                  isDisabled
                    ? "opacity-50 cursor-not-allowed bg-default-100"
                    : isSelected
                      ? "border-2 border-primary bg-primary/10"
                      : "hover:border-primary/50 border-2 border-transparent"
                }`}
                onClick={() => !isDisabled && setSelectedType(card.type)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{card.icon}</span>
                  <div className="flex-1">
                    <h3 className="font-semibold">{card.name}</h3>
                    <p className="text-sm text-muted">{card.description}</p>
                  </div>
                  {isDisabled && (
                    <span className="px-2 py-1 bg-default-200 rounded text-xs">
                      {t("dashboard.add_card.already_added") || "Added"}
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </CustomModalBody>
      <CustomModalFooter>
        <Button variant="flat" onPress={handleClose}>
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
