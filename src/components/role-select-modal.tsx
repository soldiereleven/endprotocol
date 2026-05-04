import { Button } from "@heroui/react";
import {
  CustomModal,
  CustomModalHeader,
  CustomModalBody,
  CustomModalFooter,
} from "@/components/custom-modal";
import { Card } from "@heroui/react";
import { Checkbox } from "@heroui/react";
import { Skeleton } from "@heroui/react";
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

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
      alert("请至少选择一个角色");
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
      console.error("Failed to save roles:", error);
      alert(`保存失败: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <CustomModal isOpen={isOpen} onClose={onClose} size="xl">
      <CustomModalHeader onClose={onClose}>选择要绑定的角色</CustomModalHeader>
      <CustomModalBody>
              {roles.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  未找到可用角色
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {roles.map((role) => (
                    <Card
                      key={role.roleId}
                      className={`cursor-pointer transition-all ${
                        selectedRoles.includes(role.roleId)
                          ? "border-2 border-primary"
                          : "border-2 border-transparent"
                      }`}
                      onPress={() => handleRoleToggle(role.roleId)}
                    >
                      <div className="p-4">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            isSelected={selectedRoles.includes(role.roleId)}
                            onChange={() => handleRoleToggle(role.roleId)}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-200">
                                {role.avatarUrl ? (
                                  <img
                                    src={role.avatarUrl}
                                    alt={role.nickname}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src =
                                        "/tauri.svg";
                                    }}
                                  />
                                ) : (
                                  <Skeleton className="w-full h-full rounded-full" />
                                )}
                              </div>
                              <div>
                                <h3 className="font-semibold text-lg">
                                  {role.nickname || "未知角色"}
                                </h3>
                                <p className="text-sm text-gray-500">
                                  等级: {role.level}
                                </p>
                              </div>
                            </div>
                            <p className="text-xs text-gray-400">
                              服务器: {role.serverId}
                            </p>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
      </CustomModalBody>
      <CustomModalFooter>
        <Button color="danger" variant="light" onPress={onClose}>
          取消
        </Button>
        <Button
          color="primary"
          onPress={handleConfirm}
          isLoading={isLoading}
          isDisabled={selectedRoles.length === 0}
        >
          确认选择 ({selectedRoles.length})
        </Button>
      </CustomModalFooter>
    </CustomModal>
  );
}
