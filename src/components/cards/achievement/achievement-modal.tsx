import { useState, useMemo } from "react";
import { Button } from "@heroui/react";
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
  onSave: (selectedIds: string[], useDisplayList: boolean) => void;
  useDisplayList: boolean;
}

const HEX_CLIP = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";

function getMedalIcon(medal: AchieveMedal): string {
  if (medal.isPlated && medal.achievementData.platedIcon) {
    return medal.achievementData.platedIcon;
  }
  const lv = effectiveLevel(medal);
  if (lv >= 3 && medal.achievementData.reforge3Icon) return medal.achievementData.reforge3Icon;
  if (lv >= 2 && medal.achievementData.reforge2Icon) return medal.achievementData.reforge2Icon;
  return medal.achievementData.initIcon || "";
}

function formatTimestamp(ts: string): string {
  if (!ts) return "";
  const num = parseInt(ts, 10);
  if (isNaN(num)) return ts;
  const d = new Date(num * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function effectiveLevel(medal: AchieveMedal): number {
  return Math.min(medal.achievementData.initLevel + medal.level - 1, 3);
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

export function AchievementModal({
  isOpen,
  onClose,
  medals,
  selectedMedalIds,
  onSave,
  useDisplayList: initialUseDisplayList,
}: AchievementModalProps) {
  const { t } = useTranslation();
  const [selectedIds, setSelectedIds] = useState<string[]>(selectedMedalIds);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [useDisplayList, setUseDisplayList] = useState(initialUseDisplayList);
  const [levelFilter, setLevelFilter] = useState(0);
  const [platedFilter, setPlatedFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("time");

  const categories = useMemo(() => {
    const catMap = new Map<string, string>();
    catMap.set("all", t("card:ach_all"));
    for (const m of medals) {
      const cate = m.achievementData.cate;
      const cateName = m.achievementData.cateName;
      if (!catMap.has(cate)) {
        catMap.set(cate, cateName);
      }
    }
    return Array.from(catMap.entries()).map(([key, label]) => ({ key, label }));
  }, [medals, t]);

  const levelOptions = useMemo(() => {
    const set = new Set<number>();
    for (const m of medals) {
      set.add(effectiveLevel(m));
    }
    return [0, ...[1, 2, 3].filter((l) => set.has(l))];
  }, [medals]);

  const LEVEL_LABELS: Record<number, string> = { 0: t("card:ach_all"), 1: "一级", 2: "二级", 3: "三级" };

  const filteredMedals = useMemo(() => {
    let result = medals;
    if (activeCategory !== "all") {
      result = result.filter((m) => m.achievementData.cate === activeCategory);
    }
    if (levelFilter > 0) {
      result = result.filter((m) => effectiveLevel(m) === levelFilter);
    }
    if (platedFilter === "plated") {
      result = result.filter((m) => m.isPlated);
    } else if (platedFilter === "unplated") {
      result = result.filter((m) => !m.isPlated);
    }
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
    if (useDisplayList) return;
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((i) => i !== id);
      }
      if (prev.length >= 10) return prev;
      return [...prev, id];
    });
  };

  const handleUseDisplayListToggle = () => {
    const newVal = !useDisplayList;
    setUseDisplayList(newVal);
    if (newVal) {
      setSelectedIds([]);
    } else {
      setSelectedIds(medals.slice(0, 10).map((m) => m.achievementData.id));
    }
  };

  return (
    <CustomModal isOpen={isOpen} onClose={onClose} size="xl">
      <CustomModalHeader onClose={onClose}>
        {t("card:ach_select_medals")}
      </CustomModalHeader>
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
                {useDisplayList
                  ? t("card:ach_use_display_list")
                  : t("card:ach_selected_count", { count: selectedIds.length })}
              </span>
              <button
                type="button"
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  useDisplayList
                    ? "bg-primary/10 border-primary text-primary"
                    : "border-separator text-muted hover:border-foreground"
                }`}
                onClick={handleUseDisplayListToggle}
              >
                {useDisplayList
                  ? t("card:ach_manual_select")
                  : t("card:ach_use_display_list")}
              </button>
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
                  const isSelected = useDisplayList ? false : selectedIds.includes(id);
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
                          className="w-14 h-14 shrink-0 overflow-hidden bg-black/20"
                          style={{
                            clipPath: HEX_CLIP,
                            WebkitClipPath: HEX_CLIP,
                          }}
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
                      {!useDisplayList && (
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
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </CustomModalBody>
      <CustomModalFooter>
        <Button variant="secondary" onPress={onClose}>
          {t("card:ach_cancel")}
        </Button>
        <Button
          variant="primary"
          onPress={() => {
            onSave(useDisplayList ? [] : selectedIds, useDisplayList);
            onClose();
          }}
        >
          {t("card:ach_save")}
        </Button>
      </CustomModalFooter>
    </CustomModal>
  );
}
