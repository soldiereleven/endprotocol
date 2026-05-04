import { useTranslation } from "react-i18next";
import {
  Card,
  Button,
  Skeleton,
  Alert,
  Checkbox,
  Pagination,
} from "@heroui/react";
import { SimplePagination } from "@/components/simple-pagination";
import { useState, useEffect, useRef } from "react";
import {
  CustomModal,
  CustomModalHeader,
  CustomModalBody,
  CustomModalFooter,
} from "@/components/custom-modal";
import {
  getAccounts,
  refreshAccountData,
  logoutAccount as apiLogoutAccount,
  addAccount,
  sendVerificationCode,
  addAccountByCode,
  saveSelectedRoles,
  Account,
  LoginResult,
  RoleDisplayInfo,
} from "@/utils/accountService";

export default function AccountPage() {
  const { t, i18n } = useTranslation();

  // 状态管理
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currentAccountId, setCurrentAccountId] = useState<string | null>(null); // 当前选中的账户ID
  const [previousAccountId, setPreviousAccountId] = useState<string | null>(
    null,
  ); // 上一个选中的账户ID
  const [isAnimating, setIsAnimating] = useState(false); // 是否正在播放动画
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 添加账户相关状态
  type LoginMethod = "phone" | "qrcode" | null;
  const [loginMethod, setLoginMethod] = useState<LoginMethod>(null);
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string>("");
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [codeSentSuccess, setCodeSentSuccess] = useState(false);

  // 角色选择状态
  const [availableRoles, setAvailableRoles] = useState<RoleDisplayInfo[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [loginCred, setLoginCred] = useState("");
  const [loginToken, setLoginToken] = useState("");
  const [loginUserId, setLoginUserId] = useState("");

  // 全局 Alert 状态（在主页面显示）
  const [globalAlert, setGlobalAlert] = useState<{
    type: "success" | "danger";
    message: string;
  } | null>(null);

  // 从 C# 端获取账户数据
  useEffect(() => {
    const loadAccounts = async () => {
      setIsLoading(true);

      try {
        const accounts = await getAccounts();

        // 直接使用后端返回的数据（无论是否为空）
        setAccounts(accounts || []);

        // 如果有账户且没有选中任何账户，默认选中第一个
        if (accounts && accounts.length > 0 && !currentAccountId) {
          setCurrentAccountId(accounts[0].id);
        }

        // 如果只有一个账户，自动设置为 ACTIVE
        if (accounts && accounts.length === 1) {
          setCurrentAccountId(accounts[0].id);
        }

        setLastRefreshTime(new Date());
      } catch (error) {
        console.error("Failed to load accounts:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAccounts();

    // 设置定时刷新（每5分钟）
    const interval = setInterval(
      () => {
        refreshData();
      },
      5 * 60 * 1000,
    );

    return () => clearInterval(interval);
  }, []);

  // 刷新数据函数
  const refreshData = async () => {
    setIsRefreshing(true);

    try {
      const result = await refreshAccountData();

      if (result.success && result.accounts) {
        setAccounts(result.accounts);
        setLastRefreshTime(new Date(result.refreshTime));
      }
    } catch (error) {
      console.error("Failed to refresh data:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // 处理登出
  const handleLogout = async (accountId: string) => {
    try {
      const success = await apiLogoutAccount(accountId);

      if (success) {
        // 从列表中移除
        setAccounts((prev) => prev.filter((acc) => acc.id !== accountId));

        // 显示成功提示
        setGlobalAlert({
          type: "success",
          message: i18n.language === "zh" ? "登出成功" : "Logout successful",
        });
        setTimeout(() => setGlobalAlert(null), 3000);
      } else {
        setGlobalAlert({
          type: "danger",
          message: i18n.language === "zh" ? "登出失败" : "Logout failed",
        });
        setTimeout(() => setGlobalAlert(null), 3000);
      }
    } catch (error) {
      console.error("Failed to logout:", error);
      setGlobalAlert({
        type: "danger",
        message:
          i18n.language === "zh"
            ? `登出错误: ${error}`
            : `Logout error: ${error}`,
      });
      setTimeout(() => setGlobalAlert(null), 3000);
    }
  };

  // 查看详情
  const handleViewDetails = (account: Account) => {
    setSelectedAccount(account);
    setIsDetailsModalOpen(true);
  };

  // 打开添加账户 Modal
  const handleOpenAddModal = () => {
    setLoginMethod(null);
    setPhone("");
    setPassword("");
    setVerificationCode("");
    setLoginError("");
    setCodeSentSuccess(false);
    setCountdown(0);
    setIsAddModalOpen(true);
  };

  // 关闭添加账户 Modal
  const handleCloseAddModal = () => {
    setLoginMethod(null);
    setPhone("");
    setPassword("");
    setVerificationCode("");
    setLoginError("");
    setCodeSentSuccess(false);
    setCountdown(0);
    // 清除角色选择状态 - 放弃这次登录
    setAvailableRoles([]);
    setSelectedRoles([]);
    setLoginCred("");
    setLoginToken("");
    setLoginUserId("");
    setIsAddModalOpen(false);
  };

  // 发送验证码
  const handleSendCode = async () => {
    if (!phone) {
      setPhoneError(
        i18n.language === "zh" ? "请输入手机号" : "Please enter phone number",
      );
      return;
    }

    // 校验手机号格式（11位数字）
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      setPhoneError(
        i18n.language === "zh"
          ? "请输入有效的11位手机号"
          : "Please enter a valid 11-digit phone number",
      );
      return;
    }

    setPhoneError(""); // 清除错误
    setIsSendingCode(true);
    setLoginError("");
    setCodeSentSuccess(false);

    try {
      const success = await sendVerificationCode({ phone, type: 2 });

      if (success) {
        // 开始倒计时
        setCountdown(60);
        const timer = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        // 显示成功提示
        console.log("验证码发送成功，设置 codeSentSuccess 为 true");
        setCodeSentSuccess(true);
      } else {
        setLoginError(
          i18n.language === "zh"
            ? "发送验证码失败，请重试"
            : "Failed to send verification code",
        );
      }
    } catch (error) {
      console.error("Send code error:", error);
      setLoginError(
        i18n.language === "zh" ? "发送验证码出错" : "Error sending code",
      );
    } finally {
      setIsSendingCode(false);
    }
  };

  // 处理登录
  const handleLogin = async () => {
    if (loginMethod === "phone") {
      // 密码登录
      if (!phone || !password) {
        if (!phone) {
          setPhoneError(
            i18n.language === "zh"
              ? "请输入手机号"
              : "Please enter phone number",
          );
        }
        setLoginError(
          i18n.language === "zh"
            ? "请输入手机号和密码"
            : "Please enter phone and password",
        );
        return;
      }

      // 校验手机号格式（11位数字）
      const phoneRegex = /^1[3-9]\d{9}$/;
      if (!phoneRegex.test(phone)) {
        setPhoneError(
          i18n.language === "zh"
            ? "请输入有效的11位手机号"
            : "Please enter a valid 11-digit phone number",
        );
        return;
      }
    } else if (loginMethod === "qrcode") {
      // 验证码登录
      if (!phone || !verificationCode) {
        if (!phone) {
          setPhoneError(
            i18n.language === "zh"
              ? "请输入手机号"
              : "Please enter phone number",
          );
        }
        setLoginError(
          i18n.language === "zh"
            ? "请输入手机号和验证码"
            : "Please enter phone and verification code",
        );
        return;
      }

      // 校验手机号格式（11位数字）
      const phoneRegex = /^1[3-9]\d{9}$/;
      if (!phoneRegex.test(phone)) {
        setPhoneError(
          i18n.language === "zh"
            ? "请输入有效的11位手机号"
            : "Please enter a valid 11-digit phone number",
        );
        return;
      }
    }

    setPhoneError(""); // 清除错误
    setIsLoggingIn(true);
    setLoginError("");

    try {
      let result: LoginResult;

      if (loginMethod === "phone") {
        // 密码登录
        result = await addAccount({ phone, password });
      } else {
        // 验证码登录
        result = await addAccountByCode({ phone, code: verificationCode });
      }

      // 调试：打印完整结果
      console.log("Login result:", result);
      console.log("result.success:", result.success);
      console.log("result.account:", result.account);
      console.log("result.availableRoles:", result.availableRoles);

      if (result.success && result.account) {
        // 登录成功

        // 刷新账户列表
        const accounts = await getAccounts();
        setAccounts(accounts || []);

        // 关闭 Modal
        handleCloseAddModal();

        // 显示全局成功提示
        setGlobalAlert({
          type: "success",
          message:
            i18n.language === "zh"
              ? `登录成功！欢迎，${result.account.nickname}`
              : `Login successful! Welcome, ${result.account.nickname}`,
        });

        // 5秒后自动清除 Alert
        setTimeout(() => {
          setGlobalAlert(null);
        }, 5000);
      } else if (
        result.success &&
        result.availableRoles &&
        result.availableRoles.length > 0
      ) {
        // 需要选择角色 - 直接在当前 Modal 中显示
        setAvailableRoles(result.availableRoles);
        setLoginCred(result.cred || "");
        setLoginToken(result.token || "");
        setLoginUserId(result.userId || "");
        setSelectedRoles([]); // 重置选择
      } else {
        setLoginError(
          result.errorMessage ||
            (i18n.language === "zh"
              ? "登录失败，请重试"
              : "Login failed, please try again"),
        );
      }
    } catch (error) {
      console.error("Login error:", error);
      setLoginError(
        i18n.language === "zh" ? "登录过程中发生错误" : "Error during login",
      );
    } finally {
      setIsLoggingIn(false);
    }
  };

  // 处理角色选择成功
  const handleConfirmRoles = async () => {
    if (selectedRoles.length === 0) {
      setLoginError(
        i18n.language === "zh"
          ? "请至少选择一个角色"
          : "Please select at least one role",
      );
      return;
    }

    setIsLoading(true);
    try {
      // 获取选中角色的完整信息
      const selectedRoleDetails = availableRoles.filter((role) =>
        selectedRoles.includes(role.roleId),
      );

      // 调用后端保存
      await saveSelectedRoles(
        loginCred,
        loginToken,
        loginUserId,
        selectedRoleDetails,
      );

      // 刷新账户列表
      const accounts = await getAccounts();
      setAccounts(accounts || []);

      // 关闭模态并清空表单
      handleCloseAddModal();

      setGlobalAlert({
        type: "success",
        message:
          i18n.language === "zh" ? "角色绑定成功" : "Roles bound successfully",
      });
      setTimeout(() => setGlobalAlert(null), 5000);
    } catch (error) {
      console.error("Failed to save roles:", error);
      setLoginError(
        i18n.language === "zh" ? `保存失败: ${error}` : `Save failed: ${error}`,
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 切换角色选择
  const handleRoleToggle = (roleId: string) => {
    setSelectedRoles((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId],
    );
  };

  // 选中账户
  const handleSelectAccount = (accountId: string) => {
    if (accountId === currentAccountId) return; // 如果点击的是当前选中的，不做任何操作

    setPreviousAccountId(currentAccountId); // 记录上一个选中的账户
    setIsAnimating(true); // 开始动画
    setCurrentAccountId(accountId);

    // 动画结束后重置状态
    setTimeout(() => {
      setIsAnimating(false);
      setPreviousAccountId(null);
    }, 300); // 与动画时长一致
  };

  // 获取排序后的账户列表（选中的置顶，其余按字典序）
  const getSortedAccounts = (): Account[] => {
    const sorted = [...accounts];

    // 找到当前选中的账户
    const selectedIndex = sorted.findIndex(
      (acc) => acc.id === currentAccountId,
    );
    if (selectedIndex > 0) {
      // 将选中的账户移到第一位
      const [selected] = sorted.splice(selectedIndex, 1);
      sorted.unshift(selected);
    }

    // 对未选中的账户按nickname字典序排序
    if (sorted.length > 1) {
      const selectedAccount = sorted[0];
      const unsortedAccounts = sorted.slice(1);
      unsortedAccounts.sort((a, b) => a.nickname.localeCompare(b.nickname));
      return [selectedAccount, ...unsortedAccounts];
    }

    return sorted;
  };

  const sortedAccounts = getSortedAccounts();

  // 分页相关状态
  const [currentPage, setCurrentPage] = useState(1);
  const CARD_HEIGHT = 80; // 固定卡片高度（像素）- 缩小
  const CONTAINER_HEIGHT = 400; // 容器高度（像素）
  const CONTAINER_PADDING = 15; // 上下间隙
  const GAP_SIZE = 5; // 卡片间距（像素）- 缩小
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // 固定显示 5 个 card 的高度（业务要求）
  const FIXED_ITEMS_PER_PAGE = 5;
  const itemsPerPage = FIXED_ITEMS_PER_PAGE;

  // 获取当前页的账户
  const getCurrentPageAccounts = (): Account[] => {
    if (accounts.length === 0) return [];
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedAccounts.slice(startIndex, endIndex);
  };

  const totalPages = Math.ceil(accounts.length / itemsPerPage);
  const currentPageAccounts = getCurrentPageAccounts();

  // 当账户列表变化时，重置到第一页
  useEffect(() => {
    setCurrentPage(1);
  }, [accounts.length]);

  // 不再使用 ResizeObserver - 固定每页5个

  // 渲染骨架屏
  const renderSkeleton = () => (
    <div className="space-y-4">
      {[1, 2, 3].map((item) => (
        <Card key={item} className="p-4 bg-content1">
          <div className="flex items-center gap-4">
            <Skeleton className="w-12 h-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="w-32 h-4 rounded-lg" />
              <Skeleton className="w-24 h-3 rounded-lg" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="w-20 h-8 rounded-lg" />
              <Skeleton className="w-20 h-8 rounded-lg" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 relative">
      {/* 全局 Alert - 浮动覆盖 */}
      {globalAlert && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-slide-down">
          <Alert
            status={globalAlert.type}
            className="shadow-lg min-w-[300px] max-w-[500px]"
          >
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>{globalAlert.message}</Alert.Description>
            </Alert.Content>
          </Alert>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
            {t("settings.account.title")}
          </h1>
          <p className="text-muted mt-1">{t("settings.account.subtitle")}</p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onPress={refreshData}
            isDisabled={isRefreshing}
          >
            {isRefreshing
              ? t("settings.account.refreshing")
              : t("settings.account.refresh_data")}
          </Button>
          <Button variant="primary" onPress={handleOpenAddModal}>
            {t("settings.account.add_account")}
          </Button>
        </div>
      </div>

      {/* Last refresh time */}
      {lastRefreshTime && (
        <div className="text-sm text-muted">
          {t("settings.account.last_refresh")}:{" "}
          {lastRefreshTime.toLocaleString(
            i18n.language === "zh" ? "zh-CN" : "en-US",
          )}
        </div>
      )}

      {/* Accounts List */}
      {isLoading ? (
        renderSkeleton()
      ) : accounts.length === 0 ? (
        <Card
          className="p-12 bg-content1 shadow-md border border-separator"
          style={{ minHeight: `${CONTAINER_HEIGHT}px` }}
        >
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
              {t("settings.account.no_accounts")}
            </p>
            <p className="text-sm text-muted mt-2">
              {i18n.language === "zh"
                ? "点击右上角添加账户开始使用"
                : "Click the button above to add an account"}
            </p>
          </div>
        </Card>
      ) : (
        <div
          className="flex flex-col flex-1"
          style={{ minHeight: `${CONTAINER_HEIGHT + 60}px` }}
        >
          {/* 账户卡片区域 - 固定高度，带外框，占满空间 */}
          <Card className="shadow-sm border-2 border-separator flex-1 p-0 flex flex-col">
            <div
              className="relative overflow-hidden"
              style={{ height: `${CONTAINER_HEIGHT}px` }}
            >
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-[15px] py-[15px] space-y-[5px] box-border"
                style={{ scrollbarWidth: "thin" }}
              >
                {currentPageAccounts.map((account, index) => {
                  const isSelected = account.id === currentAccountId;
                  const isPreviousActive = account.id === previousAccountId;

                  // 计算动画类型
                  let animationClass = "";
                  let zIndex = 0;

                  if (isAnimating) {
                    if (isSelected) {
                      animationClass = "animate-fade-in";
                      zIndex = 30;
                    } else if (isPreviousActive) {
                      animationClass = "animate-fade-out";
                      zIndex = 20;
                    }
                  } else {
                    animationClass = "animate-fade-in";
                  }

                  return (
                    <Card
                      key={account.id}
                      className={`cursor-pointer transition-all duration-300 ease-in-out ${
                        isSelected
                          ? "bg-content1 shadow-xl border-2 border-green-400 dark:border-green-300 box-border"
                          : "bg-content1 shadow-md border-2 border-separator hover:shadow-lg hover:border-content3/50 box-border"
                      } ${animationClass}`}
                      style={{
                        height: `${CARD_HEIGHT}px`,
                        position: isAnimating ? "relative" : "static",
                        zIndex,
                      }}
                      onClick={() => handleSelectAccount(account.id)}
                    >
                      <div className="flex items-center h-full px-3">
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-3 flex-1">
                            {/* LED 指示灯 */}
                            {isSelected && (
                              <div className="relative flex-shrink-0">
                                <div className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] dark:shadow-[0_0_10px_rgba(34,197,94,0.8)]" />
                                <div className="absolute inset-0 w-3 h-3 rounded-full bg-green-400 animate-ping opacity-20" />
                              </div>
                            )}

                            {/* Avatar */}
                            <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-base font-bold text-primary flex-shrink-0 overflow-hidden">
                              {account.avatar ? (
                                <img
                                  src={account.avatar}
                                  alt={account.nickname}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (
                                      e.target as HTMLImageElement
                                    ).style.display = "none";
                                    const parent = (
                                      e.target as HTMLImageElement
                                    ).parentElement;
                                    if (parent) {
                                      parent.textContent = account.nickname
                                        .charAt(0)
                                        .toUpperCase();
                                    }
                                  }}
                                />
                              ) : (
                                account.nickname.charAt(0).toUpperCase()
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">
                                {account.nickname}
                              </p>
                              <p className="text-xs text-muted">
                                {i18n.language === "zh" ? "等级" : "Level"}:{" "}
                                {account.level} •{" "}
                                {account.server === "1"
                                  ? i18n.language === "zh"
                                    ? "官服"
                                    : "Official"
                                  : account.server === "2"
                                    ? i18n.language === "zh"
                                      ? "BiliBili服"
                                      : "BiliBili"
                                    : account.server}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            {isSelected && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold text-green-600 dark:text-green-400 tracking-wider">
                                ACTIVE
                              </span>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onPress={() => handleViewDetails(account)}
                              className="!h-7 !px-2 text-xs"
                            >
                              {t("settings.account.view_details")}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onPress={() => handleLogout(account.id)}
                              className="text-danger border-danger hover:bg-danger-50 !h-7 !px-2 text-xs"
                            >
                              {t("settings.account.logout")}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Card footer: pagination (HeroUI) */}
            <div className="border-t border-separator px-3 py-3 w-full">
              <div className="flex items-center justify-center w-full gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  isDisabled={currentPage === 1}
                  onPress={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  className="flex items-center gap-2"
                >
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  {t("common.pagination.previous")}
                </Button>

                <div className="flex items-center">
                  <SimplePagination
                    total={Math.max(1, totalPages)}
                    page={currentPage}
                    onChange={setCurrentPage}
                    showControls={false}
                  />
                  {/* keep HeroUI Pagination for compatibility (visually hidden) */}
                  <div className="sr-only">
                    <Pagination
                      total={Math.max(1, totalPages)}
                      page={currentPage}
                      onChange={setCurrentPage}
                      size="sm"
                      isDisabled={false}
                      showControls={true}
                    />
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  isDisabled={currentPage >= totalPages}
                  onPress={() =>
                    setCurrentPage(Math.min(totalPages, currentPage + 1))
                  }
                  className="flex items-center gap-2"
                >
                  {t("common.pagination.next")}
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Account Details Modal */}
      <CustomModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        size="md"
      >
        <CustomModalHeader onClose={() => setIsDetailsModalOpen(false)}>
          {t("settings.account.account_details")}
        </CustomModalHeader>
        <CustomModalBody>
          {selectedAccount && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-2xl font-bold text-primary overflow-hidden">
                  {selectedAccount.avatar ? (
                    <img
                      src={selectedAccount.avatar}
                      alt={selectedAccount.nickname}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                        const parent = (e.target as HTMLImageElement)
                          .parentElement;
                        if (parent) {
                          parent.textContent = selectedAccount.nickname
                            .charAt(0)
                            .toUpperCase();
                        }
                      }}
                    />
                  ) : (
                    selectedAccount.nickname.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <p className="text-xl font-semibold text-foreground">
                    {selectedAccount.nickname}
                  </p>
                  <p className="text-sm text-muted">ID: {selectedAccount.id}</p>
                </div>
              </div>

              <div className="border-t border-separator my-4" />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted mb-1">
                    {i18n.language === "zh" ? "等级" : "Level"}
                  </p>
                  <p className="text-base font-medium text-foreground">
                    Lv.{selectedAccount.level}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted mb-1">
                    {i18n.language === "zh" ? "服务器" : "Server"}
                  </p>
                  <p className="text-base font-medium text-foreground">
                    {selectedAccount.server === "1"
                      ? i18n.language === "zh"
                        ? "官服"
                        : "Official"
                      : selectedAccount.server === "2"
                        ? i18n.language === "zh"
                          ? "BiliBili服"
                          : "BiliBili"
                        : selectedAccount.server}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CustomModalBody>
        <CustomModalFooter>
          <Button
            variant="outline"
            onPress={() => setIsDetailsModalOpen(false)}
          >
            {t("settings.account.close")}
          </Button>
        </CustomModalFooter>
      </CustomModal>

      {/* Add Account Modal */}
      <CustomModal
        isOpen={isAddModalOpen}
        onClose={handleCloseAddModal}
        size="lg"
        height={
          availableRoles.length > 0 && availableRoles.length <= 3
            ? "auto"
            : "fixed"
        }
        disableBackdropClick={availableRoles.length > 0} // 当有角色可选时，禁用点击背景关闭
      >
        <CustomModalHeader onClose={handleCloseAddModal}>
          {t("settings.account.add_account")}
        </CustomModalHeader>
        <CustomModalBody>
          {availableRoles.length > 0 ? (
            // 角色选择界面
            <div className="space-y-4">
              <p className="text-sm text-muted text-center mb-4">
                {i18n.language === "zh"
                  ? "请选择要绑定的角色"
                  : "Please select roles to bind"}
              </p>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {availableRoles.map((role) => {
                  // 头像已经是 base64 格式，直接使用
                  const avatarSrc = role.avatarUrl;

                  return (
                    <Card
                      key={role.roleId}
                      className={`cursor-pointer transition-all duration-200 w-full ${
                        selectedRoles.includes(role.roleId)
                          ? "border-[3px] border-green-400 dark:border-green-300 bg-green-50 dark:bg-green-900/50 shadow-md"
                          : "border-2 border-separator hover:border-green-400/50 hover:shadow-sm hover:bg-content2 dark:hover:bg-content2/50"
                      }`}
                      onClick={() => handleRoleToggle(role.roleId)}
                    >
                      <div className="p-4">
                        <div className="flex items-center gap-4">
                          <Checkbox
                            isSelected={selectedRoles.includes(role.roleId)}
                            onChange={() => handleRoleToggle(role.roleId)}
                          />
                          <div className="w-16 h-16 rounded-full overflow-hidden bg-default-200 flex-shrink-0">
                            {avatarSrc ? (
                              <img
                                src={avatarSrc}
                                alt={role.nickname}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display =
                                    "none";
                                  const parent = (e.target as HTMLImageElement)
                                    .parentElement;
                                  if (parent) {
                                    parent.textContent = role.nickname
                                      .charAt(0)
                                      .toUpperCase();
                                    parent.className =
                                      "w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-lg font-bold text-primary";
                                  }
                                }}
                              />
                            ) : (
                              <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-lg font-bold text-primary">
                                {role.nickname.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-lg truncate">
                              {role.nickname || "未知角色"}
                            </h3>
                            <p className="text-sm text-muted">
                              {i18n.language === "zh" ? "等级" : "Level"}:{" "}
                              {role.level}
                            </p>
                            <p className="text-xs text-muted/70">
                              {i18n.language === "zh" ? "服务器" : "Server"}:{" "}
                              {role.serverId}
                            </p>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ) : !loginMethod ? (
            // 登录方式选择
            <div className="space-y-4">
              <p className="text-sm text-muted text-center mb-6">
                {t("settings.account.select_login_method")}
              </p>

              <div className="grid grid-cols-2 gap-4">
                {/* 密码登录 */}
                <button
                  onClick={() => setLoginMethod("phone")}
                  className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-separator hover:border-primary hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all cursor-pointer group"
                >
                  <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg
                      className="w-8 h-8 text-primary"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {t("settings.account.phone_login")}
                  </span>
                </button>

                {/* 验证码登录 */}
                <button
                  onClick={() => setLoginMethod("qrcode")}
                  className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-separator hover:border-primary hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all cursor-pointer group"
                >
                  <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg
                      className="w-8 h-8 text-primary"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                      />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {t("settings.account.qrcode_login")}
                  </span>
                </button>
              </div>
            </div>
          ) : loginMethod === "phone" ? (
            // 手机号登录表单
            <div className="space-y-4">
              {/* 返回按钮 */}
              <button
                onClick={() => setLoginMethod(null)}
                className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors mb-4"
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
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                {t("settings.account.back")}
              </button>

              {/* 错误提示 */}
              {loginError && (
                <Alert status="danger">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Description>{loginError}</Alert.Description>
                  </Alert.Content>
                </Alert>
              )}

              {/* 发送验证码成功提示 */}
              {codeSentSuccess && (
                <Alert status="success">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Description>
                      {i18n.language === "zh"
                        ? "验证码已发送，请注意查收"
                        : "Verification code sent"}
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
              )}

              {/* 手机号和密码输入 */}
              <div className="space-y-4">
                {/* 手机号输入行 */}
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-foreground whitespace-nowrap min-w-[80px]">
                    {t("settings.account.phone_number")}
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setCodeSentSuccess(false);
                      if (phoneError) setPhoneError(""); // 输入时清除错误
                    }}
                    placeholder={t("settings.account.enter_phone")}
                    maxLength={11}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !isLoggingIn) {
                        handleLogin();
                      }
                    }}
                    className="flex-1 px-4 py-2.5 bg-default-100 border border-separator rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                </div>
                {phoneError && (
                  <p className="text-xs text-danger ml-[80px]">{phoneError}</p>
                )}

                {/* 密码输入行 */}
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-foreground whitespace-nowrap min-w-[80px]">
                    {t("settings.account.password")}
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("settings.account.enter_password")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !isLoggingIn) {
                        handleLogin();
                      }
                    }}
                    className="flex-1 px-4 py-2.5 bg-default-100 border border-separator rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                </div>
              </div>
            </div>
          ) : (
            // 验证码登录表单
            <div className="space-y-4">
              <button
                onClick={() => setLoginMethod(null)}
                className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors mb-4"
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
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                {t("settings.account.back")}
              </button>

              {/* 错误提示 */}
              {loginError && (
                <Alert status="danger">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Description>{loginError}</Alert.Description>
                  </Alert.Content>
                </Alert>
              )}

              {/* 发送验证码成功提示 */}
              {codeSentSuccess && (
                <Alert status="success">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Description>
                      {i18n.language === "zh"
                        ? "验证码已发送，请注意查收"
                        : "Verification code sent"}
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
              )}

              {/* 手机号和验证码输入 */}
              <div className="space-y-4">
                {/* 手机号输入行 */}
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-foreground whitespace-nowrap min-w-[80px]">
                    {t("settings.account.phone_number")}
                  </label>
                  <div className="flex gap-2 flex-1 items-stretch">
                    <input
                      type="tel"
                      placeholder={
                        i18n.language === "zh"
                          ? "请输入手机号"
                          : "Enter phone number"
                      }
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        setCodeSentSuccess(false);
                        if (phoneError) setPhoneError("");
                      }}
                      disabled={isLoggingIn || isSendingCode}
                      maxLength={11}
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter" &&
                          !isLoggingIn &&
                          !isSendingCode
                        ) {
                          handleSendCode();
                        }
                      }}
                      className="flex-1 px-4 py-2.5 bg-default-100 border border-separator rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    />
                    <Button
                      variant="outline"
                      onPress={handleSendCode}
                      isDisabled={isSendingCode || countdown > 0 || !phone}
                      className="min-w-[120px] whitespace-nowrap border border-separator rounded-lg bg-default-100 hover:bg-default-200 transition-all !h-[44px] !px-4"
                    >
                      {countdown > 0
                        ? `${countdown}s`
                        : isSendingCode
                          ? t("settings.account.sending")
                          : t("settings.account.send_code")}
                    </Button>
                  </div>
                </div>
                {phoneError && (
                  <p className="text-xs text-danger ml-[80px]">{phoneError}</p>
                )}

                {/* 验证码输入行 */}
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-foreground whitespace-nowrap min-w-[80px]">
                    {t("settings.account.verification_code")}
                  </label>
                  <input
                    type="text"
                    placeholder={
                      i18n.language === "zh"
                        ? t("settings.account.enter_verification_code")
                        : t("settings.account.enter_verification_code")
                    }
                    value={verificationCode}
                    onChange={(e) => {
                      setVerificationCode(e.target.value);
                      // 当用户输入验证码时，清除发送成功的提示
                      if (codeSentSuccess) {
                        setCodeSentSuccess(false);
                      }
                    }}
                    disabled={isLoggingIn}
                    maxLength={6}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !isLoggingIn) {
                        handleLogin();
                      }
                    }}
                    className="flex-1 px-4 py-2.5 bg-default-100 border border-separator rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                </div>
              </div>
            </div>
          )}
        </CustomModalBody>
        <CustomModalFooter>
          {availableRoles.length > 0 ? (
            <>
              <Button
                variant="outline"
                onPress={() => {
                  // 放弃角色选择，清除所有登录状态
                  setAvailableRoles([]);
                  setSelectedRoles([]);
                  setLoginCred("");
                  setLoginToken("");
                  setLoginUserId("");
                  setLoginMethod("qrcode");
                }}
              >
                {t("settings.account.back")}
              </Button>
              <Button
                variant="primary"
                onPress={handleConfirmRoles}
                isDisabled={selectedRoles.length === 0 || isLoading}
              >
                {isLoading
                  ? t("settings.account.loading")
                  : `${t("settings.account.confirm")} (${selectedRoles.length})`}
              </Button>
            </>
          ) : (
            (loginMethod === "phone" || loginMethod === "qrcode") && (
              <>
                <Button variant="outline" onPress={() => setLoginMethod(null)}>
                  {t("settings.account.back")}
                </Button>
                <Button
                  variant="primary"
                  onPress={handleLogin}
                  isDisabled={
                    isLoggingIn ||
                    !phone ||
                    (loginMethod === "phone" ? !password : !verificationCode)
                  }
                >
                  {isLoggingIn
                    ? t("settings.account.loading")
                    : t("settings.account.login")}
                </Button>
              </>
            )
          )}
        </CustomModalFooter>
      </CustomModal>
    </div>
  );
}
