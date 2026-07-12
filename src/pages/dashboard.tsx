import { useEffect, useState } from "react";
import { Button, Tooltip, ProgressCircle } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { getSelectedAccount, refreshAccountData, getAccounts } from "@/utils/accountService";
import type { Account } from "@/utils/accountService";
import { CardContainer } from "@/components/cards/card-container";
import { DashboardFAB } from "@/components/dashboard-fab";
import { AddCardModal } from "@/components/add-card-modal";
import { CharacterListSizeModal } from "@/components/cards/character-list/character-list-size-modal";
import { CardTypeId, DashboardConfig, DashboardTab } from "@/types/dashboard";
import {
  getDashboardConfig,
  addCard,
  removeCard,
} from "@/utils/dashboardConfig";
import {
  getAllTabs,
  getActiveTabId,
  setActiveTabId,
  addTab,
  removeTab,
  updateTab,
} from "@/utils/tabService";
import { logDebug, logError } from "@/utils/logger";
import { roleDetailService } from "@/utils/roleDetailService";
import { CardConfigService } from "@/utils/cardConfigService";
import { CardStartupService } from "@/cards/startup-service";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { RefreshIcon, ChevronLeftIcon } from "@/components/ui/app-icon";
import { getTabIcon } from "@/utils/tabIcons";
import { TabSelector } from "@/components/tab-selector";
import { TabEditorModal } from "@/components/tab-editor-modal";
import type { CharacterListDisplayMode } from "@/types/card-settings";
import { Img } from "@/utils/imageLoader";
import {
  CustomModal,
  CustomModalHeader,
  CustomModalBody,
  CustomModalFooter,
} from "@/components/custom-modal";
import { resolveServerLabel } from "@/types";

type DashboardView = "loading" | "selector" | "tab";

export default function DashboardPage() {
  const { t, i18n } = useTranslation();
  const [view, setView] = useState<DashboardView>("loading");
  const [tabs, setTabs] = useState<DashboardTab[]>([]);
  const [activeTabId, setActiveTabIdState] = useState<string | null>(null);
  const [currentRoleId, setCurrentRoleId] = useState<string | null>(null);
  const [dashboardConfig, setDashboardConfig] =
    useState<DashboardConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAddCardModalOpen, setIsAddCardModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSizeModalOpen, setIsSizeModalOpen] = useState(false);
  const [pendingCardType, setPendingCardType] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTab, setEditingTab] = useState<DashboardTab | undefined>();
  const [isRoleSelectModalOpen, setIsRoleSelectModalOpen] = useState(false);
  const [pendingDisplayMode, setPendingDisplayMode] = useState<CharacterListDisplayMode | null>(null);
  const [availableAccounts, setAvailableAccounts] = useState<Account[]>([]);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const loadDashboard = async () => {
    try {
      setIsLoading(true);
      const selectedAccountId = await getSelectedAccount();
      setCurrentRoleId(selectedAccountId);

      if (selectedAccountId) {
        await roleDetailService.setCurrentRoleId(selectedAccountId);
      }

      const allTabs = await getAllTabs();
      setTabs(allTabs);

      const savedActiveId = await getActiveTabId();
      if (savedActiveId && allTabs.some((t) => t.id === savedActiveId)) {
        setActiveTabIdState(savedActiveId);
        const config = await getDashboardConfig(savedActiveId);
        setDashboardConfig(config);
        setView("tab");
      } else if (allTabs.length > 0) {
        const firstTabId = allTabs[0].id;
        setActiveTabIdState(firstTabId);
        await setActiveTabId(firstTabId);
        const config = await getDashboardConfig(firstTabId);
        setDashboardConfig(config);
        setView("tab");
      } else {
        setDashboardConfig(null);
        setView("selector");
      }

      setIsLoading(false);
    } catch (error) {
      logError("Failed to load dashboard:", error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();

    const handleAccountChange = () => {
      loadDashboard();
    };
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

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      window.dispatchEvent(
        new CustomEvent("manualRefresh", {
          detail: { count: dashboardConfig?.cards.length || 1 },
        }),
      );
      const result = await refreshAccountData();
      if (result.success && result.accounts) {
        logDebug("[Dashboard] Data refreshed successfully");
        await loadDashboard();
      }
    } catch (error) {
      logError("Failed to refresh dashboard:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleAddCard = async (cardType: CardTypeId) => {
    if (!activeTabId) return;
    if (cardType === "character_list") {
      setPendingCardType(cardType);
      setIsSizeModalOpen(true);
      return;
    }
    try {
      await addCard(activeTabId, cardType);
      const config = await getDashboardConfig(activeTabId);
      setDashboardConfig(config);
    } catch (error) {
      logError("Failed to add card:", error);
    }
  };

  const handleSizeConfirm = async (mode: CharacterListDisplayMode) => {
    if (!activeTabId || !pendingCardType) return;
    setPendingDisplayMode(mode);
    setIsSizeModalOpen(false);
    
    // 获取所有可用账户
    try {
      const accounts = await getAccounts();
      setAvailableAccounts(accounts);
      setIsRoleSelectModalOpen(true);
    } catch (error) {
      logError("Failed to load accounts:", error);
    }
  };

  const handleRoleConfirm = async (roleId: string) => {
    if (!activeTabId || !pendingCardType || !pendingDisplayMode) return;
    const SIZE_MAP: Record<CharacterListDisplayMode, { w: number; h: number }> = {
      single: { w: 2, h: 3 },
      double: { w: 3, h: 3 },
      triple: { w: 4, h: 3 },
    };
    const { w, h } = SIZE_MAP[pendingDisplayMode];
    try {
      await addCard(activeTabId, pendingCardType, {
        w,
        h,
        settings: { displayMode: pendingDisplayMode, roleId },
      });
      const config = await getDashboardConfig(activeTabId);
      setDashboardConfig(config);
    } catch (error) {
      logError("Failed to add character list card:", error);
    } finally {
      setIsRoleSelectModalOpen(false);
      setPendingCardType(null);
      setPendingDisplayMode(null);
    }
  };

  const handleRemoveCard = async (cardId: string) => {
    if (!activeTabId) return;
    try {
      await Promise.all([
        CardConfigService.removeCardSettings(cardId),
        CardStartupService.removeCardFromMapping(cardId),
        removeCard(activeTabId, cardId),
      ]);
      logDebug(`Removed settings for card ${cardId}`);
      const config = await getDashboardConfig(activeTabId);
      setDashboardConfig(config);
      logDebug(`Successfully removed card ${cardId}`);
    } catch (error) {
      logError("Failed to remove card:", error);
    }
  };

  const handleSelectTab = async (tabId: string) => {
    await setActiveTabId(tabId);
    setActiveTabIdState(tabId);
    const config = await getDashboardConfig(tabId);
    setDashboardConfig(config);
    setView("tab");
  };

  const handleBackToSelector = async () => {
    await setActiveTabId(null);
    setActiveTabIdState(null);
    setDashboardConfig(null);
    setView("selector");
    const allTabs = await getAllTabs();
    setTabs(allTabs);
  };

  const handleCreateTab = () => {
    setEditingTab(undefined);
    setIsEditorOpen(true);
  };

  const handleEditTab = (tab: DashboardTab) => {
    setEditingTab(tab);
    setIsEditorOpen(true);
  };

  const handleDeleteTab = async (tabId: string) => {
    const confirmed = await confirmDialog({
      title: t("tab.confirm_delete_title"),
      body: t("tab.confirm_delete_body"),
      confirmText: t("common.delete"),
      cancelText: t("common.cancel"),
      tone: "danger",
    });
    if (!confirmed) return;

    await removeTab(tabId);
    const allTabs = await getAllTabs();
    setTabs(allTabs);
    if (activeTabId === tabId) {
      setActiveTabIdState(null);
      setDashboardConfig(null);
    }
  };

  const handleSaveTab = async (data: {
    name: string;
    icon: string;
    tags: string[];
    defaultRoleId: string;
  }) => {
    if (editingTab) {
      await updateTab(editingTab.id, data);
    } else {
      await addTab(data.name, data.icon, data.tags, data.defaultRoleId);
    }
    setIsEditorOpen(false);
    setEditingTab(undefined);
    const allTabs = await getAllTabs();
    setTabs(allTabs);
  };

  if (isLoading && view === "loading") {
    return (
      <div className="flex items-center justify-center py-20">
        <ProgressCircle isIndeterminate size="lg" aria-label="Loading">
          <ProgressCircle.Track>
            <ProgressCircle.TrackCircle />
            <ProgressCircle.FillCircle />
          </ProgressCircle.Track>
        </ProgressCircle>
      </div>
    );
  }

  if (view === "selector") {
    return (
      <>
        <TabSelector
          tabs={tabs}
          onSelectTab={handleSelectTab}
          onCreateTab={handleCreateTab}
          onEditTab={handleEditTab}
          onDeleteTab={handleDeleteTab}
        />
        <TabEditorModal
          isOpen={isEditorOpen}
          onClose={() => {
            setIsEditorOpen(false);
            setEditingTab(undefined);
          }}
          onSave={handleSaveTab}
          initialData={editingTab}
        />
      </>
    );
  }

  const IconComponent = activeTab ? getTabIcon(activeTab.icon) : null;

  return (
    <div className="space-y-6 lg:space-y-8">
      <div
        id="dashboard-header"
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <Tooltip>
            <Button
              isIconOnly
              variant="ghost"
              size="sm"
              onPress={handleBackToSelector}
              aria-label="Back"
            >
              <ChevronLeftIcon size={20} />
            </Button>
            <Tooltip.Content>
              {t("settings.account.back") || "Back"}
            </Tooltip.Content>
          </Tooltip>
          <div>
            <div className="flex items-center gap-2">
              {IconComponent && <IconComponent size={24} className="text-primary" />}
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
                {activeTab?.name ?? t("nav.dashboard")}
              </h1>
            </div>
            <p className="text-muted mt-1">
              {t("dashboard.customize_hint") ||
                "Customize your dashboard with cards"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
      </div>

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
          roleId={activeTab?.defaultRoleId || currentRoleId!}
          tabId={activeTabId!}
          cards={dashboardConfig.cards}
          onRemoveCard={handleRemoveCard}
          isEditMode={isEditMode}
          onEnterEditMode={() => setIsEditMode(true)}
          onExitEditMode={() => setIsEditMode(false)}
        />
      ) : null}

      <DashboardFAB
        onAddCard={() => setIsAddCardModalOpen(true)}
        onToggleEdit={() => setIsEditMode(!isEditMode)}
        isEditMode={isEditMode}
      />

      {dashboardConfig && (
        <AddCardModal
          isOpen={isAddCardModalOpen}
          onClose={() => setIsAddCardModalOpen(false)}
          onAdd={handleAddCard}
          existingTypes={dashboardConfig.cards.map((c) => c.type)}
        />
      )}

      <CharacterListSizeModal
        isOpen={isSizeModalOpen}
        onClose={() => {
          setIsSizeModalOpen(false);
          setPendingCardType(null);
        }}
        onConfirm={handleSizeConfirm}
      />

      {/* Role Select Modal for Character List Card */}
      <CustomModal
        isOpen={isRoleSelectModalOpen}
        onClose={() => {
          setIsRoleSelectModalOpen(false);
          setPendingCardType(null);
          setPendingDisplayMode(null);
        }}
        size="md"
      >
        <CustomModalHeader
          onClose={() => {
            setIsRoleSelectModalOpen(false);
            setPendingCardType(null);
            setPendingDisplayMode(null);
          }}
        >
          {t("card:select_role") || "Select Role"}
        </CustomModalHeader>
        <CustomModalBody>
          <div className="space-y-3">
            {availableAccounts.length === 0 ? (
              <div className="text-center text-muted py-8">
                {t("card:no_accounts") || "No accounts available"}
              </div>
            ) : (
              availableAccounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all hover:bg-default-100 border border-separator hover:border-primary/50"
                  onClick={() => handleRoleConfirm(account.id)}
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-default-200 shrink-0">
                    {account.avatar ? (
                      <Img
                        src={account.avatar}
                        alt={account.nickname}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted text-sm">
                        {account.nickname?.charAt(0) || "?"}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {account.nickname || t("common.unknown") || "Unknown"}
                    </div>
                    <div className="text-xs text-muted">
                      {resolveServerLabel(account.server, i18n.language)} · Lv.{account.level}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CustomModalBody>
        <CustomModalFooter>
          <Button
            variant="secondary"
            onPress={() => {
              setIsRoleSelectModalOpen(false);
              setPendingCardType(null);
              setPendingDisplayMode(null);
            }}
          >
            {t("common.cancel") || "Cancel"}
          </Button>
        </CustomModalFooter>
      </CustomModal>
    </div>
  );
}
