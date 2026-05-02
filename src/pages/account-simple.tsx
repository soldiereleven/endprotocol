import { useTranslation } from "react-i18next";
import { Card, Button } from "@heroui/react";

export default function AccountPage() {
  const { t, i18n } = useTranslation();

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
          <Button variant="outline">
            {t("settings.account.refresh_data")}
          </Button>
          <Button variant="primary">{t("settings.account.add_account")}</Button>
        </div>
      </div>

      {/* Content */}
      <Card className="p-6 bg-content1 shadow-sm">
        <div className="text-center py-12">
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
    </div>
  );
}
