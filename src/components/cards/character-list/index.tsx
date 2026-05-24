import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@heroui/react";
import { CharDetailData, CharacterItem } from "@/types/charDetail";
import { CharSelectModal } from "@/components/char-select-modal";
import { logDebug, logError } from "@/utils/logger";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { roleDataService } from "@/utils/roleDataService";
import { BaseCardProps } from "../registry/types";
import { CardConfigService } from "@/utils/cardConfigService";
import type { CharacterListCardSettings } from "@/types/card-settings";
import { useCardData } from "../base/use-card-data";

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

// ── 图片常驻内存管理 ────────────────────────────────────────

/** 提取一组 CharacterItem 中需要常驻的图片 URL */
function extractImageUrls(chars: CharacterItem[]): string[] {
  return chars.flatMap((c) => {
    const urls: string[] = [];
    if (c.charData.avatarRtUrl) urls.push(c.charData.avatarRtUrl);
    if (c.charData.avatarSqUrl) urls.push(c.charData.avatarSqUrl);
    return urls;
  });
}

/**
 * Hook：在选中角色变化时自动 pin/unpin 图片到后端内存
 */
function usePinImages(cardId: string, characters: CharacterItem[]) {
  const prevUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    const newUrls = extractImageUrls(characters);

    // 需要 unpin 的 = 之前有但现在没有
    const toUnpin = prevUrlsRef.current.filter((url) => !newUrls.includes(url));
    // 需要 pin 的 = 现在有但之前没有
    const toPin = newUrls.filter((url) => !prevUrlsRef.current.includes(url));

    const run = async () => {
      try {
        if (toUnpin.length > 0) {
          await invoke("unpin_images", { cardId, urls: toUnpin });
          logDebug("[PinImages] Unpinned:", toUnpin);
        }
        if (toPin.length > 0) {
          await invoke("pin_images", { cardId, urls: toPin });
          logDebug("[PinImages] Pinned:", toPin);
        }
      } catch (err) {
        logError("[PinImages] Failed:", err);
      }
    };

    run();
    prevUrlsRef.current = newUrls;

    // 组件卸载时 unpin 当前所有
    return () => {
      if (newUrls.length > 0) {
        invoke("unpin_images", { cardId, urls: newUrls }).catch(() => {});
      }
    };
  }, [cardId, characters]);
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

  // 常驻选中角色的展示图片到后端内存
  usePinImages(cardId, selectedCharacters);

  // Clear long press timer when modal opens
  useEffect(() => {
    if (isModalOpen) {
      // Dispatch custom event to clear any active long press timers
      logDebug("Modal opened, clearing long press timers");
      window.dispatchEvent(new CustomEvent("clearLongPressTimers"));
    }
  }, [isModalOpen]);

  if (isLoading) {
    return (
      <Card className="p-6 bg-content1 shadow-sm border border-separator h-full w-full">
        <div className="space-y-4">
          {/* Title skeleton */}
          <div className="h-5 bg-default-200 rounded w-1/2 animate-pulse"></div>

          {/* Character avatars skeleton - 3 columns */}
          <div className="grid grid-cols-3 gap-2 h-[140px]">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-full h-full bg-default-200 rounded-lg animate-pulse"
              ></div>
            ))}
          </div>

          {/* Additional info skeleton */}
          <div className="space-y-2">
            <div className="h-3 bg-default-200 rounded w-3/4 animate-pulse"></div>
            <div className="h-3 bg-default-200 rounded w-1/2 animate-pulse"></div>
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
        <div className="flex flex-col justify-center h-full gap-4">
          {/* Card Header - Only show character count */}
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground text-base">
              {t("settings.characters.characters_count", {
                count: selectedCharacters.length,
              })}
            </h3>
          </div>

          {/* Character Avatars Grid - Larger size with rectangular portraits */}
          <div className="grid grid-cols-3 gap-2 h-[140px]">
            {selectedCharacters.map((char) => (
              <div key={char.charData.id} className="relative group h-full">
                <img
                  src={char.charData.avatarRtUrl || char.charData.avatarSqUrl}
                  alt={char.charData.name}
                  className="w-full h-full object-cover rounded-lg shadow-sm"
                />
                {/* Character Name Overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-1.5 rounded-b-lg">
                  <p className="text-white text-xs font-bold truncate">
                    {char.charData.name}
                  </p>
                  <p className="text-white/90 text-[10px] mt-0.5">
                    {char.charData.rarity.value}★ ·{" "}
                    {char.charData.profession.value}
                  </p>
                </div>
              </div>
            ))}

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
