import { useTranslation } from "react-i18next";
import { Card, Button, Skeleton } from "@heroui/react";
import { useState, useEffect } from "react";
import {
  CustomModal,
  CustomModalHeader,
  CustomModalBody,
  CustomModalFooter,
} from "@/components/custom-modal";
import { SimplePagination } from "@/components/simple-pagination";
import {
  getAccounts,
  refreshAccountData,
  logoutAccount as apiLogoutAccount,
  addAccount,
  Account,
  LoginResult,
} from "@/utils/accountService";

const ITEMS_PER_PAGE = 5;

export default function AccountPage() {
  const { t, i18n } = useTranslation();

  // 状态管理
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // 添加账户相关状态
  type LoginMethod = "phone" | "qrcode" | null;
  const [loginMethod, setLoginMethod] = useState<LoginMethod>(null);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string>("");
  const [loginSuccess, setLoginSuccess] = useState<Account | null>(null);

  // 从 C# 端获取账户数据
  useEffect(() => {
    const loadAccounts = async () => {
      setIsLoading(true);

      try {
        const accounts = await getAccounts();

        // 直接使用后端返回的数据（无论是否为空）
        setAccounts(accounts || []);

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
        setAccounts((prev) => prev.filter((acc) => acc.id !== accountId));
      }
    } catch (error) {
      console.error("Failed to logout:", error);
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
    setLoginError("");
    setIsAddModalOpen(true);
  };

  // 关闭添加账户 Modal
  const handleCloseAddModal = () => {
    setLoginMethod(null);
    setPhone("");
    setPassword("");
    setLoginError("");
    setLoginSuccess(null);
    setIsAddModalOpen(false);
  };

  // 处理登录
  const handleLogin = async () => {
    if (!phone || !password) {
      setLoginError(
        i18n.language === "zh"
          ? "请输入手机号和密码"
          : "Please enter phone and password",
      );
      return;
    }

    setIsLoggingIn(true);
    setLoginError("");
    setLoginSuccess(null);

    try {
      const result: LoginResult = await addAccount({ phone, password });

      if (result.success && result.account) {
        // 登录成功，显示账户信息
        setLoginSuccess(result.account);

        // 刷新账户列表
        const accounts = await getAccounts();
        setAccounts(accounts || []);

        // 2秒后自动关闭 Modal
        setTimeout(() => {
          handleCloseAddModal();
        }, 2000);
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

  // 计算分页
  const totalPages = Math.ceil(accounts.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentAccounts = accounts.slice(startIndex, endIndex);

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
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
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
        <>
          <div className="space-y-4">
            {currentAccounts.map((account) => (
              <Card
                key={account.id}
                className="p-4 bg-content1 shadow-md border border-separator hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    {/* Avatar placeholder */}
                    <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-lg font-bold text-primary flex-shrink-0">
                      {account.nickname.charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-base font-semibold text-foreground truncate">
                        {account.nickname}
                      </p>
                      <p className="text-sm text-muted">
                        {i18n.language === "zh" ? "等级" : "Level"}:{" "}
                        {account.level} • {account.server}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        account.status === "online"
                          ? "bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300"
                          : "bg-default-100 text-default-600 dark:bg-default-800 dark:text-default-400"
                      }`}
                    >
                      {account.status === "online"
                        ? i18n.language === "zh"
                          ? "在线"
                          : "Online"
                        : i18n.language === "zh"
                          ? "离线"
                          : "Offline"}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={() => handleViewDetails(account)}
                    >
                      {t("settings.account.view_details")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={() => handleLogout(account.id)}
                      className="text-danger border-danger hover:bg-danger-50"
                    >
                      {t("settings.account.logout")}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-6">
              <SimplePagination
                total={totalPages}
                page={currentPage}
                onChange={setCurrentPage}
              />
            </div>
          )}
        </>
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
                <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-2xl font-bold text-primary">
                  {selectedAccount.nickname.charAt(0).toUpperCase()}
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
                    {selectedAccount.server}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted mb-1">
                    {i18n.language === "zh" ? "状态" : "Status"}
                  </p>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      selectedAccount.status === "online"
                        ? "bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300"
                        : "bg-default-100 text-default-600 dark:bg-default-800 dark:text-default-400"
                    }`}
                  >
                    {selectedAccount.status === "online"
                      ? i18n.language === "zh"
                        ? "在线"
                        : "Online"
                      : i18n.language === "zh"
                        ? "离线"
                        : "Offline"}
                  </span>
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
        size="md"
      >
        <CustomModalHeader onClose={handleCloseAddModal}>
          {t("settings.account.add_account")}
        </CustomModalHeader>
        <CustomModalBody>
          {!loginMethod ? (
            // 登录方式选择
            <div className="space-y-4">
              <p className="text-sm text-muted text-center mb-6">
                {t("settings.account.select_login_method")}
              </p>

              <div className="grid grid-cols-2 gap-4">
                {/* 手机号登录 */}
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
                        d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {t("settings.account.phone_login")}
                  </span>
                </button>

                {/* 扫码登录 */}
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
                        d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
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
                <div className="p-3 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg">
                  <p className="text-sm text-danger">{loginError}</p>
                </div>
              )}

              {/* 成功提示 */}
              {loginSuccess && (
                <div className="p-4 bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <svg
                      className="w-6 h-6 text-success"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p className="text-base font-semibold text-success">
                      {i18n.language === "zh"
                        ? "登录成功！"
                        : "Login Successful!"}
                    </p>
                  </div>
                  <div className="space-y-1 text-sm text-success-700 dark:text-success-300">
                    <p>
                      <strong>
                        {i18n.language === "zh" ? "账户 ID:" : "Account ID:"}
                      </strong>{" "}
                      {loginSuccess.id}
                    </p>
                    <p>
                      <strong>
                        {i18n.language === "zh" ? "昵称:" : "Nickname:"}
                      </strong>{" "}
                      {loginSuccess.nickname}
                    </p>
                    <p>
                      <strong>Cred:</strong>{" "}
                      {loginSuccess.cred
                        ? `${loginSuccess.cred.substring(0, 20)}...`
                        : "N/A"}
                    </p>
                    <p>
                      <strong>Token:</strong>{" "}
                      {loginSuccess.token
                        ? `${loginSuccess.token.substring(0, 20)}...`
                        : "N/A"}
                    </p>
                  </div>
                </div>
              )}

              {/* 手机号输入 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {t("settings.account.phone_number")}
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder={t("settings.account.enter_phone")}
                  className="w-full px-4 py-2.5 bg-default-100 border border-separator rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
              </div>

              {/* 密码输入 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
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
                  className="w-full px-4 py-2.5 bg-default-100 border border-separator rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
              </div>
            </div>
          ) : (
            // 扫码登录（后续实现）
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

              <div className="text-center py-8">
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
                    d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                  />
                </svg>
                <p className="text-sm text-muted">
                  {i18n.language === "zh"
                    ? "扫码登录功能将在后续实现"
                    : "QR code login will be implemented later"}
                </p>
              </div>
            </div>
          )}
        </CustomModalBody>
        <CustomModalFooter>
          {loginMethod === "phone" && (
            <>
              <Button variant="outline" onPress={() => setLoginMethod(null)}>
                {t("settings.account.back")}
              </Button>
              <Button
                variant="primary"
                onPress={handleLogin}
                isDisabled={isLoggingIn || !phone || !password}
              >
                {isLoggingIn
                  ? t("settings.account.loading")
                  : t("settings.account.login")}
              </Button>
            </>
          )}
        </CustomModalFooter>
      </CustomModal>
    </div>
  );
}
