import {
  CustomModal,
  CustomModalHeader,
  CustomModalBody,
} from "./custom-modal";
import { CharacterData, CharacterItem } from "@/types/charDetail";
import { SkillDescription } from "@/utils/skillDescParser";
import { useTranslation } from "react-i18next";
import { Img } from "@/utils/imageLoader";
import { useImageRequest } from "@/utils/imageCacheManager";
import { useMemo } from "react";

interface CharacterDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  character: CharacterData;
  characterItem?: CharacterItem; // 包含 talent 信息
}

export function CharacterDetailModal({
  isOpen,
  onClose,
  character,
  characterItem,
}: CharacterDetailModalProps) {
  const { t } = useTranslation();

  // 调试日志
  console.log("CharacterDetailModal - characterItem:", characterItem);
  console.log("CharacterDetailModal - talent:", characterItem?.talent);
  console.log(
    "CharacterDetailModal - combatTalents count:",
    character.combatTalents.length,
  );

  // 过滤出当前激活的战斗天赋
  const activeCombatTalents = character.combatTalents.filter((talent) => {
    const activeNodes = characterItem?.talent?.latestPassiveSkillNodes || [];
    console.log(
      `Talent ${talent.name} (${talent.id}) - Active nodes:`,
      activeNodes,
      "- Match:",
      activeNodes.includes(talent.id),
    );
    return activeNodes.includes(talent.id);
  });

  console.log("Active combat talents:", activeCombatTalents.length);

  // 过滤出当前激活的能力天赋
  const activeAbilityTalents = character.abilityTalents.filter((talent) => {
    const activeNodes = characterItem?.talent?.attrNodes || [];
    return activeNodes.includes(talent.id);
  });

  // 过滤出当前激活的培养天赋
  const activeCultivationTalents = (character.cultivationTalents || []).filter(
    (talent) => {
      const activeNodes =
        characterItem?.talent?.latestSpaceshipSkillNodes || [];
      return activeNodes.includes(talent.id);
    },
  );

  // Request cache priority for all images in this modal
  const cachePaths = useMemo(() => {
    const paths: string[] = [];
    if (character.avatarSqUrl) paths.push(character.avatarSqUrl);
    if (character.illustrationUrl) paths.push(character.illustrationUrl);
    character.skills.forEach((s) => { if (s.iconUrl) paths.push(s.iconUrl); });
    character.abilityTalents.forEach((t) => { if (t.iconUrl) paths.push(t.iconUrl); });
    character.combatTalents.forEach((t) => { if (t.iconUrl) paths.push(t.iconUrl); });
    (character.cultivationTalents || []).forEach((t) => {
      if (t.iconUrl) paths.push(t.iconUrl);
    });
    return paths;
  }, [character]);

  useImageRequest(cachePaths, [cachePaths]);

  return (
    <CustomModal isOpen={isOpen} onClose={onClose} size="xl" height="fixed">
      <CustomModalHeader onClose={onClose}>
        <div className="flex items-center gap-3">
          <Img
            src={character.avatarSqUrl}
            alt={character.name}
            className="w-16 h-16 rounded-lg object-cover"
          />
          <div>
            <h2 className="text-xl font-bold">{character.name}</h2>
            <p className="text-sm text-muted">
              {character.rarity.value}★ {character.profession.value}
            </p>
          </div>
        </div>
      </CustomModalHeader>

      <CustomModalBody>
        <div className="space-y-6">
          {/* Skills Section */}
          <div>
            <h3 className="text-lg font-semibold mb-3">
              {t("character_detail.skills")}
            </h3>
            <div className="space-y-3">
              {character.skills.map((skill) => (
                <div
                  key={skill.id}
                  className="p-4 bg-content1 rounded-lg border border-separator"
                >
                  <div className="flex items-start gap-3">
                    <Img
                      src={skill.iconUrl}
                      alt={skill.name}
                      className="w-12 h-12 rounded object-cover flex-shrink-0"
                    />
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
              {t("character_detail.talents")}
            </h3>
            <div className="space-y-3">
              {activeCombatTalents.map((talent) => (
                <div
                  key={talent.id}
                  className="p-4 bg-content1 rounded-lg border border-separator"
                >
                  <div className="flex items-start gap-3">
                    <Img
                      src={talent.iconUrl}
                      alt={talent.name}
                      className="w-12 h-12 rounded object-cover flex-shrink-0"
                    />
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
              ))}
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
                <span>{character.property.value}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">
                  {t("character_detail.weapon_type")}:
                </span>
                <span>{character.weaponType.value}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">
                  {t("character_detail.tags")}:
                </span>
                <span>{character.tags.join(", ")}</span>
              </div>
            </div>

            {/* Illustration */}
            <div className="mt-4">
              <Img
                src={character.illustrationUrl}
                alt={`${character.name} ${t("character_detail.illustration")}`}
                className="w-full rounded-lg"
              />
            </div>
          </div>
        </div>
      </CustomModalBody>
    </CustomModal>
  );
}
