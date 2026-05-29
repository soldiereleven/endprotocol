import { useEffect, useState } from "react";
import { Card, Button, Tooltip, ProgressCircle } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { getSelectedAccount, refreshAccountData } from "@/utils/accountService";
import { CardContainer } from "@/components/cards/card-container";
import { DashboardFAB } from "@/components/dashboard-fab";
import { AddCardModal } from "@/components/add-card-modal";
import { CardTypeId, DashboardConfig } from "@/types/dashboard";
import {
  getDashboardConfig,
  addCard,
  removeCard,
  moveCard,
} from "@/utils/dashboardConfig";
import { logDebug, logError } from "@/utils/logger";
import { roleDetailService } from "@/utils/roleDetailService";
import { CardConfigService } from "@/utils/cardConfigService";

export default function DashboardPage() {
  const { t } = useTranslation();
  const [currentRoleId, setCurrentRoleId] = useState<string | null>(null);
  const [dashboardConfig, setDashboardConfig] =
    useState<DashboardConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAddCardModalOpen, setIsAddCardModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load current account and dashboard config
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

      // 并行加载：通知后端当前的角色ID + 获取仪表盘配置
      const [, config] = await Promise.all([
        roleDetailService.setCurrentRoleId(selectedAccountId),
        getDashboardConfig(selectedAccountId),
      ]);
      setDashboardConfig(config);
      setIsLoading(false);
    } catch (error) {
      logError("Failed to load dashboard:", error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();

    // Listen for account changes
    const handleAccountChange = () => {
      loadDashboard();
    };

    // Listen for manual refresh events (from Account page)
    const handleManualRefresh = () => {
      logDebug("[Dashboard] Received manual refresh event, reloading data...");
      loadDashboard();
    };

    window.addEventListener("accountChanged", handleAccountChange);
    window.addEventListener("manualRefresh", handleManualRefresh);

    return () => {
      window.removeEventListener("accountChanged", handleAccountChange);
      window.removeEventListener("manualRefresh", handleManualRefresh);
    };
  }, []);

  // Handle manual refresh - same as Account page
  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);

      // Notify sidebar to show skeleton (same as Account page)
      window.dispatchEvent(
        new CustomEvent("manualRefresh", {
          detail: { count: dashboardConfig?.cards.length || 1 },
        }),
      );

      // Call the same API as Account page
      const result = await refreshAccountData();

      if (result.success && result.accounts) {
        logDebug("[Dashboard] Data refreshed successfully");
        // Reload dashboard config after data refresh
        await loadDashboard();
      }
    } catch (error) {
      logError("Failed to refresh dashboard:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle adding a card
  const handleAddCard = async (cardType: CardTypeId) => {
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
      // 并行删除：卡片配置 + 从 Dashboard 配置中移除卡片
      await Promise.all([
        CardConfigService.removeCardSettings(cardId),
        removeCard(currentRoleId, cardId),
      ]);
      logDebug(`Removed settings for card ${cardId}`);

      // 更新 UI
      const config = await getDashboardConfig(currentRoleId);
      setDashboardConfig(config);

      logDebug(`Successfully removed card ${cardId}`);
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

  if (!currentRoleId && !isLoading) {
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
              {t("dashboard.no_account_selected") || "No Account Selected"}
            </p>
            <p className="text-sm text-muted mt-2">
              {t("dashboard.select_account_hint") ||
                "Please select an account from the sidebar to view your dashboard"}
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
          <p className="text-muted mt-1">
            {t("dashboard.customize_hint") ||
              "Customize your dashboard with cards"}
          </p>
        </div>
        <Tooltip content={t("common.refresh") || "Refresh"}>
          <Button
            isIconOnly
            variant="ghost"
            size="sm"
            onPress={handleRefresh}
            isLoading={isRefreshing}
            className="text-muted hover:text-foreground"
            aria-label={t("common.refresh") || "Refresh"}
          >
            <svg
              className={`w-5 h-5 ${isRefreshing ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </Button>
        </Tooltip>
      </div>

      {/* Card Container - always renders when config is available */}
      {isRefreshing ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <ProgressCircle isIndeterminate size="lg" aria-label="Loading">
            <ProgressCircle.Track>
              <ProgressCircle.TrackCircle />
              <ProgressCircle.FillCircle />
            </ProgressCircle.Track>
          </ProgressCircle>
          <p className="text-sm text-muted">
            {t("common.refreshing") || "Refreshing..."}
          </p>
        </div>
      ) : dashboardConfig ? (
        <CardContainer
          roleId={currentRoleId!}
          cards={dashboardConfig.cards}
          onRemoveCard={handleRemoveCard}
          isEditMode={isEditMode}
          onEnterEditMode={() => setIsEditMode(true)}
          onExitEditMode={() => setIsEditMode(false)}
        />
      ) : isLoading ? (
        <div className="flex items-center justify-center py-20">
          <ProgressCircle isIndeterminate size="lg" aria-label="Loading">
            <ProgressCircle.Track>
              <ProgressCircle.TrackCircle />
              <ProgressCircle.FillCircle />
            </ProgressCircle.Track>
          </ProgressCircle>
        </div>
      ) : null}

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
