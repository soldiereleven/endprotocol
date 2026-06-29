import { getConfig, setConfig } from "@/utils/configService";
import { logInfo, logError } from "@/utils/logger";

type StartupHandler = (roleId: string) => Promise<void>;
type StatusListener = (status: { status: "pending" | "running" | "done" | "error"; error?: string }) => void;
type AutoSignListener = (roleId: string, enabled: boolean) => void;

const AUTO_SIGN_KEY = "card_auto_sign_users";
const MAPPING_KEY = "card_user_mapping";

const handlers = new Map<string, StartupHandler>();
const taskStatuses = new Map<string, { status: "pending" | "running" | "done" | "error"; error?: string }>();
const statusListeners = new Map<string, Set<StatusListener>>();
const autoSignListeners = new Set<AutoSignListener>();

function notifyStatusChange(roleId: string) {
  const status = taskStatuses.get(roleId);
  if (!status) return;
  const listeners = statusListeners.get(roleId);
  if (listeners) {
    listeners.forEach((fn) => fn(status));
  }
}

export const CardStartupService = {
  register(cardType: string, handler: StartupHandler) {
    handlers.set(cardType, handler);
    logInfo(`[Startup] Registered handler for card type: ${cardType}`, undefined, "StartupService");
  },

  async getAutoSignUsers(): Promise<string[]> {
    try {
      const list = await getConfig<string[]>(AUTO_SIGN_KEY);
      return list ?? [];
    } catch {
      return [];
    }
  },

  async isAutoSignEnabled(roleId: string): Promise<boolean> {
    const list = await this.getAutoSignUsers();
    return list.includes(roleId);
  },

  async addAutoSignUser(roleId: string) {
    const list = await this.getAutoSignUsers();
    if (list.includes(roleId)) return;
    list.push(roleId);
    await setConfig(AUTO_SIGN_KEY, list);
    autoSignListeners.forEach((fn) => fn(roleId, true));
    logInfo(`[Startup] Added auto-sign user: ${roleId}`, undefined, "StartupService");
  },

  async removeAutoSignUser(roleId: string) {
    const list = await this.getAutoSignUsers();
    const filtered = list.filter((id) => id !== roleId);
    if (filtered.length === list.length) return;
    await setConfig(AUTO_SIGN_KEY, filtered);
    autoSignListeners.forEach((fn) => fn(roleId, false));
    logInfo(`[Startup] Removed auto-sign user: ${roleId}`, undefined, "StartupService");
  },

  onAutoSignChanged(listener: AutoSignListener): () => void {
    autoSignListeners.add(listener);
    return () => { autoSignListeners.delete(listener); };
  },

  async updateUserMapping(cardId: string, newRoleId: string | undefined) {
    const mapping = await getConfig<Record<string, string[]>>(MAPPING_KEY) ?? {};
    for (const roleId of Object.keys(mapping)) {
      mapping[roleId] = mapping[roleId].filter((id) => id !== cardId);
      if (mapping[roleId].length === 0) delete mapping[roleId];
    }
    if (newRoleId) {
      if (!mapping[newRoleId]) mapping[newRoleId] = [];
      if (!mapping[newRoleId].includes(cardId)) {
        mapping[newRoleId].push(cardId);
      }
    }
    await setConfig(MAPPING_KEY, mapping);
  },

  async removeCardFromMapping(cardId: string) {
    const mapping = await getConfig<Record<string, string[]>>(MAPPING_KEY) ?? {};
    for (const roleId of Object.keys(mapping)) {
      mapping[roleId] = mapping[roleId].filter((id) => id !== cardId);
      if (mapping[roleId].length === 0) delete mapping[roleId];
    }
    await setConfig(MAPPING_KEY, mapping);
  },

  async getCardIdsByUser(roleId: string): Promise<string[]> {
    const mapping = await getConfig<Record<string, string[]>>(MAPPING_KEY) ?? {};
    return mapping[roleId] ?? [];
  },

  async runAll() {
    logInfo("[Startup] Running all startup tasks...", undefined, "StartupService");
    const roleIds = await this.getAutoSignUsers();
    if (roleIds.length === 0) {
      logInfo("[Startup] No auto-sign users found", undefined, "StartupService");
      return;
    }
    await Promise.all(
      roleIds.map(async (roleId) => {
        const handler = handlers.get("attendance");
        if (!handler) {
          logError("[Startup] No handler registered for attendance", undefined, "StartupService");
          taskStatuses.set(roleId, { status: "error", error: "No handler for attendance" });
          notifyStatusChange(roleId);
          return;
        }
        taskStatuses.set(roleId, { status: "running" });
        notifyStatusChange(roleId);
        try {
          await handler(roleId);
          taskStatuses.set(roleId, { status: "done" });
          logInfo(`[Startup] Attendance done for user: ${roleId}`, undefined, "StartupService");
        } catch (e: any) {
          taskStatuses.set(roleId, { status: "error", error: String(e) });
          logError(`[Startup] Attendance failed for user: ${roleId}`, e, "StartupService");
        }
        notifyStatusChange(roleId);
      }),
    );
    logInfo("[Startup] All startup tasks finished", undefined, "StartupService");
  },

  getTaskStatus(roleId: string): { status: "pending" | "running" | "done" | "error"; error?: string } | undefined {
    return taskStatuses.get(roleId);
  },

  subscribe(roleId: string, listener: StatusListener): () => void {
    if (!statusListeners.has(roleId)) {
      statusListeners.set(roleId, new Set());
    }
    statusListeners.get(roleId)!.add(listener);
    return () => {
      statusListeners.get(roleId)?.delete(listener);
    };
  },
};
