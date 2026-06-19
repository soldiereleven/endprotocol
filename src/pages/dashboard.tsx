import { useEffect, useState } from "react";
import { Card, Button, Tooltip, ProgressCircle } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { getSelectedAccount, refreshAccountData } from "@/utils/accountService";
import { CardContainer } from "@/components/cards/card-container";
import { DashboardFAB } from "@/components/dashboard-fab";
import { AddCardModal } from "@/components/add-card-modal";
import { CharacterListSizeModal } from "@/components/character-list-size-modal";
import { CardTypeId, DashboardConfig } from "@/types/dashboard";
import {
  getDashboardConfig,
  addCard,
  removeCard,
} from "@/utils/dashboardConfig";
import { logDebug, logError } from "@/utils/logger";
import { roleDetailService } from "@/utils/roleDetailService";
import { CardConfigService } from "@/utils/cardConfigService";
import { RefreshIcon } from "@/components/ui/app-icon";
import type { CharacterListDisplayMode } from "@/types/card-settings";

export default function DashboardPage() {
  const { t } = useTranslation();
  const [currentRoleId, setCurrentRoleId] = useState<string | null>(null);
  const [dashboardConfig, setDashboardConfig] =
    useState<DashboardConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAddCardModalOpen, setIsAddCardModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSizeModalOpen, setIsSizeModalOpen] = useState(false);
  const [pendingCardType, setPendingCardType] = useState<string | null>(null);

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

    // character_list 类型需要选择显示模式
    if (cardType === "character_list") {
      setPendingCardType(cardType);
      setIsSizeModalOpen(true);
      return;
    }

    try {
      await addCard(currentRoleId, cardType);
      const config = await getDashboardConfig(currentRoleId);
      setDashboardConfig(config);
    } catch (error) {
      logError("Failed to add card:", error);
    }
  };

  const handleSizeConfirm = async (mode: CharacterListDisplayMode) => {
    if (!currentRoleId || !pendingCardType) return;

    const SIZE_MAP: Record<CharacterListDisplayMode, { w: number; h: number }> = {
      single: { w: 2, h: 3 },
      double: { w: 3, h: 3 },
      triple: { w: 4, h: 3 },
    };

    const { w, h } = SIZE_MAP[mode];

    try {
      await addCard(currentRoleId, pendingCardType, {
        w,
        h,
        settings: { displayMode: mode },
      });
      const config = await getDashboardConfig(currentRoleId);
      setDashboardConfig(config);
    } catch (error) {
      logError("Failed to add character list card:", error);
    } finally {
      setIsSizeModalOpen(false);
      setPendingCardType(null);
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
        <Tooltip>
          <Button
            isIconOnly
            variant="ghost"
            size="sm"
            onPress={handleRefresh}
            isDisabled={isRefreshing}
            className="text-muted hover:text-foreground"
            aria-label={t("common.refresh") || "Refresh"}
          >
            <RefreshIcon size={20} className={isRefreshing ? "animate-spin" : ""} />
          </Button>
          <Tooltip.Content>
            {t("common.refresh") || "Refresh"}
          </Tooltip.Content>
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

      {/* Character List Size Selection Modal */}
      <CharacterListSizeModal
        isOpen={isSizeModalOpen}
        onClose={() => {
          setIsSizeModalOpen(false);
          setPendingCardType(null);
        }}
        onConfirm={handleSizeConfirm}
      />
    </div>
  );
}
