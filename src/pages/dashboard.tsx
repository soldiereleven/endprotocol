import { useEffect, useState } from "react";
import { Card } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { getSelectedAccount } from "@/utils/accountService";
import { CardContainer } from "@/components/cards/card-container";
import { DashboardFAB } from "@/components/dashboard-fab";
import { AddCardModal } from "@/components/add-card-modal";
import { CardType, DashboardConfig } from "@/types/dashboard";
import {
  getDashboardConfig,
  addCard,
  removeCard,
  moveCard,
} from "@/utils/dashboardConfig";
import { logDebug, logError } from "@/utils/logger";

export default function DashboardPage() {
  const { t } = useTranslation();
  const [currentRoleId, setCurrentRoleId] = useState<string | null>(null);
  const [dashboardConfig, setDashboardConfig] =
    useState<DashboardConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAddCardModalOpen, setIsAddCardModalOpen] = useState(false);

  // Load current account and dashboard config
  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setIsLoading(true);

        // Get selected account
        const selectedAccountId = await getSelectedAccount();
        if (!selectedAccountId) {
          logDebug("No account selected");
          setIsLoading(false);
          return;
        }

        setCurrentRoleId(selectedAccountId);

        // Load dashboard config for this role
        const config = await getDashboardConfig(selectedAccountId);
        setDashboardConfig(config);
      } catch (error) {
        logError("Failed to load dashboard:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboard();

    // Listen for account changes
    const handleAccountChange = () => {
      loadDashboard();
    };

    window.addEventListener("accountChanged", handleAccountChange);

    return () => {
      window.removeEventListener("accountChanged", handleAccountChange);
    };
  }, []);

  // Handle adding a card
  const handleAddCard = async (cardType: CardType) => {
    if (!currentRoleId) return;

    try {
      await addCard(currentRoleId, cardType);
      const config = await getDashboardConfig(currentRoleId);
      setDashboardConfig(config);
    } catch (error) {
      logError("Failed to add card:", error);
    }
  };

  // Handle removing a card
  const handleRemoveCard = async (cardId: string) => {
    if (!currentRoleId) return;

    try {
      await removeCard(currentRoleId, cardId);
      const config = await getDashboardConfig(currentRoleId);
      setDashboardConfig(config);
    } catch (error) {
      logError("Failed to remove card:", error);
    }
  };

  // Handle moving a card
  const handleMoveCard = async (cardId: string, direction: "up" | "down") => {
    if (!currentRoleId || !dashboardConfig) return;

    const currentIndex = dashboardConfig.cards.findIndex(
      (c) => c.id === cardId,
    );
    if (currentIndex === -1) return;

    let newIndex: number;
    if (direction === "up") {
      newIndex = Math.max(0, currentIndex - 1);
    } else {
      newIndex = Math.min(dashboardConfig.cards.length - 1, currentIndex + 1);
    }

    if (newIndex === currentIndex) return;

    try {
      await moveCard(currentRoleId, cardId, newIndex);
      const config = await getDashboardConfig(currentRoleId);
      setDashboardConfig(config);
    } catch (error) {
      logError("Failed to move card:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!currentRoleId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
            {t("nav.dashboard")}
          </h1>
        </div>
        <Card className="p-12 bg-content1 shadow-md border border-separator">
          <div className="text-center">
            <svg
              className="w-16 h-16 mx-auto mb-4 opacity-50 text-muted"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            <p className="text-lg font-medium text-foreground">
              {t('dashboard.no_account_selected') || 'No Account Selected'}
            </p>
            <p className="text-sm text-muted mt-2">
              {t('dashboard.select_account_hint') || 'Please select an account from the sidebar to view your dashboard'}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header Section */}
      <div
        id="dashboard-header"
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
            {t("nav.dashboard")}
          </h1>
          <p className="text-muted mt-1">{t('dashboard.customize_hint') || 'Customize your dashboard with cards'}</p>
        </div>
      </div>

      {/* Card Container */}
      {dashboardConfig && (
        <CardContainer
          roleId={currentRoleId}
          cards={dashboardConfig.cards}
          onRemoveCard={handleRemoveCard}
          isEditMode={isEditMode}
        />
      )}

      {/* Floating Action Button */}
      <DashboardFAB
        onAddCard={() => setIsAddCardModalOpen(true)}
        onToggleEdit={() => setIsEditMode(!isEditMode)}
        isEditMode={isEditMode}
      />

      {/* Add Card Modal */}
      {dashboardConfig && (
        <AddCardModal
          isOpen={isAddCardModalOpen}
          onClose={() => setIsAddCardModalOpen(false)}
          onAdd={handleAddCard}
          existingTypes={dashboardConfig.cards.map((c) => c.type)}
        />
      )}
    </div>
  );
}
