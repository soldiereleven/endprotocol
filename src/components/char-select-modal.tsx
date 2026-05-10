import { useState, useEffect } from "react";
import { Button, Alert } from "@heroui/react";
import {
  CustomModal,
  CustomModalHeader,
  CustomModalBody,
  CustomModalFooter,
} from "./custom-modal";
import { CharDetailData, CharacterItem } from "@/types/charDetail";
import { SkillDescription } from "@/utils/skillDescParser";
import { useTranslation } from "react-i18next";

interface CharSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  roleId: string;
  charDetail: CharDetailData;
  selectedCharIds: string[];
  onSave: (selectedIds: string[]) => void;
}

export function CharSelectModal({
  isOpen,
  onClose,
  roleId,
  charDetail,
  selectedCharIds,
  onSave,
}: CharSelectModalProps) {
  const { t } = useTranslation();
  const [tempSelectedIds, setTempSelectedIds] =
    useState<string[]>(selectedCharIds);
  const [viewMode, setViewMode] = useState<"list" | "detail" | "select-slot">(
    "list",
  );
  const [detailCharId, setDetailCharId] = useState<string | null>(null);
  const [selectingCharId, setSelectingCharId] = useState<string | null>(null); // 正在选择槽位的角色ID
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(
    null,
  ); // 用户选择的槽位
  const [successMessage, setSuccessMessage] = useState<string | null>(null); // 成功提示信息

  // Reset all state when modal opens to ensure fresh data
  useEffect(() => {
    if (isOpen) {
      setTempSelectedIds(selectedCharIds);
      setViewMode("list");
      setDetailCharId(null);
      setSelectingCharId(null);
      setSelectedSlotIndex(null);
      setSuccessMessage(null); // Clear success message
    }
  }, [isOpen]);

  const MAX_SELECTION = 3;

  // Sort characters: pinned first, then by rarity (desc), then name (asc)
  const sortedCharacters = [...charDetail.chars].sort((a, b) => {
    const aPinned = tempSelectedIds.includes(a.charData.id);
    const bPinned = tempSelectedIds.includes(b.charData.id);

    // Pinned characters come first
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;

    // Then sort by rarity (desc)
    const rarityA = parseInt(a.charData.rarity.value) || 0;
    const rarityB = parseInt(b.charData.rarity.value) || 0;

    if (rarityB !== rarityA) {
      return rarityB - rarityA;
    }

    // Finally by name (asc)
    return a.charData.name.localeCompare(b.charData.name);
  });

  // Get character data by ID
  const getCharById = (id: string) => {
    return charDetail.chars.find((c) => c.charData.id === id)?.charData;
  };

  // Get full character item by ID (including talent info)
  const getCharItemById = (id: string) => {
    return charDetail.chars.find((c) => c.charData.id === id);
  };

  // Handle slot selection
  const handleSlotSelect = (slotIndex: number) => {
    if (!selectingCharId) return;

    // Check for duplicate - don't allow same character in multiple slots
    const isDuplicate = tempSelectedIds.some(
      (id, idx) => id === selectingCharId && idx !== slotIndex,
    );

    if (isDuplicate) {
      // Show error or just don't allow selection
      return;
    }

    setSelectedSlotIndex(slotIndex);
  };

  // Confirm slot selection
  const handleConfirmSlot = () => {
    if (!selectingCharId || selectedSlotIndex === null) return;

    const newSelectedIds = [...tempSelectedIds];
    newSelectedIds[selectedSlotIndex] = selectingCharId;
    setTempSelectedIds(newSelectedIds);

    // Save to config immediately
    onSave(newSelectedIds);

    // Show success message
    const charName = getCharById(selectingCharId)?.name || "Character";
    setSuccessMessage(
      t("settings.characters.pin_success", {
        name: charName,
        slot: selectedSlotIndex + 1,
      }),
    );

    // Auto-hide after 3 seconds
    setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);

    // Reset and go back to list
    setViewMode("list");
    setSelectingCharId(null);
    setSelectedSlotIndex(null);
  };

  return (
    <CustomModal isOpen={isOpen} onClose={onClose} size="xl" height="fixed">
      {/* Success Alert */}
      {successMessage && (
        <div className="px-6 pt-4">
          <Alert status="success">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Description>{successMessage}</Alert.Description>
            </Alert.Content>
          </Alert>
        </div>
      )}

      {/* Header */}
      <CustomModalHeader
        onClose={() => {
          if (viewMode === "detail" || viewMode === "select-slot") {
            setViewMode("list");
            setDetailCharId(null);
            setSelectingCharId(null);
          } else {
            onClose();
          }
        }}
      >
        {viewMode === "list" ? (
          <div className="flex items-center justify-between w-full">
            <h2>
              {t("settings.characters.pin_characters", { max: MAX_SELECTION })}
            </h2>
            <span className="text-sm text-muted">
              {t("settings.characters.pinned_count", {
                count: tempSelectedIds.filter((id) => id).length,
                max: MAX_SELECTION,
              })}
            </span>
          </div>
        ) : viewMode === "detail" ? (
          // Detail view header
          <div className="flex items-center gap-3">
            {detailCharId && (
              <>
                <img
                  src={getCharById(detailCharId)?.avatarSqUrl}
                  alt={getCharById(detailCharId)?.name}
                  className="w-16 h-16 rounded-lg object-cover"
                />
                <div>
                  <h2 className="text-xl font-bold">
                    {getCharById(detailCharId)?.name}
                  </h2>
                  <p className="text-sm text-muted">
                    {getCharById(detailCharId)?.rarity.value}★{" "}
                    {getCharById(detailCharId)?.profession.value}
                  </p>
                </div>
              </>
            )}
          </div>
        ) : (
          // Slot selection view header
          <div className="flex items-center gap-3">
            {selectingCharId && (
              <>
                <img
                  src={getCharById(selectingCharId)?.avatarSqUrl}
                  alt={getCharById(selectingCharId)?.name}
                  className="w-16 h-16 rounded-lg object-cover"
                />
                <div>
                  <h2 className="text-xl font-bold">
                    {t("settings.characters.select_slot", {
                      name: getCharById(selectingCharId)?.name,
                    })}
                  </h2>
                  <p className="text-sm text-muted">
                    {t("settings.characters.choose_slot")}
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </CustomModalHeader>

      {/* Body */}
      <CustomModalBody>
        {viewMode === "list" ? (
          // List View
          <div className="space-y-2">
            {sortedCharacters.map((char) => {
              const charData = char.charData;

              return (
                <div
                  key={charData.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-separator bg-content1 hover:border-primary/50 transition-colors"
                >
                  {/* LED Indicator - Show for pinned characters */}
                  {tempSelectedIds.includes(charData.id) ? (
                    <div className="relative flex-shrink-0">
                      <div className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] dark:shadow-[0_0_10px_rgba(34,197,94,0.8)]" />
                      <div className="absolute inset-0 w-3 h-3 rounded-full bg-green-400 animate-ping opacity-20" />
                    </div>
                  ) : (
                    <div className="relative flex-shrink-0">
                      <div className="w-3 h-3 rounded-full bg-gray-400 dark:bg-gray-500" />
                    </div>
                  )}

                  {/* Avatar */}
                  <img
                    src={charData.avatarSqUrl}
                    alt={charData.name}
                    className="w-12 h-12 rounded-lg object-cover cursor-pointer"
                    onClick={() => {
                      setDetailCharId(charData.id);
                      setViewMode("detail");
                    }}
                  />

                  {/* Character Info */}
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => {
                      setDetailCharId(charData.id);
                      setViewMode("detail");
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">
                        {charData.name}
                      </h3>
                      <span className="px-1.5 py-0.5 bg-primary rounded text-xs font-bold text-primary-foreground">
                        {charData.rarity.value}★
                      </span>
                      {/* ACTIVE label for pinned characters */}
                      {tempSelectedIds.includes(charData.id) && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold text-green-600 dark:text-green-400 tracking-wider">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted">
                      {charData.profession.value} • {charData.property.value}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    {/* View Details Button */}
                    <Button
                      size="sm"
                      variant="ghost"
                      onPress={() => {
                        setDetailCharId(charData.id);
                        setViewMode("detail");
                      }}
                    >
                      {t("settings.characters.details")}
                    </Button>

                    {/* Pin Slot Button */}
                    <Button
                      size="sm"
                      variant="primary"
                      onPress={() => {
                        setSelectingCharId(charData.id);
                        setViewMode("select-slot");
                      }}
                    >
                      {t("settings.characters.pin")}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : viewMode === "detail" ? (
          // Detail View
          detailCharId && (
            <div className="space-y-6">
              {/* Skills Section */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Skills</h3>
                <div className="space-y-3">
                  {getCharById(detailCharId)?.skills.map((skill) => (
                    <div
                      key={skill.id}
                      className="p-4 bg-content1 rounded-lg border border-separator"
                    >
                      <div className="flex items-start gap-3">
                        <img
                          src={skill.iconUrl}
                          alt={skill.name}
                          className="w-12 h-12 rounded object-cover flex-shrink-0"
                        />
                        <div className="flex-1">
                          <h4 className="font-semibold">{skill.name}</h4>
                          <p className="text-xs text-muted mb-2">
                            {skill.type.value} • {skill.property.value}
                          </p>
                          <SkillDescription
                            description={skill.desc}
                            params={skill.descParams}
                            className="text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Talents Section */}
              <div>
                <h3 className="text-lg font-semibold mb-3">
                  {t("settings.characters.passive_skills") || "Passive Skills"}
                </h3>
                <div className="space-y-3">
                  {(() => {
                    const characterItem = getCharItemById(detailCharId);
                    const allCombatTalents =
                      getCharById(detailCharId)?.combatTalents || [];
                    const activeNodes =
                      characterItem?.talent?.latestPassiveSkillNodes || [];

                    // Group talents by base ID (without the level suffix)
                    const talentGroups = new Map<string, any[]>();
                    allCombatTalents.forEach((talent) => {
                      if (activeNodes.includes(talent.id)) {
                        // Extract base ID: e.g., "chr_0027_tangtang_passive_skill_0_2" -> "chr_0027_tangtang_passive_skill_0"
                        const baseId = talent.id.replace(/_\d+$/, "");
                        if (!talentGroups.has(baseId)) {
                          talentGroups.set(baseId, []);
                        }
                        talentGroups.get(baseId)!.push(talent);
                      }
                    });

                    // For each group, select the one with highest level number
                    const activeCombatTalents: any[] = [];
                    talentGroups.forEach((talents) => {
                      // Sort by the level number at the end of ID
                      talents.sort((a, b) => {
                        const aLevel = parseInt(
                          a.id.match(/_(\d+)$/)?.[1] || "0",
                        );
                        const bLevel = parseInt(
                          b.id.match(/_(\d+)$/)?.[1] || "0",
                        );
                        return bLevel - aLevel; // Descending order
                      });
                      // Take the highest level
                      activeCombatTalents.push(talents[0]);
                    });

                    console.log(
                      "Active combat talents after filtering:",
                      activeCombatTalents.length,
                    );

                    if (activeCombatTalents.length === 0) {
                      return (
                        <p className="text-muted text-center py-4">
                          No active talents to display
                        </p>
                      );
                    }

                    return activeCombatTalents.map((talent) => (
                      <div
                        key={talent.id}
                        className="p-4 bg-content1 rounded-lg border border-separator"
                      >
                        <div className="flex items-start gap-3">
                          <img
                            src={talent.iconUrl}
                            alt={talent.name}
                            className="w-12 h-12 rounded object-cover flex-shrink-0"
                          />
                          <div className="flex-1">
                            <h4 className="font-semibold">{talent.name}</h4>
                            <SkillDescription
                              description={talent.desc}
                              params={talent.descParams}
                              className="text-sm mt-1"
                            />
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Ability Talents Section */}
              <div>
                <h3 className="text-lg font-semibold mb-3">
                  {t("settings.characters.ability_talents") ||
                    "Ability Talents"}
                </h3>
                <div className="space-y-3">
                  {(() => {
                    const characterItem = getCharItemById(detailCharId);
                    const allAbilityTalents =
                      getCharById(detailCharId)?.abilityTalents || [];
                    const activeNodes = characterItem?.talent?.attrNodes || [];

                    // Group talents by base ID
                    const talentGroups = new Map<string, any[]>();
                    allAbilityTalents.forEach((talent) => {
                      if (activeNodes.includes(talent.id)) {
                        const baseId = talent.id.replace(/_\d+$/, "");
                        if (!talentGroups.has(baseId)) {
                          talentGroups.set(baseId, []);
                        }
                        talentGroups.get(baseId)!.push(talent);
                      }
                    });

                    // Select highest level for each group
                    const activeAbilityTalents: any[] = [];
                    talentGroups.forEach((talents) => {
                      talents.sort((a, b) => {
                        const aLevel = parseInt(
                          a.id.match(/_(\d+)$/)?.[1] || "0",
                        );
                        const bLevel = parseInt(
                          b.id.match(/_(\d+)$/)?.[1] || "0",
                        );
                        return bLevel - aLevel;
                      });
                      activeAbilityTalents.push(talents[0]);
                    });

                    if (activeAbilityTalents.length === 0) {
                      return (
                        <p className="text-muted text-center py-4">
                          No active ability talents to display
                        </p>
                      );
                    }

                    return activeAbilityTalents.map((talent) => (
                      <div
                        key={talent.id}
                        className="p-4 bg-content1 rounded-lg border border-separator"
                      >
                        <div className="flex items-start gap-3">
                          <img
                            src={talent.iconUrl}
                            alt={talent.name}
                            className="w-12 h-12 rounded object-cover flex-shrink-0"
                          />
                          <div className="flex-1">
                            <h4 className="font-semibold">{talent.name}</h4>
                            <SkillDescription
                              description={talent.desc}
                              params={talent.descParams}
                              className="text-sm mt-1"
                            />
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Cultivation Talents Section */}
              <div>
                <h3 className="text-lg font-semibold mb-3">
                  {t("settings.characters.cultivation_talents") ||
                    "O.M.V. Dijiang Skills"}
                </h3>
                <div className="space-y-3">
                  {(() => {
                    const characterItem = getCharItemById(detailCharId);
                    const allCultivationTalents =
                      getCharById(detailCharId)?.cultivationTalents || [];
                    const activeNodes =
                      characterItem?.talent?.latestSpaceshipSkillNodes || [];

                    // Simply filter by active nodes, no grouping needed
                    const activeCultivationTalents =
                      allCultivationTalents.filter((talent) =>
                        activeNodes.includes(talent.id),
                      );

                    if (activeCultivationTalents.length === 0) {
                      return (
                        <p className="text-muted text-center py-4">
                          No active cultivation talents to display
                        </p>
                      );
                    }

                    return activeCultivationTalents.map((talent) => (
                      <div
                        key={talent.id}
                        className="p-4 bg-content1 rounded-lg border border-separator"
                      >
                        <div className="flex items-start gap-3">
                          <img
                            src={talent.iconUrl}
                            alt={talent.name}
                            className="w-12 h-12 rounded object-cover flex-shrink-0"
                          />
                          <div className="flex-1">
                            <h4 className="font-semibold">{talent.name}</h4>
                            <SkillDescription
                              description={talent.desc}
                              params={talent.descParams}
                              className="text-sm mt-1"
                            />
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>

              {/* Info Section */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Info</h3>
                <div className="space-y-3 p-4 bg-content1 rounded-lg border border-separator">
                  <div className="flex justify-between">
                    <span className="text-muted">Property:</span>
                    <span>{getCharById(detailCharId)?.property.value}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Weapon Type:</span>
                    <span>{getCharById(detailCharId)?.weaponType.value}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Tags:</span>
                    <span>{getCharById(detailCharId)?.tags.join(", ")}</span>
                  </div>
                </div>

                {/* Illustration */}
                <div className="mt-4">
                  <img
                    src={getCharById(detailCharId)?.illustrationUrl}
                    alt={`${getCharById(detailCharId)?.name} Illustration`}
                    className="w-full rounded-lg"
                  />
                </div>
              </div>
            </div>
          )
        ) : (
          // Slot Selection View
          selectingCharId && (
            <div className="space-y-4">
              <p className="text-center text-muted mb-6">
                {t("settings.characters.click_to_select")}
              </p>

              <div className="grid grid-cols-3 gap-4">
                {[0, 1, 2].map((slotIndex) => {
                  const currentCharId = tempSelectedIds[slotIndex];
                  const currentChar = currentCharId
                    ? getCharById(currentCharId)
                    : null;
                  const isSelected = selectedSlotIndex === slotIndex;
                  const isCurrentCharSlot = currentCharId === selectingCharId;

                  // Check if this slot has the same character (for duplicate detection)
                  const hasDuplicate =
                    currentCharId === selectingCharId && !isSelected;

                  return (
                    <div
                      key={slotIndex}
                      className={`relative p-4 rounded-lg border-2 transition-all cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary/10 shadow-lg"
                          : hasDuplicate
                            ? "border-warning bg-warning/10 opacity-50 cursor-not-allowed"
                            : "border-separator bg-content1 hover:border-primary/50"
                      }`}
                      onClick={() =>
                        !hasDuplicate && handleSlotSelect(slotIndex)
                      }
                    >
                      {/* Slot Number */}
                      <div className="absolute top-2 left-2 px-2 py-1 bg-default-100 rounded text-xs font-bold">
                        {t("common.slot", { number: slotIndex + 1 }) ||
                          `Slot ${slotIndex + 1}`}
                      </div>

                      {/* Character or Empty */}
                      {currentChar ? (
                        <div className="mt-6 flex flex-col items-center">
                          <img
                            src={
                              currentChar.avatarRtUrl || currentChar.avatarSqUrl
                            }
                            alt={currentChar.name}
                            className="w-16 h-20 rounded-lg object-cover mb-2"
                          />
                          <h4 className="font-semibold text-sm text-center">
                            {currentChar.name}
                          </h4>
                          <p className="text-xs text-muted">
                            {currentChar.rarity.value}★{" "}
                            {currentChar.profession.value}
                          </p>
                          {isCurrentCharSlot && !isSelected && (
                            <div className="mt-2 px-2 py-1 bg-default-500 text-default-foreground text-xs rounded">
                              {t("settings.characters.current")}
                            </div>
                          )}
                          {isSelected && (
                            <div className="mt-2 px-2 py-1 bg-primary text-primary-foreground text-xs rounded font-bold">
                              {t("settings.characters.selected")}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="mt-6 flex flex-col items-center justify-center h-28 text-muted">
                          <svg
                            className="w-10 h-10 mb-2 opacity-50"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 4v16m8-8H4"
                            />
                          </svg>
                          <p className="text-sm">
                            {t("settings.characters.empty_slot")}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 space-y-3">
                <p className="text-sm text-muted text-center">
                  {t("settings.characters.click_to_select")}
                </p>

                {/* Action Buttons */}
                <div className="flex gap-3 justify-center">
                  <Button
                    variant="outline"
                    onPress={() => {
                      setViewMode("list");
                      setSelectingCharId(null);
                      setSelectedSlotIndex(null);
                    }}
                  >
                    {t("settings.characters.cancel")}
                  </Button>
                  <Button
                    variant="primary"
                    isDisabled={selectedSlotIndex === null}
                    onPress={handleConfirmSlot}
                  >
                    {t("settings.characters.confirm_pin")}
                  </Button>
                </div>
              </div>
            </div>
          )
        )}
      </CustomModalBody>
    </CustomModal>
  );
}
