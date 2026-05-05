import { Link, useLocation, useNavigate } from "react-router-dom";
import clsx from "clsx";
import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button, Kbd, Skeleton } from "@heroui/react";
import {
  HomeIcon,
  SettingsIcon,
  AccountIcon,
  GithubIcon,
  HeartFilledIcon,
  SearchIcon,
} from "@/components/icons";
import { siteConfig } from "@/config/site";
import { ThemeSwitch } from "@/components/theme-switch";
import { LanguageSwitch } from "@/components/language-switch";
import AccountSwitchModal from "./account-switch-modal";
import {
  getAccounts,
  getSelectedAccount,
  setSelectedAccount as apiSetSelectedAccount,
  Account,
} from "@/utils/accountService";
import { accountCache } from "@/utils/accountCache";
import { getConfig } from "@/utils/configService";

interface SearchResult {
  id: string;
  title: string;
  description?: string;
  path: string;
  category: string;
  elementId?: string; // DOM element ID for precise navigation
  // Multi-language content for cross-language search
  titleEn?: string;
  titleZh?: string;
  descriptionEn?: string;
  descriptionZh?: string;
  categoryEn?: string;
  categoryZh?: string;
  // Match information
  matchedLang?: "current" | "en" | "zh" | null;
  matchedText?: string;
}

export const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [themeChangeKey, setThemeChangeKey] = useState(0);
  const { t, i18n } = useTranslation();
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // 选中账户状态
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [isLoadingAccount, setIsLoadingAccount] = useState(true);
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);

  // 监听主题变化，强制重新渲染
  useEffect(() => {
    const handleThemeChange = () => {
      setThemeChangeKey((prev) => prev + 1);
    };

    window.addEventListener("themeChange", handleThemeChange);
    return () => {
      window.removeEventListener("themeChange", handleThemeChange);
    };
  }, []);

  // 加载选中的账户
  useEffect(() => {
    const loadSelectedAccount = async () => {
      try {
        setIsLoadingAccount(true);
        const selectedId = await getSelectedAccount();
        console.log("[Sidebar] Selected account ID:", selectedId);

        if (selectedId) {
          // 优先使用缓存
          let accounts = accountCache.getAllAccounts();

          if (!accounts || accounts.length === 0) {
            // 如果缓存为空，才从API获取
            console.log("[Sidebar] Cache is empty, fetching from API");
            accounts = await getAccounts();
            if (accounts && accounts.length > 0) {
              accountCache.cacheAccounts(accounts);
            }
          } else {
            console.log("[Sidebar] Using cached accounts");
          }

          console.log("[Sidebar] Loaded accounts:", accounts.length);
          const account = accounts.find((acc) => acc.id === selectedId);
          console.log("[Sidebar] Found account:", account?.nickname);
          setSelectedAccount(account || null);
        } else {
          console.log("[Sidebar] No selected account ID");
          setSelectedAccount(null);
        }
      } catch (error) {
        console.error("Failed to load selected account:", error);
      } finally {
        setIsLoadingAccount(false);
      }
    };

    loadSelectedAccount();

    // 监听账户变化事件（从Account页面切换时触发）
    const handleAccountChange = async () => {
      console.log("[Sidebar] Account changed event received");

      // 检查是否需要刷新数据
      const shouldRefresh = await getConfig<boolean>(
        "refresh_on_account_switch",
      );
      console.log("[Sidebar] Should refresh on switch:", shouldRefresh);

      if (shouldRefresh) {
        // 如果需要刷新，从API获取
        console.log("[Sidebar] Fetching accounts from API...");
        const accounts = await getAccounts();
        // 更新缓存
        if (accounts && accounts.length > 0) {
          accountCache.cacheAccounts(accounts);
        }

        // 重新加载选中账户
        const selectedId = await getSelectedAccount();
        if (selectedId) {
          const account = accounts.find((acc) => acc.id === selectedId);
          setSelectedAccount(account || null);
        }
      } else {
        // 如果不需要刷新，直接使用缓存
        console.log("[Sidebar] Using cached accounts");
        const accounts = accountCache.getAllAccounts();
        const selectedId = await getSelectedAccount();
        if (selectedId && accounts.length > 0) {
          const account = accounts.find((acc) => acc.id === selectedId);
          setSelectedAccount(account || null);
        }
      }
    };

    window.addEventListener("accountChanged", handleAccountChange);
    return () => {
      window.removeEventListener("accountChanged", handleAccountChange);
    };
  }, []);

  // Generate searchable content from all pages and navigation (with multi-language support)
  const getAllSearchableContent = useMemo(() => {
    return (): SearchResult[] => {
      return [
        // Navigation items
        {
          id: "nav-dashboard",
          title: t("sidebar.dashboard"),
          titleEn: "Dashboard",
          titleZh: "仪表板",
          description:
            i18n.language === "zh"
              ? "查看仪表板和统计数据"
              : "View dashboard and statistics",
          descriptionEn: "View dashboard and statistics",
          descriptionZh: "查看仪表板和统计数据",
          path: "/",
          elementId: "dashboard-header",
          category: i18n.language === "zh" ? "导航" : "Navigation",
          categoryEn: "Navigation",
          categoryZh: "导航",
        },
        {
          id: "nav-settings",
          title: t("sidebar.settings"),
          titleEn: "Settings",
          titleZh: "设置",
          description:
            i18n.language === "zh"
              ? "管理应用设置和偏好"
              : "Manage app settings and preferences",
          descriptionEn: "Manage app settings and preferences",
          descriptionZh: "管理应用设置和偏好",
          path: "/settings",
          category: i18n.language === "zh" ? "导航" : "Navigation",
          categoryEn: "Navigation",
          categoryZh: "导航",
        },
        {
          id: "nav-account",
          title: t("sidebar.account"),
          titleEn: "Account",
          titleZh: "账户",
          description:
            i18n.language === "zh"
              ? "管理您的登录账户"
              : "Manage your logged-in accounts",
          descriptionEn: "Manage your logged-in accounts",
          descriptionZh: "管理您的登录账户",
          path: "/account",
          category: i18n.language === "zh" ? "导航" : "Navigation",
          categoryEn: "Navigation",
          categoryZh: "导航",
        },

        // Dashboard page content
        {
          id: "dashboard-welcome",
          title: i18n.language === "zh" ? "欢迎信息" : "Welcome Message",
          titleEn: "Welcome Message",
          titleZh: "欢迎信息",
          description: t("common.welcome"),
          descriptionEn: "Welcome back! Here's what's happening.",
          descriptionZh: "欢迎回来！以下是最新动态。",
          path: "/",
          elementId: "dashboard-header",
          category: i18n.language === "zh" ? "仪表板" : "Dashboard",
          categoryEn: "Dashboard",
          categoryZh: "仪表板",
        },
        {
          id: "dashboard-stats-revenue",
          title: t("common.totalRevenue"),
          titleEn: "Total Revenue",
          titleZh: "总收入",
          description:
            i18n.language === "zh"
              ? "查看总收入统计"
              : "View total revenue statistics",
          descriptionEn: "View total revenue statistics",
          descriptionZh: "查看总收入统计",
          path: "/",
          elementId: "dashboard-stats",
          category: i18n.language === "zh" ? "统计" : "Statistics",
          categoryEn: "Statistics",
          categoryZh: "统计",
        },
        {
          id: "dashboard-stats-users",
          title: t("common.activeUsers"),
          titleEn: "Active Users",
          titleZh: "活跃用户",
          description:
            i18n.language === "zh"
              ? "查看活跃用户数据"
              : "View active user data",
          descriptionEn: "View active user data",
          descriptionZh: "查看活跃用户数据",
          path: "/",
          elementId: "dashboard-stats",
          category: i18n.language === "zh" ? "统计" : "Statistics",
          categoryEn: "Statistics",
          categoryZh: "统计",
        },
        {
          id: "dashboard-stats-sales",
          title: t("common.sales"),
          titleEn: "Sales",
          titleZh: "销售额",
          description:
            i18n.language === "zh" ? "查看销售数据" : "View sales data",
          descriptionEn: "View sales data",
          descriptionZh: "查看销售数据",
          path: "/",
          elementId: "dashboard-stats",
          category: i18n.language === "zh" ? "统计" : "Statistics",
          categoryEn: "Statistics",
          categoryZh: "统计",
        },
        {
          id: "dashboard-activity",
          title: t("common.recentActivity"),
          titleEn: "Recent Activity",
          titleZh: "最近活动",
          description:
            i18n.language === "zh"
              ? "查看最近的活动记录"
              : "View recent activity logs",
          descriptionEn: "View recent activity logs",
          descriptionZh: "查看最近的活动记录",
          path: "/",
          elementId: "dashboard-activity",
          category: i18n.language === "zh" ? "仪表板" : "Dashboard",
          categoryEn: "Dashboard",
          categoryZh: "仪表板",
        },
        {
          id: "dashboard-projects",
          title: t("common.recentProjects"),
          titleEn: "Recent Projects",
          titleZh: "最近项目",
          description:
            i18n.language === "zh"
              ? "查看最近的项目列表"
              : "View recent projects list",
          descriptionEn: "View recent projects list",
          descriptionZh: "查看最近的项目列表",
          path: "/",
          elementId: "dashboard-projects",
          category: i18n.language === "zh" ? "仪表板" : "Dashboard",
          categoryEn: "Dashboard",
          categoryZh: "仪表板",
        },
        {
          id: "dashboard-quick-actions",
          title: t("common.quickActions"),
          titleEn: "Quick Actions",
          titleZh: "快捷操作",
          description:
            i18n.language === "zh"
              ? "快速操作和快捷方式"
              : "Quick actions and shortcuts",
          descriptionEn: "Quick actions and shortcuts",
          descriptionZh: "快速操作和快捷方式",
          path: "/",
          elementId: "dashboard-quick-actions",
          category: i18n.language === "zh" ? "仪表板" : "Dashboard",
          categoryEn: "Dashboard",
          categoryZh: "仪表板",
        },
        {
          id: "dashboard-create-project",
          title: t("common.createProject"),
          titleEn: "Create Project",
          titleZh: "创建项目",
          description:
            i18n.language === "zh" ? "创建新项目" : "Create a new project",
          descriptionEn: "Create a new project",
          descriptionZh: "创建新项目",
          path: "/",
          category: i18n.language === "zh" ? "操作" : "Actions",
          categoryEn: "Actions",
          categoryZh: "操作",
        },
        {
          id: "dashboard-start-project",
          title: t("common.startNewProject"),
          titleEn: "Start New Project",
          titleZh: "开始新项目",
          description:
            i18n.language === "zh" ? "开始一个新项目" : "Start a new project",
          descriptionEn: "Start a new project",
          descriptionZh: "开始一个新项目",
          path: "/",
          category: i18n.language === "zh" ? "操作" : "Actions",
          categoryEn: "Actions",
          categoryZh: "操作",
        },
        {
          id: "dashboard-invite",
          title: t("common.inviteSomeone"),
          titleEn: "Invite Someone",
          titleZh: "邀请某人",
          description:
            i18n.language === "zh" ? "邀请团队成员" : "Invite team members",
          descriptionEn: "Invite team members",
          descriptionZh: "邀请团队成员",
          path: "/",
          category: i18n.language === "zh" ? "操作" : "Actions",
          categoryEn: "Actions",
          categoryZh: "操作",
        },
        {
          id: "dashboard-analytics",
          title: t("common.analyticsInsights"),
          titleEn: "Analytics & Insights",
          titleZh: "分析与洞察",
          description:
            i18n.language === "zh"
              ? "查看分析和洞察"
              : "View analytics and insights",
          descriptionEn: "View analytics and insights",
          descriptionZh: "查看分析和洞察",
          path: "/",
          category: i18n.language === "zh" ? "操作" : "Actions",
          categoryEn: "Actions",
          categoryZh: "操作",
        },

        // Settings page content
        {
          id: "settings-title",
          title: t("settings.title"),
          titleEn: "Settings",
          titleZh: "设置",
          description:
            i18n.language === "zh"
              ? "管理应用设置"
              : "Manage application settings",
          descriptionEn: "Manage application settings",
          descriptionZh: "管理应用设置",
          path: "/settings",
          elementId: "settings-general",
          category: i18n.language === "zh" ? "设置" : "Settings",
          categoryEn: "Settings",
          categoryZh: "设置",
        },
        {
          id: "settings-general",
          title: t("settings.general.title"),
          titleEn: "General Settings",
          titleZh: "通用设置",
          description:
            i18n.language === "zh"
              ? "通用设置配置"
              : "General settings configuration",
          descriptionEn: "General settings configuration",
          descriptionZh: "通用设置配置",
          path: "/settings",
          elementId: "settings-general",
          category: i18n.language === "zh" ? "设置" : "Settings",
          categoryEn: "Settings",
          categoryZh: "设置",
        },
        {
          id: "settings-language",
          title: t("settings.general.language"),
          titleEn: "Language",
          titleZh: "语言",
          description:
            i18n.language === "zh"
              ? "选择界面语言"
              : "Choose interface language",
          descriptionEn: "Choose interface language",
          descriptionZh: "选择界面语言",
          path: "/settings",
          elementId: "settings-language",
          category: i18n.language === "zh" ? "设置" : "Settings",
          categoryEn: "Settings",
          categoryZh: "设置",
        },
        {
          id: "settings-theme",
          title: t("settings.general.theme"),
          titleEn: "Theme",
          titleZh: "主题",
          description:
            i18n.language === "zh" ? "切换主题模式" : "Toggle theme mode",
          descriptionEn: "Toggle theme mode",
          descriptionZh: "切换主题模式",
          path: "/settings",
          elementId: "settings-theme",
          category: i18n.language === "zh" ? "设置" : "Settings",
          categoryEn: "Settings",
          categoryZh: "设置",
        },
      ];
    };
  }, [t, i18n.language]);

  // Filter search results with cross-language support
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const allContent = getAllSearchableContent();
    const query = searchQuery.toLowerCase();

    return allContent
      .filter((item) => {
        // Search in current language
        const currentLangMatch =
          item.title.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query);

        // Search in other languages
        const otherLangMatch =
          item.titleEn?.toLowerCase().includes(query) ||
          item.titleZh?.toLowerCase().includes(query) ||
          item.descriptionEn?.toLowerCase().includes(query) ||
          item.descriptionZh?.toLowerCase().includes(query) ||
          item.categoryEn?.toLowerCase().includes(query) ||
          item.categoryZh?.toLowerCase().includes(query);

        return currentLangMatch || otherLangMatch;
      })
      .map((item) => {
        // Determine which language matched
        let matchedLang: "current" | "en" | "zh" | null = null;
        let matchedText = "";

        if (
          item.title.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query)
        ) {
          matchedLang = "current";
        } else if (
          item.titleEn?.toLowerCase().includes(query) ||
          item.descriptionEn?.toLowerCase().includes(query) ||
          item.categoryEn?.toLowerCase().includes(query)
        ) {
          matchedLang = "en";
          // Find the matched text
          if (item.titleEn?.toLowerCase().includes(query))
            matchedText = item.titleEn;
          else if (item.descriptionEn?.toLowerCase().includes(query))
            matchedText = item.descriptionEn;
          else if (item.categoryEn?.toLowerCase().includes(query))
            matchedText = item.categoryEn;
        } else if (
          item.titleZh?.toLowerCase().includes(query) ||
          item.descriptionZh?.toLowerCase().includes(query) ||
          item.categoryZh?.toLowerCase().includes(query)
        ) {
          matchedLang = "zh";
          // Find the matched text
          if (item.titleZh?.toLowerCase().includes(query))
            matchedText = item.titleZh;
          else if (item.descriptionZh?.toLowerCase().includes(query))
            matchedText = item.descriptionZh;
          else if (item.categoryZh?.toLowerCase().includes(query))
            matchedText = item.categoryZh;
        }

        return {
          ...item,
          matchedLang,
          matchedText: matchedLang !== "current" ? matchedText : "",
        };
      });
  }, [searchQuery, getAllSearchableContent]);

  // Keyboard shortcut for search (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    };

    if (showResults) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showResults]);

  // Handle keyboard navigation in search results
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showResults || searchResults.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          Math.min(prev + 1, searchResults.length - 1),
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, -1));
      } else if (e.key === "Enter" && selectedIndex >= 0) {
        e.preventDefault();
        handleSelectResult(searchResults[selectedIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setShowResults(false);
        inputRef.current?.blur();
      }
    };

    if (showResults) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showResults, selectedIndex, searchResults]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && resultsRef.current) {
      const selectedElement = resultsRef.current.children[selectedIndex];
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: "nearest",
          behavior: "smooth",
        });
      }
    }
  }, [selectedIndex]);

  const handleSelectResult = (result: SearchResult) => {
    // Navigate to the page
    navigate(result.path);

    // Clear search state
    setSearchQuery("");
    setShowResults(false);
    setSelectedIndex(-1);

    // Scroll to specific element if elementId is provided
    if (result.elementId) {
      // Wait for navigation to complete, then scroll to element
      setTimeout(() => {
        const element = document.getElementById(result.elementId!);
        if (element) {
          // Smooth scroll to the element with offset for header
          const offset = 80; // Account for fixed header
          const elementPosition =
            element.getBoundingClientRect().top + window.pageYOffset;
          const offsetPosition = elementPosition - offset;

          window.scrollTo({
            top: offsetPosition,
            behavior: "smooth",
          });

          // Add a highlight effect
          element.classList.add("animate-pulse");
          element.style.transition = "all 0.3s ease";
          element.style.boxShadow =
            "0 0 0 3px rgb(var(--heroui-primary) / 0.3)";

          // Remove highlight after animation
          setTimeout(() => {
            element.classList.remove("animate-pulse");
            element.style.boxShadow = "";
          }, 2000);
        }
      }, 100); // Small delay to ensure DOM is updated after navigation
    }
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;

    const regex = new RegExp(
      `(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
      "gi",
    );
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark
          key={index}
          className="bg-primary/20 text-primary font-semibold px-0.5 rounded"
        >
          {part}
        </mark>
      ) : (
        part
      ),
    );
  };

  const sidebarItems = [
    {
      label: t("sidebar.dashboard"),
      href: "/",
      icon: HomeIcon,
    },
  ];

  const bottomItems = [
    {
      label: t("sidebar.account"),
      href: "/account",
      icon: AccountIcon,
    },
    {
      label: t("sidebar.settings"),
      href: "/settings",
      icon: SettingsIcon,
    },
  ];

  return (
    <>
      {/* Mobile menu button */}
      <button
        className="lg:hidden fixed bottom-4 right-4 z-50 p-3 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-shadow"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        aria-label="Toggle menu"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {isMobileMenuOpen ? (
            <path
              d="M6 18L18 6M6 6l12 12"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
            />
          ) : (
            <path
              d="M4 6h16M4 12h16M4 18h16"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
            />
          )}
        </svg>
      </button>

      {/* Sidebar */}
      <aside
        key={themeChangeKey}
        className={clsx(
          "fixed lg:static inset-y-0 left-0 z-40 w-72 bg-background border-r border-separator transform transition-transform duration-300 ease-in-out flex flex-col",
          isMobileMenuOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0",
        )}
      >
        {/* Selected Account Display */}
        <div className="px-4 py-3 border-b border-separator">
          {isLoadingAccount ? (
            // 骨架屏加载状态
            <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-default-100 transition-colors cursor-pointer">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="w-24 h-4 rounded-lg" />
                <Skeleton className="w-16 h-3 rounded-lg" />
              </div>
            </div>
          ) : selectedAccount ? (
            // 显示选中的账户信息
            <div className="flex items-center gap-3 p-2 rounded-lg">
              {/* 左侧：头像和信息（不可点击） */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-sm font-bold text-primary overflow-hidden">
                    {selectedAccount.avatar ? (
                      <img
                        src={selectedAccount.avatar}
                        alt={selectedAccount.nickname}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                          (
                            e.target as HTMLImageElement
                          ).parentElement!.textContent =
                            selectedAccount.nickname.charAt(0).toUpperCase();
                        }}
                      />
                    ) : (
                      selectedAccount.nickname.charAt(0).toUpperCase()
                    )}
                  </div>
                  {/* ACTIVE 指示器 */}
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-success rounded-full border-2 border-background" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {selectedAccount.nickname}
                  </p>
                  <p className="text-xs text-muted truncate">
                    Lv.{selectedAccount.level} •{" "}
                    {(() => {
                      const serverId = parseInt(selectedAccount.server);
                      if (serverId === 1) {
                        return i18n.language === "zh" ? "官服" : "Official";
                      } else if (serverId === 2) {
                        return i18n.language === "zh"
                          ? "Bilibili服"
                          : "Bilibili";
                      }
                      return selectedAccount.server;
                    })()}
                  </p>
                </div>
              </div>

              {/* 右侧：切换按钮 */}
              <button
                onClick={() => {
                  setIsSwitchModalOpen(true);
                }}
                className="p-2 hover:bg-default-100 rounded-lg transition-colors flex-shrink-0"
                title={i18n.language === "zh" ? "切换账户" : "Switch Account"}
              >
                <svg
                  className="w-5 h-5 text-muted hover:text-foreground transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                  />
                </svg>
              </button>
            </div>
          ) : (
            // 没有选中账户时显示提示
            <div className="flex items-center gap-3 p-2 rounded-lg bg-default-50 border border-dashed border-separator">
              <div className="w-10 h-10 rounded-full bg-muted/20 flex items-center justify-center">
                <AccountIcon className="w-5 h-5 text-muted" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted">
                  {i18n.language === "zh"
                    ? "未选择账户"
                    : "No account selected"}
                </p>
                <p className="text-xs text-muted/70">
                  {i18n.language === "zh"
                    ? "前往账户页面选择"
                    : "Go to Account page"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Search Section - Hidden */}
        {false && (
          <div className="px-4 py-4" ref={searchRef}>
            <div className="relative">
              <div className="bg-default-100 hover:bg-default-200 transition-colors rounded-lg h-9 flex items-center px-3 gap-2">
                <SearchIcon className="text-base text-muted pointer-events-none flex-shrink-0" />
                <input
                  ref={inputRef}
                  type="search"
                  placeholder={t("common.search")}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowResults(true);
                    setSelectedIndex(-1);
                  }}
                  onFocus={() => searchQuery.trim() && setShowResults(true)}
                  className="bg-transparent border-none outline-none text-sm w-full text-foreground placeholder:text-muted"
                  aria-label="Search"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setShowResults(false);
                      setSelectedIndex(-1);
                    }}
                    className="text-muted hover:text-foreground transition-colors"
                    aria-label="Clear search"
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
                {!searchQuery && (
                  <Kbd className="hidden lg:inline-flex text-xs">
                    <Kbd.Abbr keyValue="command" />
                    <Kbd.Content>K</Kbd.Content>
                  </Kbd>
                )}
              </div>

              {/* Search Results Dropdown */}
              {showResults && searchQuery.trim() && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-background border-2 border-separator rounded-lg shadow-2xl z-50 max-h-[400px] overflow-y-auto">
                  {searchResults.length === 0 ? (
                    <div className="py-6 text-center">
                      <SearchIcon className="w-8 h-8 text-muted mx-auto mb-2 opacity-50" />
                      <p className="text-sm text-muted">
                        {i18n.language === "zh"
                          ? "未找到结果"
                          : "No results found"}
                      </p>
                    </div>
                  ) : (
                    <div ref={resultsRef}>
                      {/* Group results by category */}
                      {Object.entries(
                        searchResults.reduce(
                          (groups, result) => {
                            const category = result.category;
                            if (!groups[category]) {
                              groups[category] = [];
                            }
                            groups[category].push(result);
                            return groups;
                          },
                          {} as Record<string, SearchResult[]>,
                        ),
                      ).map(([category, items]) => (
                        <div key={category}>
                          <div className="px-3 py-2 text-xs font-semibold text-muted uppercase tracking-wider bg-default-100 border-b border-separator">
                            {category}
                          </div>
                          {items.map((result) => {
                            const globalIndex = searchResults.findIndex(
                              (r) => r.id === result.id,
                            );
                            const isSelected = globalIndex === selectedIndex;

                            return (
                              <button
                                key={result.id}
                                className={`w-full px-3 py-2.5 flex items-start gap-3 transition-colors text-left border-b border-separator last:border-b-0 ${
                                  isSelected
                                    ? "bg-primary/20"
                                    : "hover:bg-default-50"
                                }`}
                                onClick={() => handleSelectResult(result)}
                                onMouseEnter={() =>
                                  setSelectedIndex(globalIndex)
                                }
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-foreground text-sm truncate">
                                      {highlightMatch(
                                        result.title,
                                        searchQuery,
                                      )}
                                    </span>
                                    {/* Show language badge if matched in other language */}
                                    {result.matchedLang &&
                                      result.matchedLang !== "current" && (
                                        <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-warning/20 text-warning border border-warning/30 flex-shrink-0">
                                          {result.matchedLang === "en"
                                            ? "EN"
                                            : "中文"}
                                        </span>
                                      )}
                                  </div>
                                  {result.description && (
                                    <p className="text-xs text-muted mt-0.5 line-clamp-1">
                                      {highlightMatch(
                                        result.description,
                                        searchQuery,
                                      )}
                                    </p>
                                  )}
                                  {/* Show matched text from other language */}
                                  {result.matchedLang &&
                                    result.matchedLang !== "current" &&
                                    result.matchedText && (
                                      <p className="text-xs mt-1 px-2 py-1 bg-warning/10 border border-warning/20 rounded">
                                        <span className="text-warning font-medium mr-1">
                                          {i18n.language === "zh"
                                            ? "匹配:"
                                            : "Match:"}
                                        </span>
                                        <mark className="bg-warning/30 text-warning-dark px-0.5 rounded">
                                          {highlightMatch(
                                            result.matchedText,
                                            searchQuery,
                                          )}
                                        </mark>
                                      </p>
                                    )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Footer with keyboard shortcuts */}
                  <div className="border-t-2 border-separator px-3 py-2 flex items-center justify-between text-xs text-muted bg-default-50">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <Kbd className="text-xs">↑</Kbd>
                        <Kbd className="text-xs">↓</Kbd>
                        <span>
                          {i18n.language === "zh" ? "导航" : "Navigate"}
                        </span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Kbd className="text-xs">↵</Kbd>
                        <span>
                          {i18n.language === "zh" ? "选择" : "Select"}
                        </span>
                      </span>
                    </div>
                    <span>
                      {searchResults.length}{" "}
                      {i18n.language === "zh" ? "个结果" : "results"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Navigation */}
        <nav className="flex-1 overflow-y-auto px-4">
          <div className="space-y-1 py-1">
            {sidebarItems.map((item) => {
              const isActive = location.pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={clsx(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md dark:bg-[#1f1f1f] dark:text-foreground dark:shadow-[inset_0_2px_3px_rgba(0,0,0,0.3),0_1px_0_rgba(255,255,255,0.12)]"
                      : "text-foreground hover:bg-default-100 hover:translate-x-1",
                  )}
                >
                  <Icon
                    className={clsx(
                      "w-5 h-5 transition-transform duration-200",
                      isActive ? "scale-110" : "group-hover:scale-110",
                    )}
                  />
                  <span className="text-sm font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Footer Section */}
        <div className="px-4 py-4 space-y-3">
          <div className="h-px bg-separator my-2" />

          {/* Bottom Navigation */}
          <div className="space-y-1 py-1">
            {bottomItems.map((item) => {
              const isActive = location.pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={clsx(
                    "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group relative",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md dark:bg-[#1f1f1f] dark:text-foreground dark:shadow-[inset_0_2px_3px_rgba(0,0,0,0.3),0_1px_0_rgba(255,255,255,0.12)]"
                      : "text-foreground hover:bg-default-100 hover:translate-x-1",
                  )}
                >
                  <Icon
                    className={clsx(
                      "w-5 h-5 transition-transform duration-200",
                      isActive ? "scale-110" : "group-hover:scale-110",
                    )}
                  />
                  <span className="text-sm font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="h-px bg-separator my-2" />

          {/* Quick Actions */}
          <div className="space-y-3">
            {/* Social and Settings Row */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <a
                  aria-label="Github"
                  href={siteConfig.links.github}
                  rel="noopener noreferrer"
                  target="_blank"
                  className="p-2 rounded-lg hover:bg-default-100 transition-colors"
                >
                  <GithubIcon className="text-muted w-5 h-5 hover:text-foreground transition-colors" />
                </a>
                <ThemeSwitch />
                <LanguageSwitch />
              </div>
            </div>

            {/* Sponsor Button */}
            <Button
              className="w-full font-medium"
              variant="danger-soft"
              onPress={() => window.open(siteConfig.links.sponsor, "_blank")}
            >
              <HeartFilledIcon className="w-4 h-4 mr-2" />
              {t("common.sponsor")}
            </Button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isMobileMenuOpen && (
        <button
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 lg:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-label="Close menu"
        />
      )}

      {/* Account Switch Modal */}
      <AccountSwitchModal
        isOpen={isSwitchModalOpen}
        onClose={() => setIsSwitchModalOpen(false)}
        currentAccountId={selectedAccount?.id}
      />
    </>
  );
};
