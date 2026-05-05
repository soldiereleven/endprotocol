import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  CustomModal,
  CustomModalHeader,
  CustomModalBody,
} from "@/components/custom-modal";
import { Card, Input, Skeleton } from "@heroui/react";
import { SearchIcon } from "@/components/icons";
import {
  getAccounts,
  setSelectedAccount as apiSetSelectedAccount,
  Account,
} from "@/utils/accountService";
import { accountCache } from "@/utils/accountCache";

interface AccountSwitchModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAccountId?: string | null;
}

export default function AccountSwitchModal({
  isOpen,
  onClose,
  currentAccountId,
}: AccountSwitchModalProps) {
  const { t, i18n } = useTranslation();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [expectedAccountCount, setExpectedAccountCount] = useState<number>(3); // 预期的账户数量

  // 加载账户列表
  useEffect(() => {
    if (isOpen) {
      loadAccounts();
    }

    // 监听手动刷新事件
    const handleManualRefresh = (event: Event) => {
      const customEvent = event as CustomEvent;
      const count = customEvent.detail?.count || 3;
      setExpectedAccountCount(Math.min(count, 5)); // 最多5个
    };

    window.addEventListener("manualRefresh", handleManualRefresh);

    return () => {
      window.removeEventListener("manualRefresh", handleManualRefresh);
    };
  }, [isOpen]);

  const loadAccounts = async () => {
    setIsLoading(true);
    try {
      // 直接使用缓存
      const cachedAccounts = accountCache.getAllAccounts();

      if (cachedAccounts && cachedAccounts.length > 0) {
        console.log("[AccountSwitchModal] Using cached accounts");
        setAccounts(cachedAccounts);
      } else {
        // 如果缓存为空，才从API获取
        console.log("[AccountSwitchModal] Cache is empty, fetching from API");
        const accountsData = await getAccounts();
        setAccounts(accountsData || []);
        // 更新缓存
        if (accountsData && accountsData.length > 0) {
          accountCache.cacheAccounts(accountsData);
        }
      }
    } catch (error) {
      console.error("Failed to load accounts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 过滤和排序账户
  const filteredAccounts = useMemo(() => {
    let filtered = [...accounts];

    // 搜索过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (acc) =>
          acc.nickname.toLowerCase().includes(query) ||
          acc.id.toLowerCase().includes(query) ||
          acc.server.toLowerCase().includes(query),
      );
    }

    // 排序：当前选中的置顶，然后按昵称排序
    filtered.sort((a, b) => {
      if (a.id === currentAccountId) return -1;
      if (b.id === currentAccountId) return 1;
      return a.nickname.localeCompare(b.nickname);
    });

    return filtered;
  }, [accounts, searchQuery, currentAccountId]);

  // 切换账户
  const handleSwitchAccount = async (accountId: string) => {
    if (accountId === currentAccountId) {
      onClose();
      return;
    }

    setSwitchingId(accountId);
    try {
      const success = await apiSetSelectedAccount(accountId);
      if (success) {
        // 触发自定义事件通知侧边栏更新
        window.dispatchEvent(new CustomEvent("accountChanged"));
        onClose();
      }
    } catch (error) {
      console.error("Failed to switch account:", error);
    } finally {
      setSwitchingId(null);
    }
  };

  return (
    <CustomModal isOpen={isOpen} onClose={onClose} size="lg">
      <CustomModalHeader onClose={onClose}>
        {i18n.language === "zh" ? "切换账户" : "Switch Account"}
      </CustomModalHeader>
      <CustomModalBody>
        {/* 搜索框 */}
        <div className="mb-4">
          <div className="bg-default-100 hover:bg-default-200 transition-colors rounded-lg h-10 flex items-center px-3 gap-2">
            <SearchIcon className="text-base text-muted pointer-events-none flex-shrink-0" />
            <input
              type="search"
              placeholder={
                i18n.language === "zh" ? "搜索账户..." : "Search accounts..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-sm w-full text-foreground placeholder:text-muted"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-muted hover:text-foreground transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* 账户列表 */}
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {isLoading ? (
            // 骨架屏 - 使用动态数量
            <>
              {[...Array(expectedAccountCount)].map((_, i) => (
                <Card key={i} className="p-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-12 h-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="w-32 h-4 rounded-lg" />
                      <Skeleton className="w-24 h-3 rounded-lg" />
                    </div>
                  </div>
                </Card>
              ))}
            </>
          ) : filteredAccounts.length === 0 ? (
            // 空状态
            <div className="text-center py-8">
              <SearchIcon className="w-12 h-12 mx-auto mb-3 text-muted opacity-50" />
              <p className="text-muted">
                {i18n.language === "zh" ? "未找到账户" : "No accounts found"}
              </p>
            </div>
          ) : (
            // 账户列表
            filteredAccounts.map((account) => {
              const isSelected = account.id === currentAccountId;
              const isSwitching = switchingId === account.id;

              return (
                <Card
                  key={account.id}
                  className={`p-3 cursor-pointer transition-all hover:shadow-md ${
                    isSelected
                      ? "border-2 border-primary bg-primary-50 dark:bg-primary-900/20"
                      : "border border-separator hover:border-content3/50"
                  }`}
                  onClick={() =>
                    !isSwitching && handleSwitchAccount(account.id)
                  }
                >
                  <div className="flex items-center gap-3">
                    {/* 头像 */}
                    <div className="relative flex-shrink-0">
                      <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-base font-bold text-primary overflow-hidden">
                        {account.avatar ? (
                          <img
                            src={account.avatar}
                            alt={account.nickname}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display =
                                "none";
                              (
                                e.target as HTMLImageElement
                              ).parentElement!.textContent = account.nickname
                                .charAt(0)
                                .toUpperCase();
                            }}
                          />
                        ) : (
                          account.nickname.charAt(0).toUpperCase()
                        )}
                      </div>
                      {/* ACTIVE 指示器 */}
                      {isSelected && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-success rounded-full border-2 border-background" />
                      )}
                    </div>

                    {/* 账户信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {account.nickname}
                        </p>
                        {isSelected && (
                          <span className="px-2 py-0.5 text-[10px] font-bold text-success bg-success/10 rounded">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted mt-0.5">
                        Lv.{account.level} •{" "}
                        {(() => {
                          const serverId = parseInt(account.server);
                          if (serverId === 1) {
                            return i18n.language === "zh" ? "官服" : "Official";
                          } else if (serverId === 2) {
                            return i18n.language === "zh"
                              ? "Bilibili服"
                              : "Bilibili";
                          }
                          return account.server;
                        })()}
                      </p>
                    </div>

                    {/* 切换指示器 */}
                    {isSwitching ? (
                      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    ) : !isSelected ? (
                      <div className="w-5 h-5 text-muted opacity-0 group-hover:opacity-100">
                        <svg
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                    ) : null}
                  </div>
                </Card>
              );
            })
          )}
        </div>

        {/* 底部提示 */}
        {!isLoading && filteredAccounts.length > 0 && (
          <div className="mt-4 pt-3 border-t border-separator text-xs text-muted text-center">
            {i18n.language === "zh"
              ? `共 ${filteredAccounts.length} 个账户`
              : `${filteredAccounts.length} accounts total`}
          </div>
        )}
      </CustomModalBody>
    </CustomModal>
  );
}
