import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, ProgressCircle } from "@heroui/react";
import { CharDetailData, CharacterItem } from "@/types/charDetail";
import { CharSelectModal } from "@/components/char-select-modal";
import { logDebug, logError } from "@/utils/logger";
import { useTranslation } from "react-i18next";
import { roleDataService } from "@/utils/roleDataService";
import { BaseCardProps } from "../registry/types";
import { CardConfigService } from "@/utils/cardConfigService";
import type { CharacterListCardSettings, SortOrder } from "@/types/card-settings";
import { useCardData } from "../base/use-card-data";
import { Img } from "@/utils/imageLoader";
import { useImageRequest, usePinImages } from "@/utils/imageCacheManager";

const SORT_OPTIONS: SortOrder[] = ["rarity", "name", "level"];

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

function sortCharacters(chars: CharacterItem[], order: SortOrder): CharacterItem[] {
  const sorted = [...chars];
  switch (order) {
    case "rarity":
      sorted.sort((a, b) => {
        const rA = parseInt(a.charData.rarity.value, 10) || 0;
        const rB = parseInt(b.charData.rarity.value, 10) || 0;
        if (rB !== rA) return rB - rA;
        return a.charData.name.localeCompare(b.charData.name);
      });
      break;
    case "name":
      sorted.sort((a, b) => a.charData.name.localeCompare(b.charData.name));
      break;
    case "level": {
      sorted.sort((a, b) => {
        const lA = a.level ?? 0;
        const lB = b.level ?? 0;
        if (lB !== lA) return lB - lA;
        return a.charData.name.localeCompare(b.charData.name);
      });
      break;
    }
  }
  return sorted;
}

export default function CharacterListCard({
  roleId,
  cardId,
  isEditMode = false,
}: BaseCardProps) {
  const { t } = useTranslation();
  const [selectedCharIds, setSelectedCharIds] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState<SortOrder>("rarity");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: charDetail, isLoading } = useCardData<CharDetailData>({
    fetchData: () => roleDataService.getFullCharDetail(roleId),
  });

  const processedCharDetail = useMemo(() => {
    if (!charDetail) return null;
    return { ...charDetail, chars: [...charDetail.chars] };
  }, [charDetail]);

  const loadSettings = useCallback(async () => {
    try {
      const settings =
        await CardConfigService.getCardSettings<CharacterListCardSettings>(
          cardId,
        );

      logDebug(`Loaded settings for card ${cardId}:`, settings);

      if (settings.sortOrder) {
        setSortOrder(settings.sortOrder);
      }

      if (settings.selectedCharIds && settings.selectedCharIds.length > 0) {
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

        await CardConfigService.updateCardSetting(
          cardId,
          "selectedCharIds",
          defaultIds,
        );
      }
    } catch (error) {
      logError("Failed to load settings:", error);
    }
  }, [processedCharDetail, cardId]);

  useEffect(() => {
    if (processedCharDetail) {
      loadSettings();
    }
  }, [processedCharDetail, loadSettings]);

  const handleSortChange = async (newOrder: SortOrder) => {
    setSortOrder(newOrder);
    try {
      await CardConfigService.updateCardSetting(cardId, "sortOrder", newOrder);
    } catch (error) {
      logError("Failed to save sort order:", error);
    }
  };

  const selectedCharacters = useMemo(() => {
    const chars = getSelectedCharacters(processedCharDetail, selectedCharIds);
    return sortCharacters(chars, sortOrder);
  }, [processedCharDetail, selectedCharIds, sortOrder]);

  const avatarPaths = useMemo(
    () =>
      selectedCharacters
        .map((c) => c.charData.avatarRtUrl || c.charData.avatarSqUrl)
        .filter(Boolean),
    [selectedCharacters],
  );

  useImageRequest(avatarPaths, [avatarPaths]);
  usePinImages(avatarPaths);

  useEffect(() => {
    if (isModalOpen) {
      logDebug("Modal opened, clearing long press timers");
      window.dispatchEvent(new CustomEvent("clearLongPressTimers"));
    }
  }, [isModalOpen]);

  function rarityLineColor(value: string): string {
    switch (value) {
      case "6": return "#ff7100";
      case "5": return "#ffcc00";
      case "4": return "#b380ff";
      default: return "transparent";
    }
  }

  function renderCharSlot(char: CharacterItem) {
    const hasLevel = char.level != null;
    const rarityValue = char.charData.rarity.value;
    return (
      <div key={char.charData.id} className="relative group h-full min-h-0 flex flex-col">
        <div className="relative flex-1 min-h-0">
          <Img
            src={char.charData.avatarRtUrl || char.charData.avatarSqUrl}
            alt={char.charData.name}
            className="w-full h-full object-cover rounded-t-lg shadow-sm"
          />
          <div className="absolute top-1 left-1 right-1 flex items-center justify-between">
            <span className="text-white text-[10px] font-bold truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
              {char.charData.name}
            </span>
            {hasLevel && (
              <span className="text-white text-[10px] font-bold shrink-0 ml-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                Lv.{char.level}
              </span>
            )}
          </div>
        </div>
        <div className="w-full h-[3px] shrink-0 rounded-b-lg" style={{ backgroundColor: rarityLineColor(rarityValue) }} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <Card className="p-6 bg-content1 shadow-sm border border-separator h-full w-full flex items-center justify-center">
        <ProgressCircle isIndeterminate size="md" aria-label="Loading">
          <ProgressCircle.Track>
            <ProgressCircle.TrackCircle />
            <ProgressCircle.FillCircle />
          </ProgressCircle.Track>
        </ProgressCircle>
      </Card>
    );
  }

  if (!processedCharDetail) {
    return (
      <Card className="p-6 bg-content1 shadow-sm border border-separator">
        <p className="text-muted text-center">
          {t("card:no_data")}
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
          <div className="flex items-center justify-between shrink-0">
            <h3 className="font-semibold text-foreground text-sm">
              {t("card:title")}
            </h3>
          </div>

          {isEditMode && (
            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              <span className="text-[11px] text-muted mr-0.5">
                {t("card:sort_order")}:
              </span>
              {SORT_OPTIONS.map((opt) => {
                const labelKey = `card:sort_${opt}`;
                const isActive = sortOrder === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleSortChange(opt)}
                    className={`px-2 py-0.5 text-[11px] rounded border transition-all cursor-pointer ${
                      isActive
                        ? "bg-blue-500 text-white border-blue-500"
                        : "bg-default-50 text-muted border-separator hover:border-blue-400"
                    }`}
                  >
                    {t(labelKey) || opt}
                  </button>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 flex-1 min-h-0">
            {selectedCharacters.map(renderCharSlot)}

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
                  {t("card:empty_slot")}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <CharSelectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        charDetail={processedCharDetail}
        selectedCharIds={selectedCharIds}
        roleId={roleId}
        onSave={async (newIds: string[]) => {
          setSelectedCharIds(newIds);
          try {
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
