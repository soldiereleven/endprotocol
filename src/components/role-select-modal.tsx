import { GlassButton, GlassCard, GlassCheckbox, GlassSkeleton } from "@/components/ui/glass";
import {
  CustomModal,
  CustomModalHeader,
  CustomModalBody,
  CustomModalFooter,
} from "@/components/custom-modal";
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import { Img } from "@/utils/imageLoader";
import logger from "@/utils/logger";

interface RoleDisplayInfo {
  roleId: string;
  userId: string;
  serverId: string;
  nickname: string;
  level: number;
  avatarUrl: string;
}

interface RoleSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  roles: RoleDisplayInfo[];
  cred: string;
  token: string;
  userId: string;
  onSuccess: () => void;
}

export default function RoleSelectModal({
  isOpen,
  onClose,
  roles,
  cred,
  token,
  userId,
  onSuccess,
}: RoleSelectModalProps) {
  const { t, i18n } = useTranslation();
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 当 modal 打开时，重置选择
  useEffect(() => {
    if (isOpen) {
      setSelectedRoles([]);
    }
  }, [isOpen]);

  const handleRoleToggle = (roleId: string) => {
    setSelectedRoles((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId],
    );
  };

  const handleConfirm = async () => {
    if (selectedRoles.length === 0) {
      alert(
        i18n.language === "zh"
          ? "请至少选择一个角色"
          : "Please select at least one role",
      );
      return;
    }

    setIsLoading(true);
    try {
      // 获取选中角色的完整信息
      const selectedRoleDetails = roles.filter((role) =>
        selectedRoles.includes(role.roleId),
      );

      // 调用后端保存
      await invoke("save_selected_roles", {
        cred,
        token,
        userId,
        selectedRoles: selectedRoleDetails,
      });

      onSuccess();
      onClose();
    } catch (error) {
      logger.error("Failed to save roles: " + error, "RoleSelect");
      alert(`${i18n.language === "zh" ? "保存失败" : "Save failed"}: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <CustomModal isOpen={isOpen} onClose={onClose} size="xl">
      <CustomModalHeader onClose={onClose}>
        {t("role_select.title")}
      </CustomModalHeader>
      <CustomModalBody>
        {roles.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            {t("role_select.no_roles_found")}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {roles.map((role) => (
              <GlassCard
                key={role.roleId}
                isPressable
                onPress={() => handleRoleToggle(role.roleId)}
                className={`cursor-pointer transition-all ${
                  selectedRoles.includes(role.roleId)
                    ? "border-2 border-primary"
                    : "border-2 border-transparent"
                }`}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <GlassCheckbox
                      isSelected={selectedRoles.includes(role.roleId)}
                      onChange={() => handleRoleToggle(role.roleId)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 rounded-lg overflow-hidden">
                          {role.avatarUrl ? (
                            <Img
                              src={role.avatarUrl}
                              alt={role.nickname}
                              className="w-full h-full avatar-feather"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  "/tauri.svg";
                              }}
                            />
                          ) : (
                            <GlassSkeleton className="w-full h-full rounded-lg" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">
                            {role.nickname || t("role_select.unknown_role")}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {t("role_select.level")}: {role.level}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400">
                        {t("role_select.server")}: {role.serverId}
                      </p>
                    </div>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </CustomModalBody>
      <CustomModalFooter>
        <GlassButton variant="outline" onPress={onClose}>
          {t("role_select.cancel")}
        </GlassButton>
        <GlassButton
          variant="primary"
          onPress={handleConfirm}
          isDisabled={selectedRoles.length === 0 || isLoading}
        >
          {isLoading
            ? i18n.language === "zh"
              ? "加载中..."
              : "Loading..."
            : t("role_select.confirm_selection", {
                count: selectedRoles.length,
              })}
        </GlassButton>
      </CustomModalFooter>
    </CustomModal>
  );
}
