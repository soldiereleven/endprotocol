import { useTranslation } from "react-i18next";
import { Img } from "@/utils/imageLoader";
import {
  Card,
  Button,
  Skeleton,
  Alert,
  Checkbox,
  InputOTP,
  Label,
  Link,
  Spinner,
} from "@heroui/react";
import { SimplePagination } from "@/components/simple-pagination";
import { CONTAINER_HEIGHT } from "@/components/cards/card-container";
import { StatusDot, type StatusDotTone } from "@/components/ui/status-dot";
import { StatusBadge, SYNC_STATUS_META, type StatusConfig } from "@/components/ui/status-badge";
import { useState, useEffect, useRef } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  CustomModal,
  CustomModalHeader,
  CustomModalBody,
  CustomModalFooter,
} from "@/components/custom-modal";
import {
  getAccounts,
  getSelectedAccount,
  refreshAccountData,
  logoutAccount as apiLogoutAccount,
  addAccount,
  sendVerificationCode,
  addAccountByCode,
  saveSelectedRoles,
  setSelectedAccount as apiSetSelectedAccount,
  Account,
  LoginResult,
  RoleDisplayInfo,
} from "@/utils/accountService";
import { roleDetailService } from "@/utils/roleDetailService";
import logger, { logDebug, logError } from "../utils/logger";
import { getConfig } from "@/utils/configService";
import { resolveServerLabel } from "@/types";

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
  const [expectedAccountCount, setExpectedAccountCount] = useState<number>(0); // 预期的账户数量

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
  const [showOtpInput, setShowOtpInput] = useState(false); // 是否显示 OTP 输入界面
  const [isOtpInvalid, setIsOtpInvalid] = useState(false); // OTP 是否无效

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
        // 直接从后端获取账户数据（后端会处理缓存）
        logDebug("[Account] Fetching accounts from backend...");
        const accounts = await getAccounts();

        logDebug(
          "[Account] Fetched accounts from backend, count:",
          accounts?.length || 0,
        );

        // 直接使用后端返回的数据（无论是否为空）
        logDebug(
          "[Account] Setting accounts state, count:",
          accounts?.length || 0,
        );
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
        logError("Failed to load accounts:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAccounts();

    // 监听后端自动刷新事件，替代前端定时轮询
    let unlisten: UnlistenFn | undefined;
    (async () => {
      unlisten = await listen("accounts-refreshed", (event: { payload: { success: boolean; accounts?: any[]; refreshTime: string } }) => {
        logDebug("[Account] Data refreshed via backend event");
        if (event.payload.success && event.payload.accounts) {
          setAccounts(event.payload.accounts);
          setLastRefreshTime(new Date(event.payload.refreshTime));
        }
      });
    })();

    return () => {
      if (unlisten) unlisten();
    };
  }, []); // 只在组件挂载时执行一次

  // 当账户数据加载完成后，重新计算 itemsPerPage
  useEffect(() => {
    if (accounts.length > 0 && containerRef.current) {
      logger.info("Accounts loaded, recalculating itemsPerPage", "Account");
      // 延迟一下确保 DOM 已渲染
      setTimeout(() => {
        const calculateItemsPerPage = () => {
          if (!containerRef.current) return;

          // 使用窗口高度减去固定的顶部区域
          // 估算：顶部标题栏(~60px) + 页面标题和按钮(~120px) + 刷新时间(~30px) + 上下边距(~40px) = ~250px
          const topOffset = 250;
          const windowHeight = window.innerHeight;
          const availableHeight = windowHeight - topOffset;

          logger.info("Window height: " + windowHeight + " Available height: " + availableHeight, "Account");

          if (availableHeight <= 0) {
            setItemsPerPage(1);
            return;
          }

          // 分页组件高度约 60px
          const paginationHeight = 60;
          const contentAvailableHeight = availableHeight - paginationHeight;

          if (contentAvailableHeight <= 0) {
            setItemsPerPage(1);
            return;
          }

          let count = 0;
          let usedHeight = 0;

          while (count < 100) {
            const cardHeight = CARD_HEIGHT + (count > 0 ? GAP_SIZE : 0);
            if (usedHeight + cardHeight > contentAvailableHeight) {
              break;
            }
            usedHeight += cardHeight;
            count++;
          }

          const newCount = Math.max(1, count);
          logger.info("Recalculated items per page: " + newCount, "Account");
          setItemsPerPage(newCount);
        };

        calculateItemsPerPage();
      }, 200);
    }
  }, [accounts.length]);

  // 监听账户切换事件（从侧边栏切换时触发）
  useEffect(() => {
    const handleAccountChanged = async () => {
      logDebug("[Account] Received accountChanged event");

      // 重新加载账户数据
      setIsLoading(true);
      try {
        // 并行获取配置和新的选中账户ID
        const [shouldRefresh, selectedId] = await Promise.all([
          getConfig<boolean>("refresh_on_account_switch"),
          getSelectedAccount(),
        ]);
        logger.info("Should refresh on switch (from sidebar): " + shouldRefresh, "Account");
        logDebug("[Account] New selected account ID:", selectedId);

        let accountsData;
        if (shouldRefresh) {
          // 如果需要刷新，调用API获取最新数据
          logger.info("Refreshing account data from API (sidebar)...", "Account");
          const result = await refreshAccountData();
          if (result.success && result.accounts) {
            accountsData = result.accounts;
          }
        } else {
          // 如果不需要刷新，直接从后端获取（后端会处理缓存）
          logDebug("[Account] Fetching account data from backend (sidebar)");
          accountsData = await getAccounts();
        }

        setAccounts(accountsData || []);

        // 只更新当前选中的账户，不修改 previousAccountId
        // previousAccountId 应该由 handleSelectAccount 设置
        setCurrentAccountId(selectedId);

        // 通知后端当前激活的角色ID(用于懒加载)
        if (selectedId) {
          await roleDetailService.setCurrentRoleId(selectedId);
        }

        setIsAnimating(true);

        setTimeout(() => {
          setIsAnimating(false);
          setPreviousAccountId(null);
        }, 300);
      } catch (error) {
        logError("Failed to reload accounts:", error);
      } finally {
        setIsLoading(false);
      }
    };

    window.addEventListener("accountChanged", handleAccountChanged);
    return () => {
      window.removeEventListener("accountChanged", handleAccountChanged);
    };
  }, []); // 移除 currentAccountId 依赖，避免循环

  // 获取预期的账户数量（从配置中读取）
  const getExpectedAccountCount = async (): Promise<number> => {
    try {
      // 获取 account_list
      const accountList = await getConfig<string[]>("account_list");
      if (accountList && Array.isArray(accountList)) {
        // 最多显示5个骨架屏
        return Math.min(accountList.length, 5);
      }

      // 如果 account_list 不存在，直接从后端获取
      const accounts = await getAccounts();
      if (accounts && accounts.length > 0) {
        return Math.min(accounts.length, 5);
      }

      // 默认显示3个
      return 3;
    } catch (error) {
      logger.error("Failed to get expected account count: " + error, "Account");
      return 3; // 出错时默认显示3个
    }
  };

  // 刷新数据函数
  const refreshData = async () => {
    setIsRefreshing(true);

    // 先获取预期的账户数量
    const count = await getExpectedAccountCount();
    setExpectedAccountCount(count);

    // 通知侧边栏显示骨架屏
    window.dispatchEvent(
      new CustomEvent("manualRefresh", { detail: { count } }),
    );

    try {
      const result = await refreshAccountData();

      if (result.success && result.accounts) {
        setAccounts(result.accounts);
        setLastRefreshTime(new Date(result.refreshTime));
      }
    } catch (error) {
      logError("Failed to refresh data:", error);
    } finally {
      setIsRefreshing(false);
      setExpectedAccountCount(0);
    }
  };

  // 重试同步失败的账户
  const retrySyncAccount = async (accountId: string) => {
    logDebug("[Account] Retrying sync for account:", accountId);

    // 重新加载所有账户数据（这会触发后端的自动重试机制）
    await refreshData();

    // 如果当前选中的是失败的账户，确保它仍然被选中
    if (currentAccountId === accountId) {
      setCurrentAccountId(accountId);
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
      logError("Failed to logout:", error);
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
    setShowOtpInput(false);
    setIsOtpInvalid(false);
    // 清除角色选择状态 - 放弃这次登录
    setAvailableRoles([]);
    setSelectedRoles([]);
    setLoginCred("");
    setLoginToken("");
    setLoginUserId("");
    setIsAddModalOpen(false);
  };

  // 发送验证码并进入 OTP 输入页面
  const handleSendCodeAndShowOtp = async () => {
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
        logDebug("验证码发送成功，设置 codeSentSuccess 为 true");
        setCodeSentSuccess(true);

        // 进入 OTP 输入页面
        setShowOtpInput(true);
        setVerificationCode("");
        setIsOtpInvalid(false);
      } else {
        setLoginError(
          i18n.language === "zh"
            ? "发送验证码失败，请重试"
            : "Failed to send verification code",
        );
      }
    } catch (error) {
      logError("Send code error:", error);
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
      // 验证码登录 - 检查是否有验证码
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

      // 如果还没有显示 OTP 输入框，先发送验证码
      if (!showOtpInput) {
        await handleSendCodeAndShowOtp();
        return;
      }

      // 如果有 OTP 输入框，检查验证码
      if (!verificationCode) {
        setLoginError(
          i18n.language === "zh"
            ? "请输入验证码"
            : "Please enter verification code",
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
      logger.info("Login result: " + JSON.stringify(result), "Account");

      if (result.success && result.account) {
        // 登录成功

        // 刷新账户列表
        const accounts = await getAccounts();
        setAccounts(accounts || []);

        // 自动选中新登录的账户
        await apiSetSelectedAccount(result.account.id);
        setCurrentAccountId(result.account.id);

        // 通知侧边栏更新
        window.dispatchEvent(new CustomEvent("accountChanged"));

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
        // 验证码错误
        if (loginMethod === "qrcode") {
          setIsOtpInvalid(true);
          setLoginError(
            result.errorMessage ||
              (i18n.language === "zh"
                ? "验证码错误，请重试"
                : "Invalid verification code, please try again"),
          );
        } else {
          setLoginError(
            result.errorMessage ||
              (i18n.language === "zh"
                ? "登录失败，请重试"
                : "Login failed, please try again"),
          );
        }
      }
    } catch (error) {
      logger.error("Login error: " + error, "Account");
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

      // 自动选中第一个绑定的账户
      if (accounts && accounts.length > 0) {
        await apiSetSelectedAccount(accounts[0].id);
        setCurrentAccountId(accounts[0].id);
        window.dispatchEvent(new CustomEvent("accountChanged"));
      }

      // 关闭模态并清空表单
      handleCloseAddModal();

      setGlobalAlert({
        type: "success",
        message:
          i18n.language === "zh" ? "角色绑定成功" : "Roles bound successfully",
      });
      setTimeout(() => setGlobalAlert(null), 5000);
    } catch (error) {
      logger.error("Failed to save roles: " + error, "Account");
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
  const handleSelectAccount = async (accountId: string) => {
    if (accountId === currentAccountId) return; // 如果点击的是当前选中的，不做任何操作

    logger.info("Selecting account: " + accountId, "Account");
    setPreviousAccountId(currentAccountId); // 记录上一个选中的账户
    setIsAnimating(true); // 开始动画
    setCurrentAccountId(accountId);

    // 调用API保存选中的账户，同时获取配置
    try {
      const [success, shouldRefresh] = await Promise.all([
        apiSetSelectedAccount(accountId),
        getConfig<boolean>("refresh_on_account_switch"),
      ]);
      logger.info("Set selected account result: " + success, "Account");
      logger.info("Should refresh on switch: " + shouldRefresh, "Account");

      if (!success) {
        logger.error("Failed to set selected account in backend", "Account");
        return;
      }

      if (shouldRefresh) {
        // 如果需要刷新，调用API获取最新数据
        logger.info("Refreshing account data from API...", "Account");
        const result = await refreshAccountData();
        if (result.success && result.accounts) {
          setAccounts(result.accounts);
        }
      } else {
        // 如果不需要刷新，直接从后端获取
        logger.info("Fetching account data from backend", "Account");
        const accountsData = await getAccounts();
        if (accountsData && accountsData.length > 0) {
          setAccounts(accountsData);
        }
      }

      // 确保后端保存成功后，再触发自定义事件通知侧边栏更新
      logger.info("Dispatching accountChanged event", "Account");
      window.dispatchEvent(new CustomEvent("accountChanged"));
    } catch (error) {
      logger.error("Failed to set selected account: " + error, "Account");
    }

    // 动画结束后重置状态
    setTimeout(() => {
      setIsAnimating(false);
      setPreviousAccountId(null);
    }, 300); // 与动画时长一致
  };

  // 获取排序后的账户列表（选中的置顶，EXPIRED 排第二，其余按字典序）
  const getSortedAccounts = (): Account[] => {
    const sorted = [...accounts];

    // 按优先级排序：ACTIVE (isSelected) > EXPIRED > 其他
    const activeAccounts: Account[] = [];
    const expiredAccounts: Account[] = [];
    const normalAccounts: Account[] = [];

    sorted.forEach((acc) => {
      if (acc.id === currentAccountId) {
        activeAccounts.push(acc);
      } else if (acc.syncStatus === "HYTOKEN_EXPIRED") {
        expiredAccounts.push(acc);
      } else {
        normalAccounts.push(acc);
      }
    });

    // 对各类别内的账户按 nickname 字典序排序
    activeAccounts.sort((a, b) => a.nickname.localeCompare(b.nickname));
    expiredAccounts.sort((a, b) => a.nickname.localeCompare(b.nickname));
    normalAccounts.sort((a, b) => a.nickname.localeCompare(b.nickname));

    return [...activeAccounts, ...expiredAccounts, ...normalAccounts];
  };

  const sortedAccounts = getSortedAccounts();

  // 分页相关状态
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(1); // 初始为1，等待计算
  const CARD_HEIGHT = 80; // 固定卡片高度（像素）
  const GAP_SIZE = 5; // 卡片间距（像素）
  const containerRef = useRef<HTMLDivElement | null>(null);

  // 使用 ResizeObserver 动态计算每页能显示的账户数量
  useEffect(() => {
    const calculateItemsPerPage = () => {
      if (!containerRef.current) {
        logger.info("containerRef not ready", "Account");
        return;
      }

      // 使用窗口高度减去固定的顶部区域
      const topOffset = 250;
      const windowHeight = window.innerHeight;
      const availableHeight = windowHeight - topOffset;

      logger.info("Window height: " + windowHeight + " Available height: " + availableHeight, "Account");

      if (availableHeight <= 0) {
        logger.info("Available height is 0 or negative", "Account");
        return;
      }

      // 分页组件高度约 60px
      const paginationHeight = 60;
      const contentAvailableHeight = availableHeight - paginationHeight;

      logger.info("Content available height: " + contentAvailableHeight, "Account");

      if (contentAvailableHeight <= 0) {
        logger.info("Content available height is 0 or negative, setting to 1", "Account");
        setItemsPerPage(1);
        return;
      }

      // 计算能容纳的卡片数量
      let count = 0;
      let usedHeight = 0;

      while (count < 100) {
        const cardHeight = CARD_HEIGHT + (count > 0 ? GAP_SIZE : 0);
        if (usedHeight + cardHeight > contentAvailableHeight) {
          logger.info("Break at count: " + count + " usedHeight: " + usedHeight + " cardHeight: " + cardHeight, "Account");
          break;
        }
        usedHeight += cardHeight;
        count++;
      }

      // 至少显示1个
      const newCount = Math.max(1, count);
      logger.info("Calculated items per page: " + newCount + " current: " + itemsPerPage, "Account");

      if (newCount !== itemsPerPage) {
        setItemsPerPage(newCount);
      }
    };

    // 初始计算（延迟一下确保 DOM 已渲染）
    const timer = setTimeout(calculateItemsPerPage, 100);

    // 监听窗口大小变化
    window.addEventListener("resize", calculateItemsPerPage);

    // 使用 ResizeObserver 监听父容器大小变化
    let resizeObserver: ResizeObserver | null = null;
    if (containerRef.current?.parentElement) {
      resizeObserver = new ResizeObserver(() => {
        calculateItemsPerPage();
      });
      resizeObserver.observe(containerRef.current.parentElement);
    }

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", calculateItemsPerPage);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, []); // 移除 itemsPerPage 依赖，避免循环

  // 获取当前页的账户
  const getCurrentPageAccounts = (): Account[] => {
    logger.info("getCurrentPageAccounts - total: " + accounts.length + " sorted: " + sortedAccounts.length + " currentPage: " + currentPage + " itemsPerPage: " + itemsPerPage, "Account");
    if (accounts.length === 0) return [];
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const result = sortedAccounts.slice(startIndex, endIndex);
    logger.info("getCurrentPageAccounts - returning: " + result.length + " accounts", "Account");
    return result;
  };

  const totalPages = Math.ceil(accounts.length / itemsPerPage);
  const currentPageAccounts = getCurrentPageAccounts();

  // 当账户列表或每页数量变化时，重置到第一页
  useEffect(() => {
    setCurrentPage(1);
  }, [accounts.length, itemsPerPage]);

  // 使用 ResizeObserver 动态计算每页显示数量

  // 渲染骨架屏
  const renderSkeleton = () => {
    // 如果在刷新状态且有预期数量，使用预期数量；否则使用当前计算的每页数量
    const skeletonCount =
      isRefreshing && expectedAccountCount > 0
        ? Math.min(expectedAccountCount, itemsPerPage)
        : itemsPerPage;

    return (
      <div className="space-y-[5px]">
        {[...Array(skeletonCount)].map((_, index) => (
          <Card
            key={index}
            className="p-4 bg-content1 border border-separator/60"
            style={{ height: `${CARD_HEIGHT}px` }}
          >
            <div className="flex items-center gap-4 h-full">
              <Skeleton className="w-12 h-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="w-32 h-4 rounded-lg bg-gradient-to-r from-default-200 to-default-100 animate-pulse" />
                <Skeleton className="w-24 h-3 rounded-lg bg-gradient-to-r from-default-200 to-default-100 animate-pulse" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="w-20 h-8 rounded-lg bg-gradient-to-r from-default-200 to-default-100 animate-pulse" />
                <Skeleton className="w-20 h-8 rounded-lg bg-gradient-to-r from-default-200 to-default-100 animate-pulse" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12 relative">
      {/* 全局 Alert - 浮动覆盖 */}
      {globalAlert && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-slide-down">
          <Alert
            status={globalAlert.type}
            className="shadow-lg min-w-[300px] max-w-[500px] rounded-xl"
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
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground tracking-tight">
            {t("settings.account.title")}
          </h1>
          <p className="text-muted/80 mt-1.5">{t("settings.account.subtitle")}</p>
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
        <div className="text-sm text-muted/60">
          {t("settings.account.last_refresh")}:{" "}
          {lastRefreshTime.toLocaleString(
            i18n.language === "zh" ? "zh-CN" : "en-US",
          )}
        </div>
      )}

      {/* Accounts List */}
      {isLoading || isRefreshing ? (
        <div className="flex flex-col flex-1">
          <Card className="border border-separator/80 p-0 flex flex-col">
            <div
              ref={containerRef}
              className="relative px-[15px] py-[15px] space-y-[5px]"
            >
              {renderSkeleton()}
            </div>

            {/* Card footer: pagination (disabled during refresh) */}
            <div className="border-t border-separator/60 px-3 py-3 w-full">
              <div className="flex items-center justify-center w-full gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  isDisabled={true}
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
                    total={Math.max(
                      1,
                      Math.ceil(expectedAccountCount / itemsPerPage) || 1,
                    )}
                    page={1}
                    onChange={() => {}}
                    showControls={false}
                  />
                  {/* keep pagination for screen reader compatibility (visually hidden) */}
                  <div className="sr-only" aria-hidden="true">
                    <span>{totalPages} {i18n.language === "zh" ? "页" : "pages"}</span>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  isDisabled={true}
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
        <div className="flex flex-col flex-1">
          {/* 账户卡片区域 - 带外框 */}
          <Card className="shadow-sm border-2 border-separator p-0 flex flex-col">
            <div
              ref={containerRef}
              className="relative px-[15px] py-[15px] space-y-[5px]"
            >
              {currentPageAccounts.map((account) => {
                const isSelected = account.id === currentAccountId;
                const isPreviousActive = account.id === previousAccountId;

                // 判断账户是否有错误状态
                const hasErrorStatus =
                  account.syncStatus === "HYTOKEN_EXPIRED" ||
                  account.syncStatus === "FAILED";

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

                // 根据状态决定边框颜色
                let borderColorClass =
                  "border-separator hover:border-content3/50";
                let shadowClass = "shadow-md hover:shadow-lg";
                let statusDotTone: StatusDotTone | null = null;
                if (isSelected && !hasErrorStatus) {
                  borderColorClass = "border-success";
                  shadowClass = "shadow-xl";
                  statusDotTone = "success";
                } else if (isSelected && hasErrorStatus) {
                  statusDotTone =
                    account.syncStatus === "HYTOKEN_EXPIRED"
                      ? "danger"
                      : "warning";
                  borderColorClass =
                    account.syncStatus === "HYTOKEN_EXPIRED"
                      ? "border-danger"
                      : "border-warning";
                  shadowClass = "shadow-xl";
                } else if (!isSelected && !hasErrorStatus) {
                  statusDotTone = "default";
                }

                // 状态徽章 - 错误状态优先级高于 ACTIVE/AVAILABLE
                const statusBadgeConfig: StatusConfig | null =
                  account.syncStatus === "HYTOKEN_EXPIRED"
                    ? SYNC_STATUS_META.HYTOKEN_EXPIRED
                    : account.syncStatus === "FAILED"
                      ? SYNC_STATUS_META.FAILED
                      : isSelected
                        ? { tone: "success", label: "ACTIVE" }
                        : { tone: "default", label: "AVAILABLE" };

                return (
                  <Card
                    key={account.id}
                    data-account-card="true"
                    className={`cursor-pointer transition-all duration-300 ease-in-out bg-content1 ${borderColorClass} ${shadowClass} border-2 box-border ${animationClass}`}
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
                          {/* LED 指示灯 - 根据状态显示不同颜色 */}
                          {statusDotTone && (
                            <StatusDot
                              tone={statusDotTone}
                              ping={isSelected}
                            />
                          )}

                          {/* Avatar */}
                          <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-base font-bold text-primary flex-shrink-0 overflow-hidden">
                                {account.avatar ? (
                                <Img
                                  src={account.avatar}
                                alt={account.nickname}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display =
                                    "none";
                                  const parent = (e.target as HTMLImageElement)
                                    .parentElement;
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
                          {statusBadgeConfig && (
                            <StatusBadge config={statusBadgeConfig} />
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

            {/* Card footer: pagination */}
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
                  {/* keep pagination for screen reader compatibility (visually hidden) */}
                  <div className="sr-only" aria-hidden="true">
                    <span>{totalPages} {i18n.language === "zh" ? "页" : "pages"}</span>
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
              {/* 凭证失效警告 - 只显示红色警告框 */}
              {selectedAccount.syncStatus === "HYTOKEN_EXPIRED" ? (
                <div className="text-center py-8 border-2 border-danger rounded-lg bg-danger/10 dark:bg-danger/20">
                  <p className="text-5xl font-black text-danger tracking-wider mb-4">
                    EXPIRED
                  </p>
                  <div className="space-y-2 text-left px-4">
                    <div>
                      <p className="text-xs italic text-muted mb-1">Hytoken:</p>
                      <p className="text-xs font-mono text-danger break-all">
                        {selectedAccount.token || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs italic text-muted mb-1">Cred:</p>
                      <p className="text-xs font-mono text-danger break-all">
                        {selectedAccount.cred || "N/A"}
                      </p>
                    </div>
                  </div>
                  <div className="text-left px-4 mt-2">
                    <p className="text-xs italic text-muted">
                      *{" "}
                      {i18n.language === "zh"
                        ? "Hytoken过期，我们无法刷新令牌，请重新登录。"
                        : "Hytoken expired, we cannot refresh the token. Please log in again."}
                    </p>
                  </div>
                </div>
              ) : selectedAccount.syncStatus === "FAILED" ? (
                <div className="text-center py-8 border-2 border-warning rounded-lg bg-warning/10 dark:bg-warning/20">
                  <p className="text-5xl font-black text-warning tracking-wider mb-4">
                    SYNC FAILED
                  </p>
                  <div className="text-left px-4 mt-2">
                    <p className="text-xs italic text-muted">
                      *{" "}
                      {i18n.language === "zh"
                        ? "我们未能同步角色信息，请检查网络连接后重试"
                        : "We failed to sync role information, please check your network connection and try again"}
                    </p>
                  </div>
                  {/* 重试按钮 */}
                  <Button
                    variant="secondary"
                    onPress={() => retrySyncAccount(selectedAccount.id)}
                    isDisabled={isRefreshing}
                    className="mt-4 text-warning"
                  >
                    {isRefreshing ? (
                      <>
                        <Spinner size="sm" color="current" />
                        {i18n.language === "zh" ? "重试中..." : "Retrying..."}
                      </>
                    ) : (
                      <>
                        ↻ {i18n.language === "zh" ? "重试同步" : "Retry Sync"}
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                /* 正常账户信息 */
                <>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-2xl font-bold text-primary overflow-hidden">
                        {selectedAccount.avatar ? (
                          <Img
                            src={selectedAccount.avatar}
                          alt={selectedAccount.nickname}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
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
                      <p className="text-sm text-muted">
                        ID: {selectedAccount.id}
                      </p>
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
                </>
              )}
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
        <CustomModalBody
          className={
            loginMethod === "qrcode" && showOtpInput ? "overflow-hidden" : ""
          }
        >
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
                          ? "border-[3px] border-success bg-success/10 dark:bg-success/20 shadow-md"
                          : "border-2 border-separator hover:border-success/50 hover:shadow-sm hover:bg-content2 dark:hover:bg-content2/50"
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
                              <Img
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
                              {resolveServerLabel(role.serverId, i18n.language)}
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
              <div className="grid grid-cols-[auto_1fr] items-center gap-y-4 gap-x-3">
                {/* 手机号输入行 */}
                <label className="text-sm font-medium text-foreground whitespace-nowrap justify-self-end">
                  {t("settings.account.phone_number")}
                </label>
                <div className="flex flex-col gap-1">
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
                    className="w-full px-4 py-2.5 bg-default-100 border border-separator rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  />
                  {phoneError && (
                    <p className="text-xs text-danger">{phoneError}</p>
                  )}
                </div>

                {/* 密码输入行 */}
                <label className="text-sm font-medium text-foreground whitespace-nowrap justify-self-end">
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
            // 验证码登录表单
            <div className="space-y-4">
              <button
                onClick={() => {
                  setLoginMethod(null);
                  setShowOtpInput(false);
                  setIsOtpInvalid(false);
                }}
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

              {!showOtpInput ? (
                // 第一步：输入手机号
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-[auto_1fr] items-center gap-y-4 gap-x-3">
                    <label className="text-sm font-medium text-foreground whitespace-nowrap justify-self-end">
                      {t("settings.account.phone_number")}
                    </label>
                    <div className="flex flex-col gap-1">
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
                            handleSendCodeAndShowOtp();
                          }
                        }}
                        className="w-full px-4 py-2.5 bg-default-100 border border-separator rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                      />
                      {phoneError && (
                        <p className="text-xs text-danger">{phoneError}</p>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    onPress={handleSendCodeAndShowOtp}
                    isDisabled={isSendingCode || !phone}
                    className="w-full mt-2"
                  >
                    {isSendingCode ? (
                      <>
                        <Spinner color="current" size="sm" />
                        {t("settings.account.sending")}
                      </>
                    ) : (
                      t("settings.account.confirm")
                    )}
                  </Button>
                </div>
              ) : (
                // 第二步：输入验证码
                <div className="flex w-full flex-col gap-2">
                  <div className="flex flex-col gap-1">
                    <Label>
                      {i18n.language === "zh" ? "验证账户" : "Verify account"}
                    </Label>
                    <p className="text-sm text-muted">
                      {i18n.language === "zh"
                        ? `我们已向 ${phone} 发送验证码`
                        : `We've sent a code to ${phone}`}
                    </p>
                  </div>

                  <InputOTP
                    aria-describedby={isOtpInvalid ? "code-error" : undefined}
                    isInvalid={isOtpInvalid}
                    maxLength={6}
                    value={verificationCode}
                    onComplete={async (code) => {
                      logger.info("Code complete: " + code, "Account");
                      // 自动提交验证码
                      await handleLogin();
                    }}
                    onChange={(val) => {
                      setVerificationCode(val);
                      setIsOtpInvalid(false);
                      // 当用户输入验证码时，清除发送成功的提示
                      if (codeSentSuccess) {
                        setCodeSentSuccess(false);
                      }
                    }}
                  >
                    <InputOTP.Group>
                      <InputOTP.Slot index={0} />
                      <InputOTP.Slot index={1} />
                      <InputOTP.Slot index={2} />
                    </InputOTP.Group>
                    <InputOTP.Separator />
                    <InputOTP.Group>
                      <InputOTP.Slot index={3} />
                      <InputOTP.Slot index={4} />
                      <InputOTP.Slot index={5} />
                    </InputOTP.Group>
                  </InputOTP>

                  {isOtpInvalid && (
                    <span
                      className="field-error"
                      data-visible={isOtpInvalid}
                      id="code-error"
                    >
                      {i18n.language === "zh"
                        ? "验证码无效，请重试"
                        : "Invalid code. Please try again."}
                    </span>
                  )}

                  <div className="flex items-center justify-between px-1 pt-1">
                    <div className="flex items-center gap-[5px]">
                      <p className="text-sm text-muted">
                        {i18n.language === "zh"
                          ? "没收到验证码？"
                          : "Didn't receive a code?"}
                      </p>
                      <Link
                        className="text-foreground underline cursor-pointer"
                        onPress={async () => {
                          if (countdown > 0) {
                            alert(
                              i18n.language === "zh"
                                ? `请等待 ${countdown} 秒`
                                : `Wait ${countdown}s`,
                            );
                            return;
                          }

                          // 重新发送验证码
                          try {
                            const success = await sendVerificationCode({
                              phone,
                              type: 2,
                            });
                            if (success) {
                              alert(
                                i18n.language === "zh"
                                  ? "已重新发送"
                                  : "Resent",
                              );
                              // 重置倒计时
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
                            } else {
                              alert(
                                i18n.language === "zh" ? "发送失败" : "Failed",
                              );
                            }
                          } catch (error) {
                            alert(
                              i18n.language === "zh" ? "发送出错" : "Error",
                            );
                          }
                        }}
                      >
                        {i18n.language === "zh" ? "重新发送" : "Resend"}
                      </Link>
                    </div>

                    {/* 返回手机号输入按钮 */}
                    <button
                      onClick={() => {
                        setShowOtpInput(false);
                        setVerificationCode("");
                        setIsOtpInvalid(false);
                      }}
                      className="text-sm text-muted hover:text-foreground transition-colors underline"
                    >
                      {i18n.language === "zh" ? "修改手机号" : "Change phone"}
                    </button>
                  </div>
                </div>
              )}
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
          ) : loginMethod === "phone" ? (
            // 密码登录显示确认按钮
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
          ) : loginMethod === "qrcode" ? (
            // 验证码登录显示返回按钮
            <>
              <Button
                variant="outline"
                onPress={() => {
                  if (showOtpInput) {
                    // 如果在 OTP 输入阶段，返回手机号输入
                    setShowOtpInput(false);
                    setVerificationCode("");
                    setIsOtpInvalid(false);
                  } else {
                    // 否则返回登录方式选择
                    setLoginMethod(null);
                  }
                }}
              >
                {t("settings.account.back")}
              </Button>
            </>
          ) : null}
        </CustomModalFooter>
      </CustomModal>
    </div>
  );
}
