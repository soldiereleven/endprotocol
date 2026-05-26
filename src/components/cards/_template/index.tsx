import { BaseCardProps } from "../registry/types";
import { CardWrapper } from "../base/card-wrapper";
import { useCardData } from "../base/use-card-data";
import { useTranslation } from "react-i18next";
import { Card } from "@heroui/react";
import logger from "@/utils/logger";

/**
 * 示例卡片组件
 *
 * 这是一个模板文件，复制此目录并修改以创建新卡片。
 *
 * 开发步骤：
 * 1. 复制整个 _template 目录为新名称（如 my-card）
 * 2. 重命名 meta.json 文件（如 my-card.meta.json）
 * 3. 修改 meta.json 中的 id、name、description 等字段
 * 4. 在此文件中实现你的卡片逻辑
 * 5. 删除此注释和模板代码
 */
export default function TemplateCard({
  roleId,
  cardId,
  settings,
  isEditMode,
}: BaseCardProps) {
  const { t } = useTranslation();

  // 示例：使用通用数据加载 Hook
  const { data, isLoading, error } = useCardData({
    fetchData: async () => {
      // TODO: 替换为你的数据获取逻辑
      logger.info("Loading data for role: " + roleId, "TemplateCard");

      // 模拟 API 调用
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            message: "Template Card Data",
            timestamp: Date.now(),
          });
        }, 500);
      });
    },
    lazy: false, // 设置为 true 可启用懒加载
  });

  // 示例：从 settings 读取配置
  const customSetting = settings.customKey || "default value";

  // 加载状态
  if (isLoading) {
    return (
      <Card className="p-6 bg-content1 shadow-sm border border-separator h-full w-full">
        <div className="space-y-4">
          <div className="h-5 bg-default-200 rounded w-1/2 animate-pulse"></div>
          <div className="h-20 bg-default-200 rounded animate-pulse"></div>
        </div>
      </Card>
    );
  }

  // 错误状态
  if (error) {
    return (
      <Card className="p-6 bg-content1 shadow-sm border border-separator">
        <p className="text-danger text-center">
          {t("common.load_error") || "加载失败"}
        </p>
      </Card>
    );
  }

  // 正常渲染
  return (
    <Card className="p-6 bg-content1 shadow-sm border border-separator h-full w-full">
      <div className="space-y-4">
        <h3 className="font-semibold text-foreground text-base">
          {t("template_card.title") || "Template Card"}
        </h3>

        <div className="text-sm text-muted">
          <p>Role ID: {roleId}</p>
          <p>Card ID: {cardId}</p>
          <p>Custom Setting: {String(customSetting)}</p>
        </div>

        {!isEditMode && (
          <div className="text-xs text-default-400 mt-4">
            {t("template_card.hint") || "Click to interact"}
          </div>
        )}
      </div>
    </Card>
  );
}
