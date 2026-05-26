import { useEffect, useMemo, useState } from "react";
import { Card } from "@heroui/react";
import { CharDetailData, CharacterItem } from "@/types/charDetail";
import { CharSelectModal } from "@/components/char-select-modal";
import { logDebug, logError } from "@/utils/logger";
import { useTranslation } from "react-i18next";
import { roleDataService } from "@/utils/roleDataService";
import { BaseCardProps } from "../registry/types";
import { CardConfigService } from "@/utils/cardConfigService";
import type { CharacterListCardSettings } from "@/types/card-settings";
import { useCardData } from "../base/use-card-data";
import { Img } from "@/utils/imageLoader";

// ── 数据处理（原 processor.ts） ──────────────────────────────

/** 按稀有度降序→名称升序排序，前端专属处理 */
function sortCharsByRarity(chars: CharacterItem[]): CharacterItem[] {
  return [...chars].sort((a, b) => {
    const rarityA = parseInt(a.charData.rarity.value, 10) || 0;
    const rarityB = parseInt(b.charData.rarity.value, 10) || 0;
    if (rarityB !== rarityA) return rarityB - rarityA;
    return a.charData.name.localeCompare(b.charData.name);
  });
}

function getDefaultSelectedCharIds(chars: CharacterItem[]): string[] {
  return chars.slice(0, 3).map((c) => c.charData.id);
}

function getSelectedCharacters(
  charDetail: CharDetailData | null,
  ids: string[],
): CharacterItem[] {
  if (!charDetail) return [];
  return ids
    .map((id) => charDetail.chars.find((c) => c.charData.id === id))
    .filter((c): c is CharacterItem => c !== undefined)
    .slice(0, 3);
}

export default function CharacterListCard({
  roleId,
  cardId,
  isEditMode = false,
}: BaseCardProps) {
  const { t, i18n } = useTranslation();
  const [selectedCharIds, setSelectedCharIds] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 使用通用 Hook 加载角色详情数据
  const { data: charDetail, isLoading } = useCardData<CharDetailData>({
    fetchData: () => roleDataService.getFullCharDetail(roleId),
  });

  const processedCharDetail = useMemo(() => {
    if (!charDetail) return null;
    return { ...charDetail, chars: sortCharsByRarity(charDetail.chars) };
  }, [charDetail]);

  // Load selected character IDs
  useEffect(() => {
    const loadSelectedIds = async () => {
      try {
        // 使用统一的卡片配置服务
        const settings =
          await CardConfigService.getCardSettings<CharacterListCardSettings>(
            cardId,
          );

        logDebug(`Loaded settings for card ${cardId}:`, settings);

        if (settings.selectedCharIds && settings.selectedCharIds.length > 0) {
          // Filter out empty strings
          const validIds = settings.selectedCharIds.filter(
            (id) => id && id.trim() !== "",
          );
          setSelectedCharIds(validIds);
          logDebug("Filtered valid IDs:", validIds);
        } else if (processedCharDetail) {
          const defaultIds = getDefaultSelectedCharIds(
            processedCharDetail.chars,
          );
          setSelectedCharIds(defaultIds);
          logDebug("Using default IDs:", defaultIds);

          // Save defaults using unified config service
          await CardConfigService.updateCardSetting(
            cardId,
            "selectedCharIds",
            defaultIds,
          );
        }
      } catch (error) {
        logError("Failed to load selected character IDs:", error);
      }
    };

    if (processedCharDetail) {
      loadSelectedIds();
    }
  }, [processedCharDetail, cardId]);

  // Get selected character data - maintain the order of selectedCharIds
  const selectedCharacters = getSelectedCharacters(
    processedCharDetail,
    selectedCharIds,
  );

  // Clear long press timer when modal opens
  useEffect(() => {
    if (isModalOpen) {
      // Dispatch custom event to clear any active long press timers
      logDebug("Modal opened, clearing long press timers");
      window.dispatchEvent(new CustomEvent("clearLongPressTimers"));
    }
  }, [isModalOpen]);

  function rarityColor(value: string): string {
    switch (value) {
      case "6": return "text-red-400";
      case "5": return "text-yellow-400";
      case "4": return "text-purple-400";
      case "3": return "text-blue-400";
      default: return "text-blue-400";
    }
  }

  function renderCharSlot(char: CharacterItem) {
    const hasLevel = char.level != null;
    const hasEvolve = char.evolvePhase != null && char.evolvePhase > 0;
    return (
      <div key={char.charData.id} className="relative group h-full min-h-0">
        <Img
          src={char.charData.avatarRtUrl || char.charData.avatarSqUrl}
          alt={char.charData.name}
          className="w-full h-full object-cover rounded-lg shadow-sm"
        />
        {/* Level badge */}
        {hasLevel && (
          <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-black/70 rounded text-[10px] text-white font-bold leading-tight shadow-sm">
            Lv.{char.level}
          </div>
        )}
        {/* Evolve phase dots */}
        {hasEvolve && (
          <div className="absolute top-1 left-1 flex gap-0.5">
            {Array.from({ length: char.evolvePhase! }).map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-yellow-400 shadow-sm" />
            ))}
          </div>
        )}
        {/* Character info overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent px-1.5 py-2 rounded-b-lg">
          <p className="text-white text-xs font-bold truncate leading-tight">
            {char.charData.name}
          </p>
          <p className="text-white text-[10px] mt-1 leading-tight">
            <span className={rarityColor(char.charData.rarity.value)}>
              {char.charData.rarity.value}★
            </span>
            <span className="text-white/60 mx-0.5">·</span>
            {char.charData.profession.value}
          </p>
          <p className="text-white/50 text-[9px] mt-0.5 leading-tight truncate">
            {char.charData.property.value}·{char.charData.weaponType.value}
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <Card className="p-6 bg-content1 shadow-sm border border-separator h-full w-full">
        <div className="flex flex-col h-full gap-4">
          {/* Title skeleton */}
          <div className="h-5 bg-default-200 rounded w-1/2 animate-pulse shrink-0"></div>

          {/* Character avatars skeleton - 3 columns */}
          <div className="grid grid-cols-3 gap-2 flex-1 min-h-0">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-full h-full bg-default-200 rounded-lg animate-pulse"
              ></div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (!processedCharDetail) {
    return (
      <Card className="p-6 bg-content1 shadow-sm border border-separator">
        <p className="text-muted text-center">
          {i18n.language === "zh" ? "无可用数据" : "No data available"}
        </p>
      </Card>
    );
  }

  return (
    <>
      <Card
        className="p-6 bg-content1 shadow-sm border border-separator cursor-pointer hover:shadow-md transition-shadow h-full w-full select-none"
        onClick={() => !isEditMode && setIsModalOpen(true)}
      >
        <div className="flex flex-col h-full gap-3">
          {/* Card Header */}
          <div className="flex items-center justify-between shrink-0">
            <h3 className="font-semibold text-foreground text-sm">
              {t("settings.characters.characters_count", {
                count: selectedCharacters.length,
              })}
            </h3>
          </div>

          {/* Character Avatars Grid */}
          <div className="grid grid-cols-3 gap-2 flex-1 min-h-0">
            {selectedCharacters.map(renderCharSlot)}

            {/* Empty Slots */}
            {Array.from({
              length: Math.max(0, 3 - selectedCharacters.length),
            }).map((_, index) => (
              <div
                key={`empty-${index}`}
                className="h-full rounded-lg border-2 border-dashed border-separator flex flex-col items-center justify-center bg-default-50"
              >
                <svg
                  className="w-6 h-6 mb-1 text-muted opacity-50"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <span className="text-muted text-xs">
                  {t("settings.characters.empty_slot")}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Character Selection Modal */}
      <CharSelectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        charDetail={processedCharDetail}
        selectedCharIds={selectedCharIds}
        onSave={async (newIds: string[]) => {
          setSelectedCharIds(newIds);
          try {
            // 使用统一的卡片配置服务
            await CardConfigService.updateCardSetting(
              cardId,
              "selectedCharIds",
              newIds,
            );
            logDebug(
              `Saved selected character IDs for card ${cardId}:`,
              newIds,
            );
          } catch (error) {
            logError("Failed to save selected character IDs:", error);
          }
        }}
      />
    </>
  );
}
