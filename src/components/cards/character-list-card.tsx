import { useEffect, useState } from "react";
import { Card } from "@heroui/react";
import { invoke } from "@tauri-apps/api/core";
import { charDetailCache } from "@/utils/charDetailCache";
import { CharDetailData, CharacterItem } from "@/types/charDetail";
import { CharSelectModal } from "@/components/char-select-modal";
import { logDebug, logError } from "@/utils/logger";
import { useTranslation } from "react-i18next";

interface CharacterListCardProps {
  roleId: string;
  cardId: string;
  settings: any;
  isEditMode?: boolean;
}

export function CharacterListCard({
  roleId,
  cardId,
  settings,
  isEditMode = false,
}: CharacterListCardProps) {
  const { t, i18n } = useTranslation();
  const [charDetail, setCharDetail] = useState<CharDetailData | null>(null);
  const [selectedCharIds, setSelectedCharIds] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load character detail data
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        // Check cache first - ALWAYS use cache if available
        let detail = charDetailCache.getCharDetail(roleId);

        if (!detail) {
          // Only fetch from backend if cache is empty
          logDebug("Cache miss, fetching from backend...");
          const result = await invoke<CharDetailData | null>(
            "get_char_detail",
            { roleId },
          );
          if (result) {
            charDetailCache.cacheCharDetail(roleId, result);
            detail = result;
          }
        } else {
          logDebug("Using cached character detail");
        }

        setCharDetail(detail || null);
      } catch (error) {
        logError("Failed to load character detail:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [roleId]);

  // Load selected character IDs
  useEffect(() => {
    const loadSelectedIds = async () => {
      try {
        const ids = await invoke<string[]>("get_selected_char_ids", { roleId });

        logDebug("Loaded selected char IDs:", ids);

        if (ids && ids.length > 0) {
          // Filter out empty strings
          const validIds = ids.filter((id) => id && id.trim() !== "");
          setSelectedCharIds(validIds);
          logDebug("Filtered valid IDs:", validIds);
        } else if (charDetail) {
          // Default: top 3 characters by rarity (desc) then name (asc)
          const defaultIds = getDefaultSelectedChars(charDetail.chars);
          setSelectedCharIds(defaultIds);
          logDebug("Using default IDs:", defaultIds);

          // Save defaults to config
          await invoke("save_selected_char_ids", {
            roleId,
            selectedIds: defaultIds,
          });
        }
      } catch (error) {
        logError("Failed to load selected character IDs:", error);
      }
    };

    if (charDetail) {
      loadSelectedIds();
    }
  }, [charDetail, roleId]);

  // Helper: Get default selected characters
  const getDefaultSelectedChars = (chars: CharacterItem[]): string[] => {
    // Sort by rarity (desc), then name (asc)
    const sorted = [...chars].sort((a, b) => {
      const rarityA = parseInt(a.charData.rarity.value) || 0;
      const rarityB = parseInt(b.charData.rarity.value) || 0;

      if (rarityB !== rarityA) {
        return rarityB - rarityA;
      }

      return a.charData.name.localeCompare(b.charData.name);
    });

    // Take top 3
    return sorted.slice(0, 3).map((c) => c.charData.id);
  };

  // Get selected character data - maintain the order of selectedCharIds
  const selectedCharacters = selectedCharIds
    .map((id) => charDetail?.chars.find((c) => c.charData.id === id))
    .filter((c): c is CharacterItem => c !== undefined)
    .slice(0, 3);

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

  if (!charDetail) {
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
            {selectedCharacters.map((char, index) => (
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
        charDetail={charDetail}
        selectedCharIds={selectedCharIds}
        onSave={async (newIds: string[]) => {
          setSelectedCharIds(newIds);
          try {
            await invoke("save_selected_char_ids", {
              roleId,
              selectedIds: newIds,
            });
            logDebug("Saved selected character IDs:", newIds);
          } catch (error) {
            logError("Failed to save selected character IDs:", error);
          }
        }}
      />
    </>
  );
}
