import { useTranslation } from "react-i18next";
import {
  Card,
  Button,
  Skeleton,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Checkbox,
  Chip,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/react";
import {
  CustomModal,
  CustomModalHeader,
  CustomModalBody,
  CustomModalFooter,
} from "@/components/custom-modal";
import RoleSelectModal from "@/components/role-select-modal";
import { useState, useEffect } from "react";
import {
  getAccounts,
  refreshAccountData,
  logoutAccount as apiLogoutAccount,
  batchLogoutAccounts as apiBatchLogoutAccounts,
  addAccountByCode as apiAddAccountByCode,
  saveSelectedRoles,
  getSelectedAccount,
  setSelectedAccount as apiSetSelectedAccount,
  Account,
  RoleDisplayInfo,
} from "@/utils/accountService";

export default function AccountPage() {
  const { t, i18n } = useTranslation();

  // 状态管理
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(
    null,
  );

  // 角色选择 Modal 状态
  const [isRoleSelectModalOpen, setIsRoleSelectModalOpen] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<RoleDisplayInfo[]>([]);
  const [loginCred, setLoginCred] = useState("");
  const [loginToken, setLoginToken] = useState("");
  const [loginUserId, setLoginUserId] = useState("");

  // 登录表单状态
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // 从 C# 端获取账户数据
  useEffect(() => {
    const loadAccounts = async () => {
      setIsLoading(true);

      try {
        // 调用 C# 端获取账户数据
        const accounts = await getAccounts();

        if (accounts && accounts.length > 0) {
          setAccounts(accounts);
        } else {
          // 如果没有数据，使用模拟数据用于展示
          const mockAccounts: Account[] = [
            {
              id: "1",
              avatar: "https://i.pravatar.cc/150?u=1",
              nickname: "玩家一号",
              level: 45,
              server: "服务器A",
              status: "online",
            },
            {
              id: "2",
              avatar: "https://i.pravatar.cc/150?u=2",
              nickname: "Player Two",
              level: 32,
              server: "Server B",
              status: "offline",
            },
            {
              id: "3",
              avatar: "https://i.pravatar.cc/150?u=3",
              nickname: "测试用户",
              level: 28,
              server: "服务器C",
              status: "online",
            },
          ];
          setAccounts(mockAccounts);
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

  // 加载选中的账户
  useEffect(() => {
    const loadSelectedAccount = async () => {
      const selectedId = await getSelectedAccount();
      setSelectedAccountId(selectedId);
    };
    loadSelectedAccount();
  }, [accounts]);

  // 刷新数据函数
  const refreshData = async () => {
    setIsRefreshing(true);

    try {
      // 调用 C# 端的刷新接口
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
      // 调用 C# 端登出接口
      const success = await apiLogoutAccount(accountId);

      if (success) {
        // 从列表中移除
        setAccounts((prev) => prev.filter((acc) => acc.id !== accountId));
        setSelectedKeys(new Set());
      }
    } catch (error) {
      console.error("Failed to logout:", error);
    }
  };

  // 处理批量登出
  const handleBatchLogout = async () => {
    try {
      // 调用 C# 端批量登出接口
      const accountIds = Array.from(selectedKeys);
      const success = await apiBatchLogoutAccounts(accountIds);

      if (success) {
        // 从列表中移除
        setAccounts((prev) => prev.filter((acc) => !selectedKeys.has(acc.id)));
        setSelectedKeys(new Set());
      }
    } catch (error) {
      console.error("Failed to batch logout:", error);
    }
  };

  // 查看详情
  const handleViewDetails = (account: Account) => {
    setSelectedAccount(account);
    setIsDetailsModalOpen(true);
  };

  // 处理登录
  const handleLogin = async () => {
    if (!loginPhone || !loginPassword) {
      alert(
        i18n.language === "zh"
          ? "请输入手机号和密码"
          : "Please enter phone and password",
      );
      return;
    }

    setIsLoggingIn(true);
    try {
      // 使用验证码登录（这里暂时用密码登录模拟，实际需要改为验证码流程）
      // TODO: 实现发送验证码和验证码输入UI
      const result = await apiAddAccountByCode({
        phone: loginPhone,
        code: loginPassword, // 临时用密码字段作为验证码
      });

      if (
        result.success &&
        result.availableRoles &&
        result.availableRoles.length > 0
      ) {
        // 保存 cred、token、userId 供后续使用
        setAvailableRoles(result.availableRoles);
        setLoginCred(result.cred || "");
        setLoginToken(result.token || "");
        setLoginUserId(result.userId || "");
        // 打开角色选择 Modal
        setIsRoleSelectModalOpen(true);
      } else if (result.success) {
        // 没有可用角色
        alert(
          i18n.language === "zh"
            ? "未找到可用角色"
            : "No available roles found",
        );
      } else {
        alert(
          result.errorMessage ||
            (i18n.language === "zh" ? "登录失败" : "Login failed"),
        );
      }
    } catch (error) {
      console.error("Login error:", error);
      alert(i18n.language === "zh" ? "登录出错" : "Login error");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // 处理角色选择成功
  const handleRoleSelectSuccess = async () => {
    // 刷新账户列表
    await refreshData();
    // 关闭登录模态框并清空表单
    setIsAddModalOpen(false);
    setLoginPhone("");
    setLoginPassword("");
    alert(i18n.language === "zh" ? "角色绑定成功" : "Roles bound successfully");
  };

  // 处理账户选择
  const handleAccountSelect = async (accountId: string) => {
    await apiSetSelectedAccount(accountId);
    setSelectedAccountId(accountId);
  };

  // 渲染骨架屏
  const renderSkeleton = () => (
    <TableBody>
      {[1, 2, 3].map((item) => (
        <TableRow key={item}>
          <TableCell>
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="w-24 h-4 rounded-lg" />
                <Skeleton className="w-16 h-3 rounded-lg" />
              </div>
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="w-12 h-6 rounded-lg" />
          </TableCell>
          <TableCell>
            <Skeleton className="w-20 h-4 rounded-lg" />
          </TableCell>
          <TableCell>
            <Skeleton className="w-16 h-6 rounded-lg" />
          </TableCell>
          <TableCell>
            <div className="flex gap-2">
              <Skeleton className="w-16 h-8 rounded-lg" />
              <Skeleton className="w-16 h-8 rounded-lg" />
            </div>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  );

  // 渲染空状态
  const renderEmptyState = () => (
    <TableBody>
      <TableRow>
        <TableCell colSpan={5} className="text-center py-8">
          <div className="flex flex-col items-center justify-center text-muted">
            <svg
              className="w-16 h-16 mb-4 opacity-50"
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
            <p className="text-lg font-medium">
              {t("settings.account.no_accounts")}
            </p>
            <p className="text-sm mt-1">
              {i18n.language === "zh"
                ? "点击右上角添加账户"
                : "Click the button above to add an account"}
            </p>
          </div>
        </TableCell>
      </TableRow>
    </TableBody>
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
          <Button variant="primary" onPress={() => setIsAddModalOpen(true)}>
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

      {/* Accounts Table */}
      <Card className="bg-content1 shadow-sm">
        <Table aria-label={t("settings.account.title")}>
          <TableHeader>
            <TableColumn width={40}>
              <Checkbox
                isSelected={
                  selectedKeys.size === accounts.length && accounts.length > 0
                }
                onChange={() => {
                  if (selectedKeys.size === accounts.length) {
                    setSelectedKeys(new Set());
                  } else {
                    setSelectedKeys(new Set(accounts.map((acc) => acc.id)));
                  }
                }}
              />
            </TableColumn>
            <TableColumn>{t("settings.account.nickname")}</TableColumn>
            <TableColumn>{t("settings.account.level")}</TableColumn>
            <TableColumn>{t("settings.account.server")}</TableColumn>
            <TableColumn>{t("settings.account.status")}</TableColumn>
            <TableColumn>{t("settings.account.actions")}</TableColumn>
          </TableHeader>

          {isLoading ? (
            renderSkeleton()
          ) : accounts.length === 0 ? (
            renderEmptyState()
          ) : (
            <TableBody>
              {accounts.map((account) => (
                <TableRow
                  key={account.id}
                  className={
                    selectedAccountId === account.id
                      ? "bg-primary-50 dark:bg-primary-900/20"
                      : ""
                  }
                >
                  <TableCell>
                    <Checkbox
                      isSelected={selectedKeys.has(account.id)}
                      onChange={() => {
                        const newSelected = new Set(selectedKeys);
                        if (newSelected.has(account.id)) {
                          newSelected.delete(account.id);
                        } else {
                          newSelected.add(account.id);
                        }
                        setSelectedKeys(newSelected);
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-sm font-bold text-primary cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => handleAccountSelect(account.id)}
                        title={
                          i18n.language === "zh"
                            ? "点击选择此账户"
                            : "Click to select this account"
                        }
                      >
                        {account.avatar ? (
                          <img
                            src={account.avatar}
                            alt={account.nickname}
                            className="w-full h-full rounded-full object-cover"
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
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {account.nickname}
                        </p>
                        <p className="text-xs text-muted">ID: {account.id}</p>
                        {selectedAccountId === account.id && (
                          <Chip
                            size="sm"
                            variant="soft"
                            className="mt-1 bg-primary-100 text-primary"
                          >
                            {i18n.language === "zh" ? "当前选中" : "Selected"}
                          </Chip>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Chip size="sm" variant="soft" color="default">
                      Lv.{account.level}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-foreground">
                      {account.server}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="sm"
                      variant="soft"
                      color={
                        account.status === "online" ? "success" : "default"
                      }
                    >
                      {account.status === "online"
                        ? i18n.language === "zh"
                          ? "在线"
                          : "Online"
                        : i18n.language === "zh"
                          ? "离线"
                          : "Offline"}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Dropdown>
                        <DropdownTrigger>
                          <Button variant="outline" size="sm">
                            {i18n.language === "zh" ? "操作" : "Actions"}
                          </Button>
                        </DropdownTrigger>
                        <DropdownMenu>
                          <DropdownItem
                            key="details"
                            onPress={() => handleViewDetails(account)}
                          >
                            {t("settings.account.view_details")}
                          </DropdownItem>
                          <DropdownItem
                            key="logout"
                            className="text-danger"
                            onPress={() => handleLogout(account.id)}
                          >
                            {t("settings.account.logout")}
                          </DropdownItem>
                        </DropdownMenu>
                      </Dropdown>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          )}
        </Table>
      </Card>

      {/* Batch operations bar */}
      {selectedKeys.size > 0 && (
        <Card className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Checkbox isSelected={true} isDisabled />
              <span className="text-sm font-medium text-foreground">
                {t("settings.account.selected_count", {
                  count: selectedKeys.size,
                })}
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="danger-soft"
                onPress={handleBatchLogout}
              >
                {t("settings.account.batch_operations")} -{" "}
                {t("settings.account.logout")}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Account Details Modal */}
      <CustomModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
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

              <div className="my-4 border-t border-default-200" />

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
                  <Chip
                    size="sm"
                    variant="soft"
                    color={
                      selectedAccount.status === "online"
                        ? "success"
                        : "default"
                    }
                  >
                    {selectedAccount.status === "online"
                      ? i18n.language === "zh"
                        ? "在线"
                        : "Online"
                      : i18n.language === "zh"
                        ? "离线"
                        : "Offline"}
                  </Chip>
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

      {/* Add Account Modal (Login Form) */}
      <CustomModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      >
        <CustomModalHeader onClose={() => setIsAddModalOpen(false)}>
          {t("settings.account.add_account")}
        </CustomModalHeader>
        <CustomModalBody>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {i18n.language === "zh" ? "手机号" : "Phone Number"}
              </label>
              <input
                type="text"
                placeholder={
                  i18n.language === "zh" ? "请输入手机号" : "Enter phone number"
                }
                value={loginPhone}
                onChange={(e) => setLoginPhone(e.target.value)}
                disabled={isLoggingIn}
                className="w-full px-3 py-2 border border-default-200 rounded-lg bg-content1 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {i18n.language === "zh" ? "密码" : "Password"}
              </label>
              <input
                type="password"
                placeholder={
                  i18n.language === "zh" ? "请输入密码" : "Enter password"
                }
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                disabled={isLoggingIn}
                className="w-full px-3 py-2 border border-default-200 rounded-lg bg-content1 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </CustomModalBody>
        <CustomModalFooter>
          <Button
            variant="outline"
            onPress={() => setIsAddModalOpen(false)}
            isDisabled={isLoggingIn}
          >
            {t("settings.account.cancel")}
          </Button>
          <Button
            variant="primary"
            onPress={handleLogin}
            isDisabled={isLoggingIn}
          >
            {isLoggingIn
              ? i18n.language === "zh"
                ? "登录中..."
                : "Logging in..."
              : i18n.language === "zh"
                ? "登录"
                : "Login"}
          </Button>
        </CustomModalFooter>
      </CustomModal>

      {/* Role Select Modal */}
      <RoleSelectModal
        isOpen={isRoleSelectModalOpen}
        onClose={() => setIsRoleSelectModalOpen(false)}
        roles={availableRoles}
        cred={loginCred}
        token={loginToken}
        userId={loginUserId}
        onSuccess={handleRoleSelectSuccess}
      />
    </div>
  );
}
