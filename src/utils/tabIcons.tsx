import React from 'react';
import type { IconSvgProps } from '@/types';
import {
  HomeIcon,
  ChartIcon,
  UsersIcon,
  StarIcon,
  HeartFilledIcon,
  BookmarkIcon,
  TagIcon,
  FolderIcon,
  CalendarIcon,
  BellIcon,
  SettingsIcon,
  AccountIcon,
  SearchIcon,
  DeveloperIcon,
  ProjectsIcon,
} from '@/components/icons';

export const TAB_ICON_MAP: Record<string, React.FC<IconSvgProps>> = {
  home: HomeIcon,
  chart: ChartIcon,
  users: UsersIcon,
  star: StarIcon,
  heart: HeartFilledIcon,
  bookmark: BookmarkIcon,
  tag: TagIcon,
  folder: FolderIcon,
  calendar: CalendarIcon,
  bell: BellIcon,
  settings: SettingsIcon,
  account: AccountIcon,
  search: SearchIcon,
  developer: DeveloperIcon,
  projects: ProjectsIcon,
};

export const ICON_LABELS: Record<string, { zh: string; en: string }> = {
  home: { zh: '首页', en: 'Home' },
  chart: { zh: '图表', en: 'Chart' },
  users: { zh: '用户', en: 'Users' },
  star: { zh: '星标', en: 'Star' },
  heart: { zh: '收藏', en: 'Heart' },
  bookmark: { zh: '书签', en: 'Bookmark' },
  tag: { zh: '标签', en: 'Tag' },
  folder: { zh: '文件夹', en: 'Folder' },
  calendar: { zh: '日历', en: 'Calendar' },
  bell: { zh: '通知', en: 'Bell' },
  settings: { zh: '设置', en: 'Settings' },
  account: { zh: '账户', en: 'Account' },
  search: { zh: '搜索', en: 'Search' },
  developer: { zh: '开发', en: 'Developer' },
  projects: { zh: '项目', en: 'Projects' },
};

export function getTabIcon(iconKey: string): React.FC<IconSvgProps> {
  return TAB_ICON_MAP[iconKey] ?? HomeIcon;
}

export function getIconLabel(iconKey: string, lang: string): string {
  return ICON_LABELS[iconKey]?.[lang as 'zh' | 'en'] ?? iconKey;
}
