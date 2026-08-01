import {
  CustomModal,
  CustomModalHeader,
  CustomModalBody,
} from "@/components/custom-modal";
import { useTranslation } from "react-i18next";
import { AttendanceRewards } from "./attendance-rewards";
import type { AttendanceData } from "./index";

interface AttendanceRewardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  attendanceData: AttendanceData | null;
}

export function AttendanceRewardsModal({
  isOpen,
  onClose,
  attendanceData,
}: AttendanceRewardsModalProps) {
  const { t } = useTranslation();

  return (
    <CustomModal isOpen={isOpen} onClose={onClose} size="md">
      <CustomModalHeader onClose={onClose}>
        {t("card:attendance_title")}
      </CustomModalHeader>
      <CustomModalBody>
        <AttendanceRewards attendanceData={attendanceData} />
      </CustomModalBody>
    </CustomModal>
  );
}
