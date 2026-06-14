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
  const [preopenCharId, setPreopenCharId] = useState<string | null>(null);

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

  const ICON_BASE = "/src/assets/icons";
  const professionIconUrl = (key: string) => `${ICON_BASE}/profession/${key}.png`;
  const propertyIconUrl = (key: string) => `${ICON_BASE}/property/${key}.png`;

  function renderCharSlot(char: CharacterItem) {
    const data = char.charData;
    const coverUrl = data.illustrationUrl || data.avatarRtUrl || data.avatarSqUrl;
    return (
      <div
        key={data.id}
        className="group relative h-full w-full rounded-md overflow-hidden border border-separator bg-content1 transition-all duration-200 hover:border-blue-400/60 hover:shadow-md cursor-pointer"
        onClick={() => {
          if (isEditMode) return;
          setPreopenCharId(data.id);
          setIsModalOpen(true);
        }}
      >
        <Img
          src={coverUrl}
          alt={data.name}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          draggable={false}
        />
        <div className="absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />

        {/* 左上：profession + property 图标，无底 */}
        <div className="absolute top-1.5 left-1.5 z-10 flex flex-col gap-0.5">
          <img
            src={professionIconUrl(data.profession.key)}
            alt={data.profession.value}
            title={data.profession.value}
            className="w-6 h-6 object-contain drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
            }}
          />
          <img
            src={propertyIconUrl(data.property.key)}
            alt={data.property.value}
            title={data.property.value}
            className="w-6 h-6 object-contain drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
            }}
          />
        </div>

        {/* 右上：Lv. 标签 */}
        {char.level != null && (
          <div className="absolute top-1.5 right-1.5 z-10">
            <span className="text-white text-[10px] font-bold drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
              Lv.{char.level}
            </span>
          </div>
        )}

        {/* 底栏：名字 + 稀有度色条（半透明渐变，图片尽量占满） */}
        <div className="absolute inset-x-0 bottom-0 z-10">
          <div className="bg-gradient-to-t from-black/85 via-black/55 to-transparent px-1.5 pt-4 pb-1">
            <span className="block text-xs font-medium text-white truncate drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]">
              {data.name}
            </span>
          </div>
          <div
            className="h-[3px] w-full"
            style={{ backgroundColor: rarityLineColor(data.rarity.value) }}
          />
        </div>
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
        className="p-6 bg-content1 shadow-sm border border-separator h-full w-full select-none"
      >
        <div className="flex flex-col h-full gap-3">
          <div className="flex items-center justify-between shrink-0">
            <h3 className="font-semibold text-foreground text-sm">
              {t("card:title")}
            </h3>
          </div>

          {isEditMode && (
            <div className="text-[11px] text-muted shrink-0">
              {/* 编辑模式不再显示排序控件，排序由 CharacterSelectModal 内 FloatSelect 右侧图标控制 */}
              {t("card:title")}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 flex-1 min-h-0">
            {selectedCharacters.map(renderCharSlot)}

            {Array.from({
              length: Math.max(0, 3 - selectedCharacters.length),
            }).map((_, index) => (
              <div
                key={`empty-${index}`}
                className="h-full rounded-md border-2 border-dashed border-separator flex flex-col items-center justify-center bg-default-50 cursor-pointer hover:border-blue-400/60"
                onClick={() => !isEditMode && setIsModalOpen(true)}
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
        onClose={() => { setIsModalOpen(false); setPreopenCharId(null); }}
        charDetail={processedCharDetail}
        selectedCharIds={selectedCharIds}
        roleId={roleId}
        initialCharId={preopenCharId ?? undefined}
        initialViewMode={preopenCharId ? "detail" : undefined}
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
