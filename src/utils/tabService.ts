import { getConfig, setConfig, removeConfig } from './configService';
import { DashboardTab } from '@/types/dashboard';
import { v4 as uuidv4 } from 'uuid';

const TABS_KEY = 'dashboard_tabs';
const ACTIVE_TAB_KEY = 'dashboard_active_tab';

export async function getAllTabs(): Promise<DashboardTab[]> {
  const tabs = await getConfig<DashboardTab[]>(TABS_KEY);
  return tabs ?? [];
}

export async function saveTabs(tabs: DashboardTab[]): Promise<void> {
  await setConfig(TABS_KEY, tabs);
}

export async function getActiveTabId(): Promise<string | null> {
  const id = await getConfig<string>(ACTIVE_TAB_KEY);
  return id ?? null;
}

export async function setActiveTabId(tabId: string | null): Promise<void> {
  if (tabId) {
    await setConfig(ACTIVE_TAB_KEY, tabId);
  } else {
    await removeConfig(ACTIVE_TAB_KEY);
  }
}

export async function addTab(
  name: string,
  icon: string,
  tags: string[] = [],
  defaultRoleId?: string,
): Promise<DashboardTab> {
  const tabs = await getAllTabs();
  const now = Date.now();
  const newTab: DashboardTab = {
    id: uuidv4(),
    name,
    icon,
    tags,
    cards: [],
    defaultRoleId,
    createdAt: now,
    updatedAt: now,
  };
  tabs.push(newTab);
  await saveTabs(tabs);
  return newTab;
}

export async function removeTab(tabId: string): Promise<void> {
  const tabs = await getAllTabs();
  const filtered = tabs.filter((t) => t.id !== tabId);
  await saveTabs(filtered);
  const activeId = await getActiveTabId();
  if (activeId === tabId) {
    await setActiveTabId(null);
  }
}

export async function updateTab(
  tabId: string,
  updates: Partial<Pick<DashboardTab, 'name' | 'icon' | 'tags' | 'defaultRoleId'>>,
): Promise<void> {
  const tabs = await getAllTabs();
  const index = tabs.findIndex((t) => t.id === tabId);
  if (index === -1) return;
  tabs[index] = {
    ...tabs[index],
    ...updates,
    updatedAt: Date.now(),
  };
  await saveTabs(tabs);
}
