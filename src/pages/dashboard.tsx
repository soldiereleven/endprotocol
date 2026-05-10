import { useEffect, useState } from "react";
import { Card, Button, Tooltip, Skeleton, ProgressCircle } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { getSelectedAccount, refreshAccountData } from "@/utils/accountService";
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

      // Load dashboard config for this role
      const config = await getDashboardConfig(selectedAccountId);
      setDashboardConfig(config);
    } catch (error) {
      logError("Failed to load dashboard:", error);
    } finally {
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

  // Render skeleton for dashboard cards
  const renderSkeleton = () => {
    const GRID_SIZE = 100; // Match CardContainer grid size
    const BASE_PADDING = 100; // Match CardContainer's basePadding

    // Use the actual cards array
    const cards = dashboardConfig?.cards || [];
    const cardCount = cards.length || 3; // Fallback to 3 if empty

    // Calculate container height the same way CardContainer does
    let maxY = 0;
    for (let i = 0; i < cardCount; i++) {
      const card = cards[i];
      let y, h;

      if (card && card.x !== undefined && card.y !== undefined) {
        y = card.y ?? 0;
        h = card.h ?? 2;
      } else {
        // Default layout: 3 cards per row, each card is 2 grid units high
        const row = Math.floor(i / 3);
        y = row * 2;
        h = 2;
      }

      const cardBottom = (y + h) * GRID_SIZE;
      maxY = Math.max(maxY, cardBottom);
    }
    const containerHeight = maxY + BASE_PADDING;

    console.log("[renderSkeleton] Debug:", {
      cardCount,
      maxY,
      BASE_PADDING,
      containerHeight,
      cards: cards.map((c) => ({ x: c.x, y: c.y, w: c.w, h: c.h })),
    });

    return (
      <div className="relative w-full">
        {/* Inner container with dynamic height - matches CardContainer exactly */}
        <div
          className="relative w-full"
          style={{
            minHeight: containerHeight,
          }}
        >
          {/* Invisible spacer to ensure container height is respected */}
          <div
            style={{
              width: "100%",
              height: containerHeight,
              visibility: "hidden",
              pointerEvents: "none",
            }}
            aria-hidden="true"
          />

          {/* Cards */}
          {[...Array(cardCount)].map((_, index) => {
            // Calculate position based on card config or default layout
            const card = dashboardConfig?.cards[index];

            // Use card's x,y if available, otherwise calculate based on index
            let x, y, w, h;
            if (card && card.x !== undefined && card.y !== undefined) {
              // Use card's actual position
              x = card.x * GRID_SIZE;
              y = card.y * GRID_SIZE;
              w = (card.w ?? 3) * GRID_SIZE;
              h = (card.h ?? 2) * GRID_SIZE;
            } else {
              // Default layout: 3 cards per row, each card is 2 grid units high
              const col = index % 3;
              const row = Math.floor(index / 3);
              x = col * GRID_SIZE;
              y = row * GRID_SIZE * 2; // Each row is 2 grid units high
              w = 3 * GRID_SIZE;
              h = 2 * GRID_SIZE;
            }

            return (
              <div
                key={index}
                className="absolute"
                style={{
                  left: x,
                  top: y,
                  width: w,
                  height: h,
                }}
              >
                <Card className="p-6 bg-content1 shadow-sm border border-separator h-full w-full">
                  <div className="space-y-4">
                    {/* Title skeleton */}
                    <Skeleton className="w-1/2 h-5 rounded-lg" />

                    {/* Content skeleton */}
                    <div className="grid grid-cols-3 gap-2">
                      {[1, 2, 3].map((i) => (
                        <Skeleton
                          key={i}
                          className="w-full h-[140px] rounded-lg"
                        />
                      ))}
                    </div>
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

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

      {/* Card Container */}
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
          roleId={currentRoleId}
          cards={dashboardConfig.cards}
          onRemoveCard={handleRemoveCard}
          isEditMode={isEditMode}
          onEnterEditMode={() => setIsEditMode(true)}
          onExitEditMode={() => setIsEditMode(false)}
        />
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
