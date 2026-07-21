import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Button, Switch } from "@heroui/react";
import {
  CustomModal,
  CustomModalHeader,
  CustomModalBody,
  CustomModalFooter,
} from "@/components/custom-modal";
import { AchieveMedal } from "@/types/charDetail";
import { useTranslation } from "react-i18next";
import { Img } from "@/utils/imageLoader";
import { useImageRequest } from "@/utils/imageCacheManager";

interface AchievementModalProps {
  isOpen: boolean;
  onClose: () => void;
  medals: AchieveMedal[];
  selectedMedalIds: string[];
  useDisplayList: boolean;
  displayMedalIds?: string[];
  onSave: (selectedIds: string[], useDisplay: boolean) => void;
}

const HEX_CLIP = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";
const HEX_W = 82;
const HEX_H = 95;
const STRIP_HEX_W = 52;
const STRIP_HEX_H = 60;
const DRAG_THRESHOLD = 5;
const SLOT_COUNT = 10;

function effectiveLevel(medal: AchieveMedal): number {
  return Math.min(medal.achievementData.initLevel + medal.level - 1, 3);
}

function getMedalIcon(medal: AchieveMedal): string {
  if (medal.isPlated && medal.achievementData.platedIcon) {
    return medal.achievementData.platedIcon;
  }
  const lv = effectiveLevel(medal);
  if (lv >= 3 && medal.achievementData.reforge3Icon) return medal.achievementData.reforge3Icon;
  if (lv >= 2 && medal.achievementData.reforge2Icon) return medal.achievementData.reforge2Icon;
  return medal.achievementData.initIcon || "";
}

interface DragState {
  medalId: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  icon: string;
}

type DropTarget =
  | { type: "slot"; index: number }
  | { type: "strip" }
  | null;

function DroppableHexCell({
  medal,
  index,
  isDragOver,
  onPointerDown,
  onRemove,
}: {
  medal?: AchieveMedal | null;
  index: number;
  isDragOver: boolean;
  onPointerDown: (medalId: string, e: React.PointerEvent) => void;
  onRemove: (index: number) => void;
}) {
  const icon = medal ? getMedalIcon(medal) : "";

  return (
    <div
      onPointerDown={(e) => {
        if (!medal || e.button !== 0) return;
        onPointerDown(medal.achievementData.id, e);
      }}
      onContextMenu={(e) => {
        if (!medal) return;
        e.preventDefault();
        onRemove(index);
      }}
      className={`relative transition-all duration-200 ${isDragOver ? "scale-110 z-10" : ""} ${medal ? "cursor-grab active:cursor-grabbing" : ""}`}
      data-drop-target={`slot-${index}`}
    >
      <div
        className={`
          relative
          ${medal ? "overflow-hidden" : ""}
          ${isDragOver ? "ring-2 ring-primary ring-offset-2 ring-offset-content1" : ""}
          transition-shadow duration-200
        `}
        style={{
          width: HEX_W,
          height: HEX_H,
          clipPath: HEX_CLIP,
          WebkitClipPath: HEX_CLIP,
          boxShadow: medal
            ? "inset 0 2px 4px rgba(0,0,0,0.3), inset 0 -1px 2px rgba(255,255,255,0.06)"
            : "none",
        }}
      >
        {icon ? (
          <Img
            src={icon}
            alt={medal!.achievementData.name}
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-xs text-separator/40 select-none">{index + 1}</span>
        )}
      </div>
      {!medal && (
        <svg
          className="absolute pointer-events-none"
          style={{ top: 0, left: 0 }}
          width={HEX_W}
          height={HEX_H}
          viewBox={`0 0 ${HEX_W} ${HEX_H}`}
        >
          <polygon
            points={`${HEX_W / 2},0 ${HEX_W},${HEX_H * 0.25} ${HEX_W},${HEX_H * 0.75} ${HEX_W / 2},${HEX_H} 0,${HEX_H * 0.75} 0,${HEX_H * 0.25}`}
            fill="none"
            stroke="rgba(120,120,120,0.5)"
            strokeWidth={1}
            strokeDasharray="3 2"
          />
        </svg>
      )}
      {isDragOver && (
        <div
          className="absolute inset-0 bg-primary/20 pointer-events-none"
          style={{ clipPath: HEX_CLIP, WebkitClipPath: HEX_CLIP }}
        />
      )}
    </div>
  );
}

function SlotHoneycomb({
  cellMedals,
  dragOverIndex,
  onCellPointerDown,
  onCellRemove,
}: {
  cellMedals: (AchieveMedal | null)[];
  dragOverIndex: number | null;
  onCellPointerDown: (medalId: string, e: React.PointerEvent) => void;
  onCellRemove: (index: number) => void;
}) {
  const GAP = 3;
  const CELL_W = HEX_W + GAP;
  const CELL_H = HEX_H + GAP;
  const ROW_Y = [0, Math.round(CELL_H * 0.75)];
  const ROW_X = (i: number, row: number) => (i + (row === 1 ? 0.5 : 0)) * CELL_W;

  return (
    <div className="relative" style={{ width: 5.5 * CELL_W, height: ROW_Y[1] + HEX_H }}>
      {Array.from({ length: 5 }).flatMap((_, col) =>
        [0, 1].map((row) => {
          const idx = col * 2 + row;
          const medal = idx < cellMedals.length ? cellMedals[idx] : null;
          return (
            <div
              key={`${row}-${col}`}
              className="absolute"
              style={{ left: ROW_X(col, row), top: ROW_Y[row] }}
            >
              <DroppableHexCell
                medal={medal}
                index={idx}
                isDragOver={dragOverIndex === idx}
                onPointerDown={onCellPointerDown}
                onRemove={onCellRemove}
              />
            </div>
          );
        }),
      )}
    </div>
  );
}

function StripHex({
  medal,
  onPointerDown,
}: {
  medal: AchieveMedal;
  onPointerDown: (medalId: string, e: React.PointerEvent) => void;
}) {
  const icon = getMedalIcon(medal);
  return (
    <div
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        onPointerDown(medal.achievementData.id, e);
      }}
      className="shrink-0 cursor-grab active:cursor-grabbing transition-all duration-150 hover:scale-110"
      data-drop-target="strip"
    >
      <div
        className="relative overflow-hidden"
        style={{
          width: STRIP_HEX_W,
          height: STRIP_HEX_H,
          clipPath: HEX_CLIP,
          WebkitClipPath: HEX_CLIP,
          filter: !icon ? "drop-shadow(0 0 0 1px rgba(180,180,180,0.6))" : "none",
        }}
      >
        {icon ? (
          <Img
            src={icon}
            alt={medal.achievementData.name}
            className="absolute inset-0 w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 bg-default-200" />
        )}
      </div>
    </div>
  );
}

function findDropTarget(el: Element | null): DropTarget {
  if (!el) return null;
  const attr = el.closest("[data-drop-target]");
  if (!attr) return null;
  const val = attr.getAttribute("data-drop-target")!;
  if (val === "strip") return { type: "strip" };
  if (val.startsWith("slot-")) {
    const idx = parseInt(val.slice(5), 10);
    if (!isNaN(idx)) return { type: "slot", index: idx };
  }
  return null;
}

export function AchievementModal({
  isOpen,
  onClose,
  medals,
  selectedMedalIds: initialSelectedIds,
  useDisplayList: initialUseDisplayList,
  displayMedalIds = [],
  onSave,
}: AchievementModalProps) {
  const { t } = useTranslation();
  const modalBodyRef = useRef<HTMLDivElement>(null);

  const [view, setView] = useState<"main" | "list">("main");

  const [slots, setSlots] = useState<(string | null)[]>(() => {
    const s: (string | null)[] = [];
    for (let i = 0; i < SLOT_COUNT; i++) {
      s.push(initialSelectedIds[i] || null);
    }
    return s;
  });
  const [strip, setStrip] = useState<string[]>(() => initialSelectedIds.slice(SLOT_COUNT));

  const [localUseDisplayList, setLocalUseDisplayList] = useState(initialUseDisplayList);
  const [listSelectedIds, setListSelectedIds] = useState<string[]>([]);

  const [drag, setDrag] = useState<DragState | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<DropTarget>(null);
  const dragRef = useRef<DragState | null>(null);
  const hasDragged = useRef(false);
  const dropTargetRef = useRef<DropTarget>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      e.preventDefault();
    };
    window.addEventListener("contextmenu", handler, true);
    return () => window.removeEventListener("contextmenu", handler, true);
  }, [isOpen]);

  const displayMedals = useMemo(() => {
    return displayMedalIds
      .map((id) => medals.find((m) => m.achievementData.id === id))
      .filter(Boolean) as AchieveMedal[];
  }, [displayMedalIds, medals]);

  const cellMedals: (AchieveMedal | null)[] = useMemo(() => {
    if (localUseDisplayList) {
      const result: (AchieveMedal | null)[] = [];
      for (let i = 0; i < SLOT_COUNT; i++) {
        result.push(displayMedals[i] || null);
      }
      return result;
    }
    return slots.map((id) => (id ? medals.find((m) => m.achievementData.id === id) || null : null));
  }, [localUseDisplayList, slots, displayMedals, medals]);

  const stripMedals = useMemo(() => {
    return strip.map((id) => medals.find((m) => m.achievementData.id === id)).filter(Boolean) as AchieveMedal[];
  }, [strip, medals]);

  const handleToggle = () => {
    const newVal = !localUseDisplayList;
    setLocalUseDisplayList(newVal);
    if (!newVal && slots.every((s) => s === null) && strip.length === 0) {
      const initial: (string | null)[] = [];
      for (let i = 0; i < SLOT_COUNT; i++) {
        initial.push(displayMedalIds[i] || null);
      }
      setSlots(initial);
      setStrip(displayMedalIds.slice(SLOT_COUNT));
    }
  };

  const handleCellDrop = useCallback((medalId: string, target: DropTarget) => {
    if (!target) return;
    if (target.type === "strip") {
      setSlots((prevSlots) => {
        const idx = prevSlots.indexOf(medalId);
        if (idx < 0) return prevSlots;
        const next = [...prevSlots];
        next[idx] = null;
        return next;
      });
      setStrip((prevStrip) => {
        if (prevStrip.includes(medalId)) return prevStrip;
        return [...prevStrip, medalId];
      });
      return;
    }
    const targetIndex = target.index;
    setSlots((prevSlots) => {
      const fromSlotIdx = prevSlots.indexOf(medalId);
      const isInStrip = fromSlotIdx < 0;
      if (isInStrip) {
        setStrip((prevStrip) => {
          const next = prevStrip.filter((id) => id !== medalId);
          const displaced = prevSlots[targetIndex];
          if (displaced) {
            next.push(displaced);
          }
          return next;
        });
        const next = [...prevSlots];
        next[targetIndex] = medalId;
        return next;
      }
      if (fromSlotIdx === targetIndex) return prevSlots;
      const next = [...prevSlots];
      const displaced = next[targetIndex];
      next[targetIndex] = medalId;
      next[fromSlotIdx] = displaced || null;
      return next;
    });
  }, []);

  const handleCellRemove = useCallback((index: number) => {
    setSlots((prev) => {
      const medalId = prev[index];
      if (!medalId) return prev;
      const next = [...prev];
      next[index] = null;
      return next;
    });
    setStrip((prevStrip) => {
      const medalId = slots[index];
      if (!medalId) return prevStrip;
      if (prevStrip.includes(medalId)) return prevStrip;
      return [...prevStrip, medalId];
    });
  }, [slots]);

  const handleDragStart = useCallback((medalId: string, e: React.PointerEvent) => {
    const icon = medals.find((m) => m.achievementData.id === medalId);
    if (!icon) return;
    const img = getMedalIcon(icon);
    const state: DragState = {
      medalId,
      startX: e.clientX,
      startY: e.clientY,
      currentX: e.clientX,
      currentY: e.clientY,
      icon: img,
    };
    dragRef.current = state;
    hasDragged.current = false;
    setDrag(state);
  }, [medals]);

  useEffect(() => {
    if (!drag) return;

    const handlePointerMove = (e: PointerEvent) => {
      const prev = dragRef.current;
      if (!prev) return;

      const dx = e.clientX - prev.startX;
      const dy = e.clientY - prev.startY;

      if (!hasDragged.current) {
        if (Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
        hasDragged.current = true;
      }

      const target = findDropTarget(document.elementFromPoint(e.clientX, e.clientY));
      setDragOverTarget(target);
      dropTargetRef.current = target;

      const next = { ...prev, currentX: e.clientX, currentY: e.clientY };
      dragRef.current = next;
      setDrag(next);
    };

    const handlePointerUp = () => {
      if (hasDragged.current && dropTargetRef.current) {
        handleCellDrop(drag.medalId, dropTargetRef.current);
      }

      dragRef.current = null;
      hasDragged.current = false;
      setDrag(null);
      setDragOverTarget(null);
      dropTargetRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [drag, handleCellDrop]);

  const handleOpenList = () => {
    setListSelectedIds([...slots.filter(Boolean) as string[], ...strip]);
    setView("list");
  };

  const handleListCancel = () => {
    setView("main");
  };

  const handleListSave = () => {
    const nextSlots: (string | null)[] = [];
    const nextStrip: string[] = [];
    for (let i = 0; i < listSelectedIds.length; i++) {
      if (i < SLOT_COUNT) {
        nextSlots.push(listSelectedIds[i]);
      } else {
        nextStrip.push(listSelectedIds[i]);
      }
    }
    while (nextSlots.length < SLOT_COUNT) nextSlots.push(null);
    setSlots(nextSlots);
    setStrip(nextStrip);
    setView("main");
  };

  const handleClose = () => {
    onSave([...slots.map((s) => s ?? ""), ...strip], localUseDisplayList);
    onClose();
  };

  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState(0);
  const [platedFilter, setPlatedFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("time");

  const categories = useMemo(() => {
    const catMap = new Map<string, string>();
    catMap.set("all", t("card:ach_all"));
    for (const m of medals) {
      if (!catMap.has(m.achievementData.cate)) {
        catMap.set(m.achievementData.cate, m.achievementData.cateName);
      }
    }
    return Array.from(catMap.entries()).map(([key, label]) => ({ key, label }));
  }, [medals, t]);

  const levelOptions = useMemo(() => {
    const set = new Set<number>();
    for (const m of medals) set.add(effectiveLevel(m));
    return [0, ...[1, 2, 3].filter((l) => set.has(l))];
  }, [medals]);

  const LEVEL_LABELS: Record<number, string> = { 0: t("card:ach_all"), 1: "一级", 2: "二级", 3: "三级" };

  const filteredMedals = useMemo(() => {
    let result = medals;
    if (activeCategory !== "all") result = result.filter((m) => m.achievementData.cate === activeCategory);
    if (levelFilter > 0) result = result.filter((m) => effectiveLevel(m) === levelFilter);
    if (platedFilter === "plated") result = result.filter((m) => m.isPlated);
    else if (platedFilter === "unplated") result = result.filter((m) => !m.isPlated);
    result = [...result].sort((a, b) => {
      const byName = a.achievementData.name.localeCompare(b.achievementData.name);
      if (sortBy === "time") {
        const byTime = Number(b.obtainTs) - Number(a.obtainTs);
        if (byTime !== 0) return byTime;
        const byLevel = effectiveLevel(b) - effectiveLevel(a);
        if (byLevel !== 0) return byLevel;
        return byName;
      }
      const byLevel = effectiveLevel(b) - effectiveLevel(a);
      if (byLevel !== 0) return byLevel;
      const byTime = Number(b.obtainTs) - Number(a.obtainTs);
      if (byTime !== 0) return byTime;
      return byName;
    });
    return result;
  }, [medals, activeCategory, levelFilter, platedFilter, sortBy]);

  const imagePaths = useMemo(
    () => filteredMedals.map((m) => getMedalIcon(m)).filter(Boolean),
    [filteredMedals],
  );
  useImageRequest(imagePaths, [imagePaths]);

  const toggleMedal = (id: string) => {
    setListSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((i) => i !== id);
      return [...prev, id];
    });
  };

  return (
    <CustomModal isOpen={isOpen} onClose={handleClose} size={view === "list" ? "xl" : "md"}>
      <CustomModalHeader onClose={handleClose}>
        {view === "list" ? t("card:ach_select_medals") : t("card:ach_title")}
      </CustomModalHeader>

      {view === "main" ? (
        <CustomModalBody>
          <div className="flex flex-col items-center gap-4 py-4" ref={modalBodyRef}>
            <div className="flex items-center gap-2 self-end">
              <span className="text-xs text-muted">
                {localUseDisplayList ? t("card:ach_use_display_list") : t("card:ach_manual_select")}
              </span>
              <Switch
                isSelected={!localUseDisplayList}
                onChange={handleToggle}
                size="sm"
              >
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch>
            </div>

            <SlotHoneycomb
              cellMedals={cellMedals}
              dragOverIndex={dragOverTarget?.type === "slot" ? dragOverTarget.index : null}
              onCellPointerDown={handleDragStart}
              onCellRemove={handleCellRemove}
            />

            {!localUseDisplayList && (
              <div className="w-full flex flex-col items-center gap-3">
                <Button size="sm" variant="secondary" onPress={handleOpenList}>
                  {t("card:ach_select_medals")}
                </Button>

                <div
                  data-drop-target="strip"
                  className={`w-full overflow-x-auto scrollbar-hide min-h-[60px] flex items-center rounded-lg transition-colors ${dragOverTarget?.type === "strip" ? "bg-primary/10 ring-2 ring-primary ring-offset-1" : ""}`}
                >
                  {stripMedals.length > 0 ? (
                    <div className="flex items-center gap-2 justify-start px-2 pb-1">
                      {stripMedals.map((medal) => (
                        <StripHex
                          key={medal.achievementData.id}
                          medal={medal}
                          onPointerDown={handleDragStart}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted text-center w-full">
                      {t("card:ach_no_medals")}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </CustomModalBody>
      ) : (
        <>
          <CustomModalBody>
            <div className="flex gap-1 h-full overflow-hidden">
              <div className="w-44 shrink-0 border-r border-separator flex flex-col overflow-y-auto pr-2 space-y-1">
                {categories.map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      activeCategory === cat.key
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground hover:bg-default-100"
                    }`}
                    onClick={() => setActiveCategory(cat.key)}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 flex flex-col min-w-0">
                <div className="flex items-center justify-between mb-3 shrink-0">
                  <span className="text-sm text-muted">
                    {t("card:ach_selected_count", { count: listSelectedIds.length })}
                  </span>
                </div>

                <div className="flex items-center gap-2 mb-3 shrink-0 flex-wrap">
                  <span className="text-xs text-muted mr-1">{t("card:ach_level")}:</span>
                  {levelOptions.map((lv) => (
                    <button
                      key={lv}
                      type="button"
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors font-medium ${
                        levelFilter === lv
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "border-separator text-muted hover:border-foreground hover:text-foreground"
                      }`}
                      onClick={() => setLevelFilter(lv)}
                    >
                      {LEVEL_LABELS[lv]}
                    </button>
                  ))}
                  <span className="text-xs text-muted ml-2 mr-1">{t("card:ach_plated")}:</span>
                  {(["all", "plated", "unplated"] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors font-medium ${
                        platedFilter === opt
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "border-separator text-muted hover:border-foreground hover:text-foreground"
                      }`}
                      onClick={() => setPlatedFilter(opt)}
                    >
                      {opt === "all" ? t("card:ach_all") : opt === "plated" ? t("card:ach_plated") : t("card:ach_unplated")}
                    </button>
                  ))}
                  <span className="text-xs text-muted ml-2 mr-1">{t("card:ach_sort")}:</span>
                  {(["time", "level"] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors font-medium ${
                        sortBy === opt
                          ? "bg-primary text-white border-primary shadow-sm"
                          : "border-separator text-muted hover:border-foreground hover:text-foreground"
                      }`}
                      onClick={() => setSortBy(opt)}
                    >
                      {opt === "time" ? t("card:ach_time") : t("card:ach_level_sort")}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto space-y-1 min-h-[420px] pb-16">
                  {filteredMedals.length === 0 ? (
                    <div className="text-center text-muted py-12">
                      {t("card:ach_no_medals")}
                    </div>
                  ) : (
                    filteredMedals.map((medal) => {
                      const id = medal.achievementData.id;
                      const isSelected = listSelectedIds.includes(id);
                      const icon = getMedalIcon(medal);
                      return (
                        <div
                          key={id}
                          className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer border transition-all ${
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-transparent hover:bg-default-100"
                          }`}
                          onClick={() => toggleMedal(id)}
                        >
                          {icon ? (
                            <div
                              className="w-14 h-14 shrink-0 overflow-hidden bg-[#999999]"
                              style={{ clipPath: HEX_CLIP, WebkitClipPath: HEX_CLIP }}
                            >
                              <Img
                                src={icon}
                                alt={medal.achievementData.name}
                                className="w-full h-full object-cover"
                                draggable={false}
                              />
                            </div>
                          ) : (
                            <div className="w-14 h-14 shrink-0 bg-default-200" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">
                              {medal.achievementData.name}
                            </div>
                            <div className="flex items-center gap-3 text-xs mt-0.5">
                              <ReforgeLevel medal={medal} />
                              <span className="text-yellow-500 font-medium inline-block w-7 text-center">
                                {medal.isPlated ? t("card:ach_plated") : ""}
                              </span>
                              <span className="text-muted">
                                {medal.obtainTs ? formatTimestamp(medal.obtainTs) : ""}
                              </span>
                            </div>
                          </div>
                          <div
                            className={`w-5 h-5 rounded shrink-0 flex items-center justify-center transition-colors ${
                              isSelected
                                ? "bg-primary text-white"
                                : "border-2 border-default-300"
                            }`}
                          >
                            {isSelected && (
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </CustomModalBody>
          <CustomModalFooter>
            <Button variant="secondary" onPress={handleListCancel}>
              {t("card:ach_cancel")}
            </Button>
            <Button variant="primary" onPress={handleListSave}>
              {t("card:ach_save")}
            </Button>
          </CustomModalFooter>
        </>
      )}

      {drag && hasDragged.current && (
        <div
          className="fixed pointer-events-none z-[200]"
          style={{
            left: drag.currentX - HEX_W / 2,
            top: drag.currentY - HEX_H / 2,
          }}
        >
          <div
            className="opacity-80 overflow-hidden"
            style={{
              width: HEX_W,
              height: HEX_H,
              clipPath: HEX_CLIP,
              WebkitClipPath: HEX_CLIP,
            }}
          >
            {drag.icon ? (
              <Img
                src={drag.icon}
                alt=""
                className="w-full h-full object-cover"
                draggable={false}
              />
            ) : null}
          </div>
        </div>
      )}
    </CustomModal>
  );
}

function formatTimestamp(ts: string): string {
  if (!ts) return "";
  const num = parseInt(ts, 10);
  if (isNaN(num)) return ts;
  const d = new Date(num * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const LEVEL_NAMES: Record<number, string> = { 1: "一级", 2: "二级", 3: "三级" };

function ReforgeLevel({ medal }: { medal: AchieveMedal }) {
  const lv = effectiveLevel(medal);
  return (
    <span className="text-foreground font-medium">
      {LEVEL_NAMES[lv] ?? `Lv.${lv}`}
    </span>
  );
}
