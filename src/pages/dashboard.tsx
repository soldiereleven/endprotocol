import { Card, Button } from "@heroui/react";
import { useTranslation } from "react-i18next";

export default function DashboardPage() {
  const { t } = useTranslation();

  const stats = [
    {
      title: t("common.totalRevenue"),
      value: "$45,231.89",
      change: "+20.1%",
      changeType: "positive",
    },
    {
      title: t("common.activeUsers"),
      value: "2,350",
      change: "+180.1%",
      changeType: "positive",
    },
    {
      title: t("common.sales"),
      value: "+12,234",
      change: "+19%",
      changeType: "positive",
    },
    {
      title: t("common.activeNow"),
      value: "+573",
      change: "+201",
      changeType: "positive",
    },
  ];

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header Section */}
      <div
        id="dashboard-header"
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
            {t("nav.dashboard")}
          </h1>
          <p className="text-muted mt-1">{t("common.welcome")}</p>
        </div>
        <Button variant="primary" size="lg">
          {t("common.createProject")}
        </Button>
      </div>

      {/* Stats Cards Grid */}
      <div
        id="dashboard-stats"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
      >
        {stats.map((stat, index) => (
          <Card
            key={index}
            className="bg-content1 p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <p className="text-sm text-muted font-medium">{stat.title}</p>
            <p className="text-3xl font-bold mt-2 text-foreground">
              {stat.value}
            </p>
            <div className="flex items-center mt-2">
              <span
                className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  stat.changeType === "positive"
                    ? "bg-success/10 text-success"
                    : "bg-danger/10 text-danger"
                }`}
              >
                {stat.change}
              </span>
              <span className="text-xs text-muted ml-2">
                {t("common.fromLastMonth")}
              </span>
            </div>
          </Card>
        ))}
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column - Activity & Quick Actions */}
        <div className="xl:col-span-2 space-y-6">
          {/* Recent Activity */}
          <Card id="dashboard-activity" className="bg-content1 shadow-sm">
            <div className="p-5 border-b border-separator flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {t("common.recentActivity")}
              </h2>
              <Button size="sm" variant="ghost">
                {t("common.viewReports")}
              </Button>
            </div>
            <div className="p-5">
              <div className="space-y-5">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="flex items-start gap-4 group">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2.5 group-hover:scale-125 transition-transform" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">
                        New user registered successfully
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        2 hours ago • by System
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Recent Projects Table */}
          <Card id="dashboard-projects" className="bg-content1 shadow-sm">
            <div className="p-5 border-b border-separator">
              <h2 className="text-lg font-semibold">
                {t("common.recentProjects")}
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-default-50">
                  <tr>
                    <th className="text-left py-3 px-5 text-xs font-semibold text-muted uppercase tracking-wider">
                      {t("common.project")}
                    </th>
                    <th className="text-left py-3 px-5 text-xs font-semibold text-muted uppercase tracking-wider">
                      {t("common.status")}
                    </th>
                    <th className="text-left py-3 px-5 text-xs font-semibold text-muted uppercase tracking-wider">
                      {t("common.progress")}
                    </th>
                    <th className="text-left py-3 px-5 text-xs font-semibold text-muted uppercase tracking-wider">
                      {t("common.teamMembers")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-separator">
                  {[1, 2, 3].map((item) => (
                    <tr
                      key={item}
                      className="hover:bg-default-50/50 transition-colors"
                    >
                      <td className="py-4 px-5">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {t("common.project")} {item}
                          </p>
                          <p className="text-xs text-muted mt-0.5">
                            {t("common.descriptionHere")}
                          </p>
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-success/10 text-success border border-success/20">
                          {t("common.active")}
                        </span>
                      </td>
                      <td className="py-4 px-5 w-48">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-default-200 rounded-full h-1.5">
                            <div
                              className="bg-primary h-1.5 rounded-full transition-all duration-500"
                              style={{ width: `${Math.random() * 100}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-muted">
                            {Math.floor(Math.random() * 100)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-5">
                        <div className="flex -space-x-2">
                          {[1, 2, 3].map((member) => (
                            <div
                              key={member}
                              className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary-600 border-2 border-background flex items-center justify-center text-xs font-bold text-primary-foreground shadow-sm"
                            >
                              U{member}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Right Column - Quick Actions & Info */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card id="dashboard-quick-actions" className="bg-content1 shadow-sm">
            <div className="p-5 border-b border-separator">
              <h2 className="text-lg font-semibold">
                {t("common.quickActions")}
              </h2>
            </div>
            <div className="p-5 space-y-3">
              <Button className="w-full justify-start" variant="secondary">
                <span className="mr-2">+</span> {t("common.startNewProject")}
              </Button>
              <Button className="w-full justify-start" variant="tertiary">
                <span className="mr-2">+</span> {t("common.inviteSomeone")}
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <span className="mr-2">📊</span> {t("common.analyticsInsights")}
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <span className="mr-2">⚙️</span> {t("common.managePreferences")}
              </Button>
            </div>
          </Card>

          {/* System Status / Info Card */}
          <Card className="bg-gradient-to-br from-primary/10 to-secondary/10 border border-primary/20">
            <div className="p-5">
              <h3 className="font-semibold text-foreground mb-2">
                System Status
              </h3>
              <p className="text-sm text-muted mb-4">
                All systems are running smoothly. Last check: 5 mins ago.
              </p>
              <div className="flex items-center gap-2 text-success text-sm font-medium">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                Operational
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
