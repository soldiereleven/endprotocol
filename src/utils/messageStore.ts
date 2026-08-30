export type MessageType = "info" | "warn" | "urgent";

export interface AppMessageAction {
  label: string;
  onClick: () => void | Promise<void>;
  variant?: "primary" | "secondary" | "danger";
  loadingLabel?: string;
}

export interface AppMessage {
  id: string;
  type: MessageType;
  title: string;
  body?: string;
  timestamp: number;
  read: boolean;
  tag?: string;
  actions?: AppMessageAction[];
  dismissable?: boolean;
  progress?: number;
}

const STORAGE_KEY = "app_messages";
const MAX_MESSAGES = 80;

let messages: AppMessage[] = [];
let listeners: Array<() => void> = [];

function emit() {
  listeners.forEach((fn) => fn());
  window.dispatchEvent(new CustomEvent("messagesChanged"));
}

function persist() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(0, MAX_MESSAGES)));
  } catch {}
}

function load(): AppMessage[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const LEGACY = new Set(["success", "error", "warning"]);
        const migrated = parsed.filter((m: any) => m && typeof m.type === "string");
        if (migrated.some((m: any) => LEGACY.has(m.type))) {
          sessionStorage.removeItem(STORAGE_KEY);
          return [];
        }
        return migrated;
      }
    }
  } catch {}
  return [];
}

export function getMessages(): AppMessage[] {
  if (messages.length === 0) messages = load();
  return messages;
}

export function getUnreadCount(): number {
  return getMessages().filter((m) => !m.read).length;
}

export function hasUrgentUnread(): boolean {
  return getMessages().some((m) => !m.read && m.type === "urgent");
}

export function addMessage(
  msg: Omit<AppMessage, "id" | "timestamp" | "read"> & { read?: boolean },
): AppMessage {
  const entry: AppMessage = {
    ...msg,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    read: msg.read ?? false,
    dismissable: msg.dismissable ?? true,
  };
  // Deduplicate by tag: remove existing message with same tag
  if (entry.tag) {
    messages = messages.filter((m) => m.tag !== entry.tag);
  }
  messages = [entry, ...messages].slice(0, MAX_MESSAGES);
  persist();
  emit();
  return entry;
}

export function updateMessage(
  id: string,
  updates: Partial<Pick<AppMessage, "title" | "body" | "type" | "actions" | "progress">>,
) {
  messages = messages.map((m) => (m.id === id ? { ...m, ...updates } : m));
  persist();
  emit();
}

export function markRead(id: string) {
  messages = messages.map((m) => (m.id === id ? { ...m, read: true } : m));
  persist();
  emit();
}

export function markAllRead() {
  messages = messages.map((m) => ({ ...m, read: true }));
  persist();
  emit();
}

export function clearMessages() {
  messages = [];
  persist();
  emit();
}

export function removeMessage(id: string) {
  messages = messages.filter((m) => m.id !== id);
  persist();
  emit();
}

export function removeMessagesByTag(tag: string) {
  messages = messages.filter((m) => m.tag !== tag);
  persist();
  emit();
}

export function subscribeMessages(fn: () => void): () => void {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}
