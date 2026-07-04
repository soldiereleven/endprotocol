import { useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button, Card, ProgressCircle } from "@heroui/react";
import { Img } from "@/utils/imageLoader";
import { useImageRequest } from "@/utils/imageCacheManager";
import { getSelectedAccount } from "@/utils/accountService";
import { roleDataService } from "@/utils/roleDataService";
import { CharSelectModal } from "@/components/cards/character-list/char-select-modal";
import type { CharDetailData, CharacterItem } from "@/types/charDetail";
import { logError } from "@/utils/logger";

const ICON_BASE = "/assets/icons";
const PROFESSION_ICON = (key: string) => `${ICON_BASE}/profession/${key}.png`;
const PROPERTY_ICON = (key: string) => `${ICON_BASE}/property/${key}.png`;

type FilterKey = "profession" | "rarity" | "property" | "weapon" | "mainAttr" | "subAttr";

function rarityLineColor(value: string): string {
  switch (value) {
    case "6": return "#ff7100";
    case "5": return "#ffcc00";
    case "4": return "#b380ff";
    default: return "transparent";
  }
}

function rarityTone(value: string): "orange" | "gold" | "purple" | "blue" {
  if (value === "6") return "orange";
  if (value === "5") return "gold";
  if (value === "4") return "purple";
  return "blue";
}

const rarityToneClass: Record<string, string> = {
  orange: "text-orange-500",
  gold: "text-yellow-500",
  purple: "text-purple-500",
  blue: "text-blue-500",
};

interface FloatSelectOption {
  value: string;
  label: string;
  tone?: ReturnType<typeof rarityTone>;
}

function FloatSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: FloatSelectOption[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const current = options.find((o) => o.value === value) ?? options[0];

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 h-8 pl-2.5 pr-2 rounded-md border text-xs transition-colors cursor-pointer
          ${open ? "border-blue-500 bg-white dark:bg-neutral-800" : "border-separator bg-white dark:bg-neutral-800 hover:border-blue-400/60"}`}
      >
        <span className="text-muted">{label}</span>
        <span
          className={`font-semibold ${current?.tone ? rarityToneClass[current.tone] : "text-foreground"}`}
        >
          {current?.label ?? "—"}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 12 12"
          className={`w-3 h-3 text-default-500 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path
            fill="currentColor"
            fillRule="evenodd"
            d="M6 8.617 2.04 4.289h7.92z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-50 min-w-full max-h-64 overflow-y-auto rounded-md border border-separator bg-white dark:bg-neutral-900 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-xs whitespace-nowrap transition-colors cursor-pointer
                  ${active ? "bg-blue-500/15 text-blue-500 font-semibold" : "text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
              >
                {opt.tone ? (
                  <span className={rarityToneClass[opt.tone]}>{opt.label}</span>
                ) : (
                  opt.label
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function getSubProperty(char: CharacterItem): string | null {
  const tags = char.charData.tags || [];
  const mainValue = char.charData.property.value;
  for (const tag of tags) {
    if (tag && tag !== mainValue) return tag;
  }
  return null;
}

function OperatorCard({ char, onClick }: { char: CharacterItem; onClick: () => void }) {
  const data = char.charData;
  const coverUrl = data.illustrationUrl || data.avatarRtUrl || data.avatarSqUrl;
  const lineColor = rarityLineColor(data.rarity.value);

  return (
    <div
      className="group relative aspect-[3/4] rounded-lg overflow-hidden border border-separator bg-content1 cursor-pointer transition-all duration-200 hover:border-blue-400/60 hover:shadow-md"
      onClick={onClick}
    >
      <Img
        src={coverUrl}
        alt={data.name}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        loading="lazy"
        draggable={false}
      />
      <div className="absolute inset-x-0 top-0 h-1/5 bg-gradient-to-b from-black/55 to-transparent pointer-events-none" />

      <div className="absolute top-1.5 left-1.5 z-10 flex flex-col gap-0.5">
        <img
          src={PROFESSION_ICON(data.profession.key)}
          alt={data.profession.value}
          title={data.profession.value}
          className="w-6 h-6 object-contain drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
          }}
        />
        <img
          src={PROPERTY_ICON(data.property.key)}
          alt={data.property.value}
          title={data.property.value}
          className="w-6 h-6 object-contain drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
          }}
        />
      </div>

      {char.potentialLevel != null && char.potentialLevel > 0 && (
        <div className="absolute bottom-[33px] right-1.5 z-10">
          <img
            src={`/assets/icons/potential/potential_${char.potentialLevel}.png`}
            alt=""
            className="w-7 h-7 object-contain drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]"
          />
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 z-10">
        <div className="bg-white dark:bg-black px-2 py-1 flex items-center gap-1.5">
          <div className="flex items-center gap-1 shrink-0">
            {char.evolvePhase != null && (
              <img
                src={`/assets/icons/evolve/phase-${char.evolvePhase}.png`}
                alt=""
                className="w-5 h-5 object-contain"
              />
            )}
            {char.level != null && (
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                Lv.{char.level}
              </span>
            )}
          </div>
          <span className="flex-1 min-w-0 text-sm font-medium text-black dark:text-white truncate text-right">
            {data.name}
          </span>
        </div>
        <div
          className="h-[3px] w-full"
          style={{ backgroundColor: lineColor }}
        />
      </div>
    </div>
  );
}

export default function CharactersPage() {
  const { t } = useTranslation();
  const [charDetail, setCharDetail] = useState<CharDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedChar, setSelectedChar] = useState<CharacterItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);

  const [filters, setFilters] = useState<Record<FilterKey, string>>({
    profession: "all",
    rarity: "all",
    property: "all",
    weapon: "all",
    mainAttr: "all",
    subAttr: "all",
  });
  const setFilter = (key: FilterKey, value: string) =>
    setFilters((prev) => ({ ...prev, [key]: value }));
  const resetFilters = () =>
    setFilters({
      profession: "all",
      rarity: "all",
      property: "all",
      weapon: "all",
      mainAttr: "all",
      subAttr: "all",
    });

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const id = await getSelectedAccount();
        if (!id) {
          setIsLoading(false);
          return;
        }
        setAccountId(id);
        const detail = await roleDataService.getFullCharDetail(id);
        if (detail) {
          setCharDetail(detail);
        }
      } catch (error) {
        logError("Failed to load character data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const sortedCharacters = useMemo(() => {
    if (!charDetail) return [];
    return [...charDetail.chars].sort((a, b) => {
      const rA = parseInt(a.charData.rarity.value) || 0;
      const rB = parseInt(b.charData.rarity.value) || 0;
      if (rB !== rA) return rB - rA;
      const lA = a.level ?? 0;
      const lB = b.level ?? 0;
      if (lB !== lA) return lB - lA;
      return a.charData.name.localeCompare(b.charData.name, "zh-Hans-CN");
    });
  }, [charDetail]);

  const uniqueProfessions = useMemo(
    () =>
      Array.from(
        new Set(charDetail?.chars.map((c) => c.charData.profession.value) ?? []),
      ).sort(),
    [charDetail],
  );

  const uniqueProperties = useMemo(
    () =>
      Array.from(
        new Set(charDetail?.chars.map((c) => c.charData.property.value) ?? []),
      ).sort(),
    [charDetail],
  );

  const uniqueRarities = useMemo(
    () =>
      Array.from(
        new Set(charDetail?.chars.map((c) => c.charData.rarity.value) ?? []),
      ).sort((a, b) => parseInt(b) - parseInt(a)),
    [charDetail],
  );

  const uniqueWeapons = useMemo(
    () =>
      Array.from(
        new Set(charDetail?.chars.map((c) => c.charData.weaponType.value) ?? []),
      ).sort(),
    [charDetail],
  );

  const uniqueMainAttrs = uniqueProperties;

  const uniqueSubAttrs = useMemo(() => {
    if (!charDetail) return [];
    const set = new Set<string>();
    charDetail.chars.forEach((c) => {
      const sub = getSubProperty(c);
      if (sub) set.add(sub);
    });
    return Array.from(set).sort();
  }, [charDetail]);

  const filteredCharacters = useMemo(() => {
    if (!sortedCharacters.length) return [];
    return sortedCharacters.filter((char) => {
      const data = char.charData;
      if (filters.profession !== "all" && data.profession.value !== filters.profession) return false;
      if (filters.rarity !== "all" && data.rarity.value !== filters.rarity) return false;
      if (filters.property !== "all" && data.property.value !== filters.property) return false;
      if (filters.weapon !== "all" && data.weaponType.value !== filters.weapon) return false;
      if (filters.mainAttr !== "all" && data.property.value !== filters.mainAttr) return false;
      if (filters.subAttr !== "all") {
        const sub = getSubProperty(char);
        if (sub !== filters.subAttr) return false;
      }
      return true;
    });
  }, [sortedCharacters, filters]);

  const gridAvatarPaths = useMemo(
    () =>
      (charDetail?.chars
        .map(
          (c) =>
            c.charData.illustrationUrl ||
            c.charData.avatarRtUrl ||
            c.charData.avatarSqUrl,
        )
        .filter(Boolean) as string[]) || [],
    [charDetail],
  );
  useImageRequest(gridAvatarPaths, [gridAvatarPaths]);

  const handleCharClick = (char: CharacterItem) => {
    setSelectedChar(char);
    setIsDetailOpen(true);
  };

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setSelectedChar(null);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
          {t("sidebar.characters")}
        </h1>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <ProgressCircle isIndeterminate size="lg" aria-label="Loading">
            <ProgressCircle.Track>
              <ProgressCircle.TrackCircle />
              <ProgressCircle.FillCircle />
            </ProgressCircle.Track>
          </ProgressCircle>
        </div>
      ) : !charDetail || charDetail.chars.length === 0 ? (
        <Card className="p-12 bg-content1 shadow-md border border-separator">
          <div className="text-center">
            <svg
              className="w-16 h-16 mx-auto mb-4 opacity-50 text-muted"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <p className="text-lg font-medium text-foreground">
              {t("common.no_results_found")}
            </p>
          </div>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <FloatSelect
              label={t("filters.profession")}
              value={filters.profession}
              options={[
                { value: "all", label: t("filters.all_professions") },
                ...uniqueProfessions.map((v) => ({ value: v, label: v })),
              ]}
              onChange={(v) => setFilter("profession", v)}
            />
            <FloatSelect
              label={t("filters.rarity")}
              value={filters.rarity}
              options={[
                { value: "all", label: t("filters.all_rarities") },
                ...uniqueRarities.map((v) => ({
                  value: v,
                  label: `${v}★`,
                  tone: rarityTone(v),
                })),
              ]}
              onChange={(v) => setFilter("rarity", v)}
            />
            <FloatSelect
              label={t("filters.property")}
              value={filters.property}
              options={[
                { value: "all", label: t("filters.all_properties") },
                ...uniqueProperties.map((v) => ({ value: v, label: v })),
              ]}
              onChange={(v) => setFilter("property", v)}
            />
            <FloatSelect
              label={t("filters.weapon")}
              value={filters.weapon}
              options={[
                { value: "all", label: t("filters.all_weapons") },
                ...uniqueWeapons.map((v) => ({ value: v, label: v })),
              ]}
              onChange={(v) => setFilter("weapon", v)}
            />
            <FloatSelect
              label={t("filters.mainAttr")}
              value={filters.mainAttr}
              options={[
                { value: "all", label: t("filters.all_mainAttrs") },
                ...uniqueMainAttrs.map((v) => ({ value: v, label: v })),
              ]}
              onChange={(v) => setFilter("mainAttr", v)}
            />
            <FloatSelect
              label={t("filters.subAttr")}
              value={filters.subAttr}
              options={[
                { value: "all", label: t("filters.all_subAttrs") },
                ...uniqueSubAttrs.map((v) => ({ value: v, label: v })),
              ]}
              onChange={(v) => setFilter("subAttr", v)}
            />

            <Button
              size="sm"
              variant="outline"
              isIconOnly
              aria-label={t("common.clear")}
              onPress={resetFilters}
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
            </Button>
          </div>

          {filteredCharacters.length === 0 ? (
            <div className="text-center py-8 text-muted">
              <p>{t("common.no_results_found")}</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2.5">
              {filteredCharacters.map((char) => (
                <OperatorCard
                  key={char.charData.id}
                  char={char}
                  onClick={() => handleCharClick(char)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {selectedChar && accountId && charDetail && (
        <CharSelectModal
          isOpen={isDetailOpen}
          onClose={handleCloseDetail}
          charDetail={charDetail}
          selectedCharIds={[]}
          onSave={() => {}}
          roleId={accountId}
          initialCharId={selectedChar.charData.id}
          initialViewMode="detail"
        />
      )}
    </div>
  );
}
