import { useState, useEffect, useRef } from "react";
import { Button, Alert, RadioGroup, Radio } from "@heroui/react";
import {
  CustomModal,
  CustomModalHeader,
  CustomModalBody,
} from "./custom-modal";
import { CharDetailData } from "@/types/charDetail";
import { SkillDescription } from "@/utils/skillDescParser";
import { useTranslation } from "react-i18next";

interface CharSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  charDetail: CharDetailData;
  selectedCharIds: string[];
  onSave: (selectedIds: string[]) => void;
}

export function CharSelectModal({
  isOpen,
  onClose,
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
  const [selectingCharId, setSelectingCharId] = useState<string | null>(null);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(
    null,
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [filterProfession, setFilterProfession] = useState<string>("all");
  const [filterProperty, setFilterProperty] = useState<string>("all");
  const [filterRarity, setFilterRarity] = useState<string>("all");
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [showBackToTop, setShowBackToTop] = useState<boolean>(false);
  const [scrollPercent, setScrollPercent] = useState<number>(0);
  const [isHoveringBackToTop, setIsHoveringBackToTop] =
    useState<boolean>(false);
  const modalBodyRef = useRef<HTMLDivElement>(null);

  // Reset all state when modal opens to ensure fresh data
  useEffect(() => {
    if (isOpen) {
      setTempSelectedIds(selectedCharIds);
      setViewMode("list");
      setDetailCharId(null);
      setSelectingCharId(null);
      setSelectedSlotIndex(null);
      setSuccessMessage(null); // Clear success message
      setFilterProfession("all"); // Reset filters
      setFilterProperty("all");
      setFilterRarity("all");
      setShowFilters(false); // Hide filter panel
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

  // Get unique professions for filter options
  const uniqueProfessions = Array.from(
    new Set(charDetail.chars.map((c) => c.charData.profession.value)),
  ).sort();

  // Get unique properties for filter options
  const uniqueProperties = Array.from(
    new Set(charDetail.chars.map((c) => c.charData.property.value)),
  ).sort();

  // Get unique rarities for filter options
  const uniqueRarities = Array.from(
    new Set(charDetail.chars.map((c) => c.charData.rarity.value)),
  ).sort((a, b) => parseInt(b) - parseInt(a)); // Sort descending

  // Filter characters based on selected filters
  const filteredCharacters = sortedCharacters.filter((char) => {
    const charData = char.charData;

    // Apply profession filter
    if (
      filterProfession !== "all" &&
      charData.profession.value !== filterProfession
    ) {
      return false;
    }

    // Apply property filter
    if (
      filterProperty !== "all" &&
      charData.property.value !== filterProperty
    ) {
      return false;
    }

    // Apply rarity filter
    if (filterRarity !== "all" && charData.rarity.value !== filterRarity) {
      return false;
    }

    return true;
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

  // 滚动事件处理
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const totalHeight = scrollHeight - clientHeight;
    const percent =
      totalHeight > 0 ? Math.round((scrollTop / totalHeight) * 100) : 0;

    setScrollPercent(percent);
    setShowBackToTop(percent > 50);
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
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted">
                {t("settings.characters.pinned_count", {
                  count: tempSelectedIds.filter((id) => id).length,
                  max: MAX_SELECTION,
                })}
              </span>
              <Button
                size="sm"
                variant={showFilters ? "primary" : "outline"}
                onPress={() => setShowFilters(!showFilters)}
              >
                {showFilters
                  ? t("common.hide_filters")
                  : t("common.show_filters")}
              </Button>
            </div>
          </div>
        ) : viewMode === "detail" ? (
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
        ) : viewMode === "select-slot" ? (
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
        ) : null}
      </CustomModalHeader>

      {/* Body */}
      <CustomModalBody ref={modalBodyRef} onScroll={handleScroll}>
        {viewMode === "list" ? (
          <div className="space-y-4">
            {/* Filter Section */}
            {showFilters && (
              <div className="pb-4 border-b border-separator space-y-4">
                {/* Profession Filter */}
                <div>
                  <p className="text-sm font-semibold mb-2">
                    {t("filters.profession")}
                  </p>
                  <RadioGroup
                    orientation="horizontal"
                    value={filterProfession}
                    onChange={(value) => setFilterProfession(value)}
                    className="gap-2 flex-wrap"
                  >
                    <Radio
                      value="all"
                      className="px-4 py-2.5 rounded-lg border-2 border-default-300 data-[selected=true]:border-blue-600 data-[selected=true]:bg-blue-500/20 data-[selected=true]:shadow-[0_0_12px_rgba(37,99,235,0.5)] transition-all duration-200 hover:border-default-400"
                    >
                      <span className="text-sm font-bold">
                        {t("filters.all_professions")}
                      </span>
                    </Radio>
                    {uniqueProfessions.map((prof) => (
                      <Radio
                        key={prof}
                        value={prof}
                        className="px-4 py-2.5 rounded-lg border-2 border-default-300 data-[selected=true]:border-blue-600 data-[selected=true]:bg-blue-500/20 data-[selected=true]:shadow-[0_0_12px_rgba(37,99,235,0.5)] transition-all duration-200 hover:border-default-400"
                      >
                        <span className="text-sm font-bold">{prof}</span>
                      </Radio>
                    ))}
                  </RadioGroup>
                </div>

                {/* Property Filter */}
                <div>
                  <p className="text-sm font-semibold mb-2">
                    {t("filters.property")}
                  </p>
                  <RadioGroup
                    orientation="horizontal"
                    value={filterProperty}
                    onChange={(value) => setFilterProperty(value)}
                    className="gap-2 flex-wrap"
                  >
                    <Radio
                      value="all"
                      className="px-4 py-2.5 rounded-lg border-2 border-default-300 data-[selected=true]:border-blue-600 data-[selected=true]:bg-blue-500/20 data-[selected=true]:shadow-[0_0_12px_rgba(37,99,235,0.5)] transition-all duration-200 hover:border-default-400"
                    >
                      <span className="text-sm font-bold">
                        {t("filters.all_properties")}
                      </span>
                    </Radio>
                    {uniqueProperties.map((prop) => (
                      <Radio
                        key={prop}
                        value={prop}
                        className="px-4 py-2.5 rounded-lg border-2 border-default-300 data-[selected=true]:border-blue-600 data-[selected=true]:bg-blue-500/20 data-[selected=true]:shadow-[0_0_12px_rgba(37,99,235,0.5)] transition-all duration-200 hover:border-default-400"
                      >
                        <span className="text-sm font-bold">{prop}</span>
                      </Radio>
                    ))}
                  </RadioGroup>
                </div>

                {/* Rarity Filter */}
                <div>
                  <p className="text-sm font-semibold mb-2">
                    {t("filters.rarity")}
                  </p>
                  <RadioGroup
                    orientation="horizontal"
                    value={filterRarity}
                    onChange={(value) => setFilterRarity(value)}
                    className="gap-2 flex-wrap"
                  >
                    <Radio
                      value="all"
                      className="px-4 py-2.5 rounded-lg border-2 border-default-300 data-[selected=true]:border-blue-600 data-[selected=true]:bg-blue-500/20 data-[selected=true]:shadow-[0_0_12px_rgba(37,99,235,0.5)] transition-all duration-200 hover:border-default-400"
                    >
                      <span className="text-sm font-bold">
                        {t("filters.all_rarities")}
                      </span>
                    </Radio>
                    {uniqueRarities.map((rar) => (
                      <Radio
                        key={rar}
                        value={rar}
                        className="px-4 py-2.5 rounded-lg border-2 border-default-300 data-[selected=true]:border-blue-600 data-[selected=true]:bg-blue-500/20 data-[selected=true]:shadow-[0_0_12px_rgba(37,99,235,0.5)] transition-all duration-200 hover:border-default-400"
                      >
                        <span
                          className={`text-sm font-bold ${
                            rar === "6"
                              ? "text-red-500"
                              : rar === "5"
                                ? "text-yellow-500"
                                : rar === "4"
                                  ? "text-purple-500"
                                  : "text-blue-500"
                          }`}
                        >
                          {rar}★
                        </span>
                      </Radio>
                    ))}
                  </RadioGroup>
                </div>

                {/* Reset Filters Button */}
                <div className="flex justify-center pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onPress={() => {
                      setFilterProfession("all");
                      setFilterProperty("all");
                      setFilterRarity("all");
                    }}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    {t("common.clear")}
                  </Button>
                </div>
              </div>
            )}

            {/* Character Grid */}
            {filteredCharacters.length === 0 ? (
              <div className="text-center py-8 text-muted">
                <p>{t("common.no_results_found") || "No characters found"}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredCharacters.map((char) => {
                  const charData = char.charData;
                  const isPinned = tempSelectedIds.includes(charData.id);

                  return (
                    <div
                      key={charData.id}
                      className={`relative p-3 rounded-lg border transition-all cursor-pointer hover:shadow-md ${
                        isPinned
                          ? "border-blue-600"
                          : "border-separator bg-content1 hover:border-primary/50"
                      }`}
                      onClick={() => {
                        setDetailCharId(charData.id);
                        setViewMode("detail");
                      }}
                    >
                      {/* LED Indicator for pinned status */}
                      {isPinned && (
                        <div className="absolute top-2 right-2 z-10">
                          <div className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-[0_0_6px_rgba(37,99,235,0.6)] dark:shadow-[0_0_8px_rgba(37,99,235,0.8)]" />
                        </div>
                      )}

                      {/* Character Avatar and Info */}
                      <div className="flex items-start gap-3">
                        <img
                          src={charData.avatarRtUrl || charData.avatarSqUrl}
                          alt={charData.name}
                          className="w-16 h-20 rounded-lg object-cover flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold truncate text-sm min-w-[80px]">
                              {charData.name}
                            </h3>
                            <span
                              className={`text-xs font-bold flex-shrink-0 w-12 text-center ${
                                charData.rarity.value === "6"
                                  ? "text-red-500"
                                  : charData.rarity.value === "5"
                                    ? "text-yellow-500"
                                    : charData.rarity.value === "4"
                                      ? "text-purple-500"
                                      : "text-blue-500"
                              }`}
                            >
                              {charData.rarity.value}★
                            </span>
                          </div>
                          <p className="text-xs text-muted mb-2">
                            {charData.profession.value} •{" "}
                            {charData.property.value}
                          </p>

                          {/* Pin Icon for unpinned characters */}
                          {!isPinned && (
                            <div className="flex justify-end mt-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectingCharId(charData.id);
                                  setViewMode("select-slot");
                                }}
                                className="p-1 hover:bg-default-100 rounded transition-colors cursor-pointer"
                              >
                                <svg
                                  className="w-5 h-5 text-gray-400 dark:text-gray-600 rotate-45 hover:text-black dark:hover:text-white transition-colors"
                                  fill="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path d="M16 9V4l1 0c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1l1 0v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : viewMode === "detail" ? (
          detailCharId && (
            <div className="space-y-6">
              {/* Skills Section */}
              <div>
                <h3 className="text-lg font-semibold mb-3">
                  {t("character_detail.skills")}
                </h3>
                <div className="space-y-3">
                  {getCharById(detailCharId)?.skills.map((skill) => (
                    <div
                      key={skill.id}
                      className="p-4 bg-content1 rounded-lg border border-separator"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-full bg-gray-500/40 dark:bg-transparent flex items-center justify-center flex-shrink-0">
                          <img
                            src={skill.iconUrl}
                            alt={skill.name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        </div>
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
                          {t("character_detail.no_active_talents")}
                        </p>
                      );
                    }

                    return activeCombatTalents.map((talent) => (
                      <div
                        key={talent.id}
                        className="p-4 bg-content1 rounded-lg border border-separator"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 rounded-full bg-gray-500/40 dark:bg-transparent flex items-center justify-center flex-shrink-0">
                            <img
                              src={talent.iconUrl}
                              alt={talent.name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          </div>
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
                          {t("character_detail.no_active_ability_talents")}
                        </p>
                      );
                    }

                    return activeAbilityTalents.map((talent) => (
                      <div
                        key={talent.id}
                        className="p-4 bg-content1 rounded-lg border border-separator"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 rounded-full bg-gray-500/40 dark:bg-transparent flex items-center justify-center flex-shrink-0">
                            <img
                              src={talent.iconUrl}
                              alt={talent.name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          </div>
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
                          {t("character_detail.no_active_cultivation_talents")}
                        </p>
                      );
                    }

                    return activeCultivationTalents.map((talent) => (
                      <div
                        key={talent.id}
                        className="p-4 bg-content1 rounded-lg border border-separator"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 rounded-full bg-gray-500/40 dark:bg-transparent flex items-center justify-center flex-shrink-0">
                            <img
                              src={talent.iconUrl}
                              alt={talent.name}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          </div>
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
                <h3 className="text-lg font-semibold mb-3">
                  {t("character_detail.info")}
                </h3>
                <div className="space-y-3 p-4 bg-content1 rounded-lg border border-separator">
                  <div className="flex justify-between">
                    <span className="text-muted">
                      {t("character_detail.property")}:
                    </span>
                    <span>{getCharById(detailCharId)?.property.value}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">
                      {t("character_detail.weapon_type")}:
                    </span>
                    <span>{getCharById(detailCharId)?.weaponType.value}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">
                      {t("character_detail.tags")}:
                    </span>
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
                      className={`relative p-4 rounded-lg transition-all cursor-pointer ${
                        isSelected
                          ? "border-[3px] border-blue-500 bg-blue-50 dark:bg-blue-900/40 shadow-md scale-[1.02]"
                          : hasDuplicate
                            ? "border-2 border-warning bg-warning/10 opacity-50 cursor-not-allowed"
                            : "border-2 border-separator bg-content1 hover:border-blue-400/50 hover:bg-blue-50 dark:hover:bg-blue-900/20"
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

      {/* Back to Top Button */}
      {viewMode === "list" && showBackToTop && (
        <button
          className="fixed bottom-6 right-6 z-[10003] w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110"
          onClick={() => {
            if (modalBodyRef.current) {
              modalBodyRef.current.scrollTo({ top: 0, behavior: "smooth" });
            }
          }}
          onMouseEnter={() => setIsHoveringBackToTop(true)}
          onMouseLeave={() => setIsHoveringBackToTop(false)}
          aria-label="Back to top"
        >
          {isHoveringBackToTop ? (
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8h18M12 20V8m0 0l-6 6m6-6l6 6"
              />
            </svg>
          ) : (
            <span className="text-xs font-bold">{scrollPercent}%</span>
          )}
        </button>
      )}
    </CustomModal>
  );
}
