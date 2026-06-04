import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Button, Alert, RadioGroup, Radio, ProgressCircle } from "@heroui/react";
import {
  CustomModal,
  CustomModalHeader,
  CustomModalBody,
} from "./custom-modal";
import { CharDetailData } from "@/types/charDetail";
import { SkillDescription } from "@/utils/skillDescParser";
import { useTranslation } from "react-i18next";
import { Img } from "@/utils/imageLoader";
import { useImageRequest } from "@/utils/imageCacheManager";
import { roleDataService } from "@/utils/roleDataService";
import { getConfig } from "@/utils/configService";
import { invoke } from "@tauri-apps/api/core";
import { logError } from "@/utils/logger";

interface CharSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  charDetail: CharDetailData;
  selectedCharIds: string[];
  onSave: (selectedIds: string[]) => void;
  roleId: string;
}

export function CharSelectModal({
  isOpen,
  onClose,
  charDetail,
  selectedCharIds,
  onSave,
  roleId,
}: CharSelectModalProps) {
  const { t } = useTranslation();
  const [tempSelectedIds, setTempSelectedIds] =
    useState<string[]>(selectedCharIds);
  const [viewMode, setViewMode] = useState<"list" | "detail" | "select-slot">(
    "list",
  );
  const [detailCharId, setDetailCharId] = useState<string | null>(null);
  const [selectedDetailItem, setSelectedDetailItem] = useState<{
    type: "skill" | "combatTalent" | "abilityTalent" | "cultivationTalent";
    id: string;
  } | null>(null);
  const [detailActive, setDetailActive] = useState(false);
  const detailRafRef = useRef<number>(0);
  const detailTimerRef = useRef<number>(0);

  // Wiki 详情相关（仅非预加载时: 显示加载指示 + 关闭时清理后端缓存）
  const [wikiLoading, setWikiLoading] = useState(false);
  const wikiCleanupRef = useRef(false);
  const wikiItemIdRef = useRef<string | null>(null);
  const wikiPreloadRef = useRef(false);

  /** 打开详情面板：先渲染内容，下一帧再触发宽度动画 */
  const openDetailPanel = (item: {
    type: "skill" | "combatTalent" | "abilityTalent" | "cultivationTalent";
    id: string;
  }) => {
    if (detailTimerRef.current) clearTimeout(detailTimerRef.current);
    if (detailRafRef.current) cancelAnimationFrame(detailRafRef.current);
    setSelectedDetailItem(item);
    detailRafRef.current = requestAnimationFrame(() => {
      setDetailActive(true);
    });
  };

  /** 关闭详情面板：先关宽度动画，动画完成后再清除内容 */
  const closeDetailPanel = () => {
    if (detailRafRef.current) cancelAnimationFrame(detailRafRef.current);
    setDetailActive(false);
    detailTimerRef.current = window.setTimeout(() => {
      setSelectedDetailItem(null);
    }, 300);
  };

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

  // 重置 Wiki 状态
  const resetWikiState = useCallback(() => {
    setWikiLoading(false);
    wikiItemIdRef.current = null;
  }, []);

  // Reset all state when modal opens to ensure fresh data
  useEffect(() => {
    if (isOpen) {
      setTempSelectedIds(selectedCharIds);
      setViewMode("list");
      setDetailCharId(null);
      setSelectingCharId(null);
      setSelectedSlotIndex(null);
      setSuccessMessage(null); // Clear success message
      setSelectedDetailItem(null);
      setDetailActive(false);
      setFilterProfession("all"); // Reset filters
      setFilterProperty("all");
      setFilterRarity("all");
      setShowFilters(false); // Hide filter panel
      wikiCleanupRef.current = false;
      resetWikiState();
    } else {
      // 模态框关闭时：如果预加载未开启，清空 BE 端 wiki 缓存
      if (wikiCleanupRef.current) {
        invoke("clear_wiki_detail_cache").catch((e) =>
          logError("[Wiki] Failed to clear cache on close:", e)
        );
      }
      resetWikiState();
    }
  }, [isOpen]);

  // Reset detail selection when entering detail view
  useEffect(() => {
    if (viewMode === "detail" && detailCharId) {
      setSelectedDetailItem(null);
      setDetailActive(false);
    }
  }, [viewMode, detailCharId]);

  // 进入 detail view 时加载 Wiki 详情
  useEffect(() => {
    if (viewMode !== "detail" || !detailCharId || !roleId) {
      return;
    }

    const charName = getCharById(detailCharId)?.name;
    if (!charName) return;

    let cancelled = false;

    const loadWikiDetail = async () => {
      setWikiLoading(true);

      try {
        // 检查预加载设置
        const preload = (await getConfig<boolean>("wiki_detail_preload")) ?? false;
        wikiPreloadRef.current = preload;
        if (cancelled) return;

        // 在 wiki 目录中按名称查找 itemId
        let itemId = wikiItemIdRef.current;
        if (!itemId) {
          itemId = await roleDataService.lookupCharItemId(roleId, charName);
          wikiItemIdRef.current = itemId;
        }

        if (cancelled || !itemId) {
          if (!itemId) {
            logError(`[Wiki] Character "${charName}" not found in wiki catalog`);
          }
          return;
        }

        // 加载 Wiki 详情（数据缓存在后端，仅用于触发按需加载 + 关闭时清理）
        await roleDataService.getWikiItemDetail(roleId, itemId);
        if (cancelled) return;

        // 仅当预加载未开启时，标记后续关闭时需要清理缓存
        if (!preload) {
          wikiCleanupRef.current = true;
        }
      } catch (e) {
        if (!cancelled) {
          logError("[Wiki] Failed to load wiki detail:", e);
        }
      } finally {
        if (!cancelled) {
          setWikiLoading(false);
        }
      }
    };

    loadWikiDetail();

    return () => {
      cancelled = true;
    };
  }, [viewMode, detailCharId, roleId]);

  // 离开 detail view 时重置 Wiki 状态，若未预加载则清理 BE 缓存
  const prevViewMode = useRef(viewMode);
  useEffect(() => {
    if (prevViewMode.current === "detail" && viewMode !== "detail") {
      resetWikiState();
      if (!wikiPreloadRef.current && wikiCleanupRef.current) {
        invoke("clear_wiki_detail_cache").catch((e) =>
          logError("[Wiki] Failed to clear cache on detail close:", e)
        );
        wikiCleanupRef.current = false;
      }
    }
    prevViewMode.current = viewMode;
  }, [viewMode, resetWikiState]);

  // Cleanup animation refs
  useEffect(() => {
    return () => {
      if (detailRafRef.current) cancelAnimationFrame(detailRafRef.current);
      if (detailTimerRef.current) clearTimeout(detailTimerRef.current);
    };
  }, []);

  const MAX_SELECTION = 3;

  function rarityLineColor(value: string): string {
    switch (value) {
      case "6": return "#ff7100";
      case "5": return "#ffcc00";
      case "4": return "#b380ff";
      default: return "transparent";
    }
  }

  function renderRarityIcons(value: string, size: number = 14) {
    const count = parseInt(value, 10) || 0;
    return (
      <span className="inline-flex items-center gap-px">
        {Array.from({ length: count }).map((_, i) => (
          <img
            key={i}
            src="/src/assets/rarity.svg"
            alt=""
            className="inline-block"
            style={{ width: `${size}px`, height: `${size}px` }}
          />
        ))}
      </span>
    );
  }

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

  // Compute image paths for cache requests
  const gridAvatarPaths = useMemo(
    () =>
      charDetail.chars
        .map((c) => c.charData.avatarRtUrl || c.charData.avatarSqUrl)
        .filter(Boolean),
    [charDetail.chars],
  );

  const detailImagePaths = useMemo(() => {
    if (viewMode !== "detail" || !detailCharId) return [];
    const item = charDetail.chars.find(
      (c) => c.charData.id === detailCharId,
    );
    if (!item) return [];
    const char = item.charData;
    const paths: string[] = [];
    if (char.illustrationUrl) paths.push(char.illustrationUrl);
    if (char.avatarSqUrl) paths.push(char.avatarSqUrl);
    char.skills.forEach((s) => { if (s.iconUrl) paths.push(s.iconUrl); });
    char.abilityTalents.forEach((t) => { if (t.iconUrl) paths.push(t.iconUrl); });
    char.combatTalents.forEach((t) => { if (t.iconUrl) paths.push(t.iconUrl); });
    (char.cultivationTalents || []).forEach((t) => {
      if (t.iconUrl) paths.push(t.iconUrl);
    });
    return paths;
  }, [viewMode, detailCharId, charDetail.chars]);

  const allCachePaths = useMemo(
    () => [...gridAvatarPaths, ...detailImagePaths],
    [gridAvatarPaths, detailImagePaths],
  );

  useImageRequest(allCachePaths, [allCachePaths]);

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

      {viewMode === "detail" ? (
        detailCharId && (() => {
          const char = getCharById(detailCharId);
          const charItem = getCharItemById(detailCharId);
          if (!char) return null;

          const sel = selectedDetailItem;
          const activeCombatNodes = charItem?.talent?.latestPassiveSkillNodes || [];
          const activeAbilityNodes = charItem?.talent?.attrNodes || [];
          const activeCultivationNodes = charItem?.talent?.latestSpaceshipSkillNodes || [];
          const hasSelection = detailActive;

          const groupChains = (talents: typeof char.combatTalents) => {
            const groups = new Map<string, typeof char.combatTalents>();
            talents.forEach((t) => {
              const baseId = t.id.replace(/_\d+$/, "");
              if (!groups.has(baseId)) groups.set(baseId, []);
              groups.get(baseId)!.push(t);
            });
            groups.forEach((g) => g.sort((a, b) => {
              const aL = parseInt(a.id.match(/_(\d+)$/)?.[1] || "0");
              const bL = parseInt(b.id.match(/_(\d+)$/)?.[1] || "0");
              return aL - bL;
            }));
            return Array.from(groups.values());
          };

          const findItem = () => {
            if (!sel) return null;
            if (sel.type === "skill") {
              const s = char.skills.find((x) => x.id === sel.id);
              return s ? { ...s, _type: "skill" as const } : null;
            }
            const pool =
              sel.type === "combatTalent" ? char.combatTalents :
              sel.type === "abilityTalent" ? char.abilityTalents :
              char.cultivationTalents || [];
            const t = pool.find((x) => x.id === sel.id);
            return t ? { ...t, _type: sel.type } : null;
          };
          const selectedItem = findItem();

          const isNodeUnlocked = (chain: typeof char.combatTalents, index: number, type: string) => {
            const activeNodes = type === "combatTalent" ? activeCombatNodes :
              type === "abilityTalent" ? activeAbilityNodes :
              activeCultivationNodes;
            if (type === "skill") return true;
            if (type === "abilityTalent") return activeNodes.includes(chain[index].id);
            for (let i = index; i < chain.length; i++) {
              if (activeNodes.includes(chain[i].id)) return true;
            }
            return false;
          };

          const talentIcon = (iconUrl: string, name: string, unlocked: boolean) => {
            return unlocked ? (
              <Img src={iconUrl} alt={name} className="w-full h-full object-contain" />
            ) : (
              <div className="relative w-full h-full">
                <Img src={iconUrl} alt={name} className="w-full h-full object-contain opacity-30" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white drop-shadow" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm8 14H7c-.55 0-1-.45-1-1v-8c0-.55.45-1 1-1h10c.55 0 1 .45 1 1v8c0 .55-.45 1-1 1z"/>
                  </svg>
                </div>
              </div>
            );
          };

          const btnBase = (isFirstThree: boolean, active: boolean, unlocked: boolean) =>
            `w-12 h-12 border-2 p-1 transition-all cursor-pointer flex-shrink-0
            ${isFirstThree ? "rounded-full" : "rounded-lg"}
            ${unlocked ? "border-yellow-300" : "border-neutral-500"}
            ${active ? "ring-2 ring-blue-500/40 scale-110" : "hover:scale-105"}
            ${unlocked ? "shadow-[0_0_14px_rgba(0,0,0,0.35)]" : ""}`;

          const pasCombatChains = groupChains(char.combatTalents);
          const cultChains = groupChains(char.cultivationTalents || []);

          const showLoading = wikiLoading && !wikiPreloadRef.current;

          return (
            <div className="h-[78vh] relative overflow-hidden" style={{ border: "none" }}>
              {/* Close button at top-right corner */}
              <button
                onClick={() => { setViewMode("list"); setDetailCharId(null); }}
                className="absolute top-2 right-2 z-30 w-8 h-8 flex items-center justify-center rounded-full text-white/70 hover:text-white transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {showLoading ? (
                <div className="flex items-center justify-center h-full">
                  <ProgressCircle isIndeterminate size="lg" aria-label="Loading wiki">
                    <ProgressCircle.Track>
                      <ProgressCircle.TrackCircle />
                      <ProgressCircle.FillCircle />
                    </ProgressCircle.Track>
                  </ProgressCircle>
                </div>
              ) : (
              <div style={{
                display: "flex",
                height: "100%",
                overflow: "hidden",
              }}>
              {/* Left column - pushed out when detail selected */}
              <div style={{
                width: hasSelection ? "0%" : "35%",
                minWidth: 0,
                flexShrink: 0,
                transition: "width 300ms ease",
                overflow: "hidden",
                backgroundColor: "#404040",
              }}>
                <div className="h-full p-3 flex flex-col items-center justify-center">
                  <Img src={char.illustrationUrl} alt={char.name} className="w-full h-full object-contain" />
                </div>
              </div>

              {/* Middle column - pushes left, pulls right */}
              <div style={{
                width: hasSelection ? "48%" : "65%",
                minWidth: 0,
                flexShrink: 0,
                transition: "width 300ms ease",
                overflow: "hidden",
                backgroundColor: "#ddc236",
              }}>
                <div className="h-full p-4 overflow-y-auto space-y-6">
                  {/* Character Info Header */}
                  <div className="flex items-start gap-3 pb-3 border-b border-black/10">
                    <Img
                      src={char.avatarSqUrl}
                      alt={char.name}
                      className="w-12 h-12 rounded-lg object-cover shadow-sm shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-black truncate">{char.name}</h3>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        {renderRarityIcons(char.rarity.value, 14)}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-black/70 mt-0.5 flex-wrap">
                        <span>{char.profession.value}</span>
                        <span className="text-black/40">·</span>
                        <span>{char.property.value}</span>
                        <span className="text-black/40">·</span>
                        <span>{char.weaponType.value}</span>
                        {charItem?.level != null && (
                          <>
                            <span className="text-black/40">·</span>
                            <span>Lv.{charItem.level}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Skills */}
                  <div>
                    <div className="flex flex-wrap gap-5">
                      {char.skills.map((skill) => {
                        const isSel = sel?.type === "skill" && sel.id === skill.id;
                        return (
                          <button key={skill.id}
                            onClick={() => openDetailPanel({ type: "skill", id: skill.id })}
                            className={btnBase(true, isSel, true)}
                            style={{ backgroundColor: "#e9d72c" }}
                            title={skill.name}>
                            <Img src={skill.iconUrl} alt={skill.name} className="w-full h-full object-contain" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Ability Talents */}
                  <div>
                    <div className="flex flex-wrap gap-5">
                      {[...char.abilityTalents].sort((a, b) => {
                        const numA = parseInt(a.id.match(/_(\d+)$/)?.[1] || "0");
                        const numB = parseInt(b.id.match(/_(\d+)$/)?.[1] || "0");
                        return numA - numB;
                      }).map((talent) => {
                        const isSel = sel?.type === "abilityTalent" && sel.id === talent.id;
                        const unlocked = activeAbilityNodes.includes(talent.id);
                        return (
                          <button key={talent.id}
                            onClick={() => openDetailPanel({ type: "abilityTalent", id: talent.id })}
                            className={`${btnBase(true, isSel, unlocked)} relative`}
                            style={{ backgroundColor: unlocked ? "#e9d72c" : "#404040" }}
                            title={talent.name}>
                            {talentIcon(talent.iconUrl, talent.name, unlocked)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Passive Skills */}
                  {pasCombatChains.length > 0 && (
                    <div>
                      <div className="flex flex-col gap-4">
                        {pasCombatChains.map((chain, ci) => (
                          <div key={ci} className="flex items-center gap-1">
                            {chain.map((talent, ti) => {
                              const isSel = sel?.type === "combatTalent" && sel.id === talent.id;
                              const unlocked = isNodeUnlocked(chain, ti, "combatTalent");
                              return (
                                <div key={talent.id} className="flex items-center gap-1">
                                  {ti > 0 && (
                                    <div className={`w-10 border-t-2 rounded-none ${unlocked ? "border-white" : "border-dashed border-neutral-400"}`} />
                                  )}
                                  <button
                                    onClick={() => openDetailPanel({ type: "combatTalent", id: talent.id })}
                                    className={`${btnBase(true, isSel, unlocked)} relative`}
                                    style={{ backgroundColor: unlocked ? "#e9d72c" : "#404040" }}
                                    title={talent.name}>
                                    {talentIcon(talent.iconUrl, talent.name, unlocked)}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Cultivation Talents */}
                  {cultChains.length > 0 && (
                    <div>
                      <div className="flex flex-col gap-4">
                        {cultChains.map((chain, ci) => (
                          <div key={ci} className="flex items-center gap-1">
                            {chain.map((talent, ti) => {
                              const isSel = sel?.type === "cultivationTalent" && sel.id === talent.id;
                              const unlocked = isNodeUnlocked(chain, ti, "cultivationTalent");
                              return (
                                <div key={talent.id} className="flex items-center gap-1">
                                  {ti > 0 && (
                                    <div className={`w-10 border-t-2 rounded-none ${unlocked ? "border-white" : "border-dashed border-neutral-400"}`} />
                                  )}
                                  <button
                                    onClick={() => openDetailPanel({ type: "cultivationTalent", id: talent.id })}
                                    className={`${btnBase(false, isSel, unlocked)} relative`}
                                    style={{ backgroundColor: unlocked ? "#e9d72c" : "#404040" }}
                                    title={talent.name}>
                                    {talentIcon(talent.iconUrl, talent.name, unlocked)}
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right column - pulls in when detail selected */}
              <div style={{
                width: hasSelection ? "52%" : "0%",
                minWidth: 0,
                flexShrink: 0,
                transition: "width 300ms ease",
                overflow: "hidden",
                backgroundColor: "#404040",
              }}>
                <div className="h-full relative">
                  <button
                    onClick={closeDetailPanel}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-8 flex items-center justify-center text-white/60 hover:text-white transition-colors cursor-pointer"
                    title="Collapse detail"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                  <div className="h-full overflow-y-auto" style={{ backgroundColor: "#404040" }}>
                    {selectedItem && (
                      <div className="pl-10 p-5 text-[#f0e8d8]">
                        <div className="flex items-center gap-4 mb-4">
                          <Img src={selectedItem.iconUrl} alt={selectedItem.name}
                            className={`w-16 h-16 object-contain p-1.5 ${selectedItem._type === "cultivationTalent" ? "rounded-lg" : "rounded-full"}`}
                            style={{ backgroundColor: "#e9d72c", boxShadow: "0 0 14px rgba(0,0,0,0.35)" }} />
                          <div>
                            <h4 className="font-semibold text-lg text-[#f0e8d8]">{selectedItem.name}</h4>
                            {"type" in selectedItem && selectedItem.type && (
                              <p className="text-sm text-[#c0b8a8]">
                                {selectedItem.type.value}
                                {"property" in selectedItem && selectedItem.property && (
                                  <> • {selectedItem.property.value}</>
                                )}
                              </p>
                            )}
                          </div>
                        </div>
                        <SkillDescription
                          description={selectedItem.desc}
                          params={selectedItem.descParams as Record<string, string> | undefined}
                          className="text-sm leading-relaxed" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            )}
            </div>
          );
        })()
      ) : (
        <>
          <CustomModalHeader
            onClose={() => {
              if (viewMode === "select-slot") {
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
            ) : viewMode === "select-slot" ? (
              <div className="flex items-center gap-3">
                {selectingCharId && (
                  <>
                    <div className="flex flex-col">
                      <Img
                        src={getCharById(selectingCharId)?.avatarSqUrl || ""}
                        alt={getCharById(selectingCharId)?.name}
                        className="w-16 h-16 rounded-t-lg object-cover"
                      />
                      <div className="w-full h-[3px] shrink-0 rounded-b-lg" style={{ backgroundColor: rarityLineColor(getCharById(selectingCharId)?.rarity.value || "3") }} />
                    </div>
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
                        <div className="flex flex-col flex-shrink-0">
                          <Img
                            src={charData.avatarRtUrl || charData.avatarSqUrl}
                            alt={charData.name}
                            className="w-16 h-20 rounded-t-lg object-cover"
                          />
                           <div className="w-full h-[3px] shrink-0 rounded-b-lg" style={{ backgroundColor: rarityLineColor(charData.rarity.value) }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold truncate text-sm min-w-[80px]">
                              {charData.name}
                            </h3>
                          </div>
                          <div className="flex items-center gap-1 mb-1">
                            {renderRarityIcons(charData.rarity.value, 14)}
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
                          <div className="flex flex-col">
                            <Img
                              src={currentChar.avatarRtUrl || currentChar.avatarSqUrl}
                              alt={currentChar.name}
                              className="w-16 h-20 rounded-t-lg object-cover"
                            />
                             <div className="w-full h-[3px] shrink-0 rounded-b-lg" style={{ backgroundColor: rarityLineColor(currentChar.rarity.value) }} />
                          </div>
                          <h4 className="font-semibold text-sm text-center mt-2">
                            {currentChar.name}
                          </h4>
                          <div className="flex items-center gap-1 mt-1">
                            {renderRarityIcons(currentChar.rarity.value, 10)}
                          </div>
                          <p className="text-xs text-muted mt-1">
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
      </>
    )}

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
