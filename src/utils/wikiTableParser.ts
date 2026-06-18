import { WikiDocumentBlock } from "@/types/charDetail";

export interface InlineSegment {
  text: string;
  bold?: boolean;
  underline?: boolean;
  color?: string;
  isDefaultColor?: boolean;
}

export interface WikiSkillParam {
  label: string;
  value: string;
  nextValue?: string;
  highlighted: boolean;
}

export interface WikiTextBlock {
  kind: "heading3" | "text";
  segments: InlineSegment[];
}

export type WikiRenderedBlock =
  | { kind: "text"; data: WikiTextBlock }
  | { kind: "params"; data: WikiSkillParam[] }
  | { kind: "materials"; data: WikiSkillParam[] };

const WIKI_COLOR_MAP: Record<string, string> = {
  "light_text_primary": "#f0e8d8",
  "light_text_secondary": "#5e5e5e",
  "light_text_tertiary": "#787878",
  "light_text_quaternary": "#a7a7a7",
  "light_text_black": "#000000",
  "light_function_yellow": "#cc9900",
  "light_function_orange": "#f45511",
  "light_function_red": "#e54545",
  "light_function_blue": "#1da6e0",
  "light_function_blueness": "#5988ff",
  "light_function_green": "#6d9a00",
  "light_function_turquoise": "#009cad",
  "light_function_sandstone": "#a68360",
  "light_function_brown": "#bb6a26",
  "light_function_violet": "#9959ff",
  "light_rank_gray": "#8c8c8c",
  "light_rank_green": "#6d9a00",
  "light_rank_blue": "#1da6e0",
  "light_rank_purple": "#9959ff",
  "light_rank_yellow": "#cc9900",
  "light_rank_orange": "#e56700",
};

const LEVEL_TO_COLUMN_INDEX = [
  -1,   // level 0
  1,    // level 1  -> col index 1 (RANK 1)
  2,    // level 2  -> col index 2 (RANK 2)
  3,    // level 3  -> col index 3 (RANK 3)
  4,    // level 4  -> col index 4 (RANK 4)
  5,    // level 5  -> col index 5 (RANK 5)
  6,    // level 6  -> col index 6 (RANK 6)
  7,    // level 7  -> col index 7 (RANK 7)
  8,    // level 8  -> col index 8 (RANK 8)
  9,    // level 9  -> col index 9 (RANK 9)
  10,   // level 10 -> col index 10 (专精1)
  11,   // level 11 -> col index 11 (专精2)
  12,   // level 12 -> col index 12 (专精3)
];

function extractCellText(
  cell: any,
  blockMap: Record<string, WikiDocumentBlock>,
): { text: string; highlighted: boolean } | null {
  if (!cell?.childIds?.length) return null;
  const childId = cell.childIds[0];
  const block = blockMap[childId];
  if (!block?.text?.inlineElements) return null;

  let result = "";
  let highlighted = false;
  for (const el of block.text.inlineElements) {
    const anyEl = el as any;
    if (anyEl.kind === "text" || anyEl.kind === "link") {
      if (anyEl.text?.text) {
        result += anyEl.text.text;
        if (anyEl.color === "light_text_primary") {
          highlighted = true;
        }
      }
    }
    if (anyEl.kind === "entry") {
      const entry = anyEl.entry;
      if (entry?.count) {
        result += entry.count;
      }
    }
  }
  return result.trim() ? { text: result.trim(), highlighted } : null;
}

function extractInlineSegments(
  block: WikiDocumentBlock,
): InlineSegment[] | null {
  if (!block?.text?.inlineElements) return null;
  const segments: InlineSegment[] = [];
  for (const el of block.text.inlineElements) {
    const anyEl = el as any;
      if (anyEl.kind === "text" || anyEl.kind === "link") {
        if (anyEl.text?.text) {
          const mapped = anyEl.color ? WIKI_COLOR_MAP[anyEl.color] || anyEl.color : undefined;
          segments.push({
            text: anyEl.text.text,
            bold: anyEl.bold || undefined,
            underline: anyEl.underline || undefined,
            color: anyEl.color === "light_text_primary" ? undefined : mapped,
            isDefaultColor: anyEl.color === "light_text_primary" ? true : undefined,
          });
        }
      }
    if (anyEl.kind === "entry") {
      const entry = anyEl.entry;
      if (entry?.count) {
        segments.push({ text: String(entry.count) });
      }
    }
  }
  return segments.length > 0 ? segments : null;
}

function segmentsToPlainText(segments: InlineSegment[]): string {
  return segments.map((s) => s.text).join("").trim();
}

function parseWikiTable(
  tableBlock: any,
  blockMap: Record<string, WikiDocumentBlock>,
): {
  grid: { label: string; value: string; highlighted: boolean }[][];
  columnHeaders: string[];
} | null {
  const table = tableBlock.table;
  if (!table?.rowIds || !table?.columnIds) return null;

  const rowIds: string[] = table.rowIds;
  const columnIds: string[] = table.columnIds;
  const cellMap: Record<string, any> = table.cellMap || {};

  const columnHeaders: string[] = [];
  for (let ci = 0; ci < columnIds.length; ci++) {
    const colId = columnIds[ci];
    const cellKey = `${rowIds[0]}_${colId}`;
    const cell = cellMap[cellKey];
    const text = extractCellText(cell, blockMap);
    columnHeaders.push(text?.text || colId);
  }

  const grid: { label: string; value: string; highlighted: boolean }[][] = [];

  for (let ri = 1; ri < rowIds.length; ri++) {
    const rowId = rowIds[ri];
    const labelCellKey = `${rowId}_${columnIds[0]}`;
    const labelCell = cellMap[labelCellKey];
    const labelText = extractCellText(labelCell, blockMap);
    if (!labelText) continue;

    const label = labelText.text;
    const rowData: { label: string; value: string; highlighted: boolean }[] = [];

    for (let ci = 1; ci < columnIds.length; ci++) {
      const colId = columnIds[ci];
      const cellKey = `${rowId}_${colId}`;
      const cell = cellMap[cellKey];
      const text = extractCellText(cell, blockMap);
      rowData.push({
        label,
        value: text?.text || "",
        highlighted: text?.highlighted || false,
      });
    }
    grid.push(rowData);
  }

  return { grid, columnHeaders };
}

function isMaterialTable(tableBlock: any): boolean {
  const table = tableBlock.table;
  if (!table?.rowIds || !table?.rowMap) return false;
  const firstRowId = table.rowIds[0];
  const firstRow = table.rowMap[firstRowId];
  return firstRow?.id === "pDCwBZ" || firstRow?.id === "CjgdQD";
}

/**
 * Check if a document's text blocks contain the given name.
 * Matches if either the doc text contains the name OR the name contains the doc text.
 * The latter handles cultivation talents where player name is "管代经验·β"
 * but wiki doc heading is "管代经验".
 */
function docContainsName(
  contentDoc: any,
  name: string,
): boolean {
  if (!contentDoc?.blockMap) return false;
  for (const blockId of contentDoc.blockIds || []) {
    const block = contentDoc.blockMap[blockId] as any;
    if (!block || block.kind === "table" || block.kind === "horizontalLine") continue;
    const segments = extractInlineSegments(block);
    if (!segments) continue;
    const text = segmentsToPlainText(segments);
    if (text && (text.includes(name) || name.includes(text))) return true;
  }
  return false;
}

/**
 * Look up content doc IDs by matching item name.
 * Strategy 1: tab.intro.name === itemName → returns { content, description }
 * Strategy 2: scan content docs for a block containing itemName
 */
function findContentIds(
  widgetCommonMap: Record<string, any> | undefined,
  documentMap: Record<string, any> | undefined,
  itemName: string,
): { contentIds: string[]; descriptionIds: string[] } {
  const result = { contentIds: [] as string[], descriptionIds: [] as string[] };
  if (!widgetCommonMap) return result;

  // Phase 1: Try exact intro.name match (Strategy 1)
  // Only skills have intro.name set (in wy2mIqZc), talents have intro: null
  for (const docKey of Object.keys(widgetCommonMap)) {
    const doc = widgetCommonMap[docKey];
    if (!doc || doc.type !== "common") continue;
    const tabMap = doc.tabDataMap;
    if (!tabMap) continue;

    for (const tabKey of Object.keys(tabMap)) {
      const tab = tabMap[tabKey];
      if (!tab?.intro?.name || tab.intro.name !== itemName) continue;
      if (tab.content) result.contentIds.push(tab.content);
      if (tab.intro?.description) result.descriptionIds.push(tab.intro.description);
    }
  }

  // If exact match found, return (no content-scan contamination)
  if (result.contentIds.length > 0) return result;

  // Phase 2: Scan content docs for name match (for talents without intro.name)
  for (const docKey of Object.keys(widgetCommonMap)) {
    const doc = widgetCommonMap[docKey];
    if (!doc || doc.type !== "common") continue;
    const tabMap = doc.tabDataMap;
    if (!tabMap) continue;

    for (const tabKey of Object.keys(tabMap)) {
      const tab = tabMap[tabKey];
      if (!tab?.content || !documentMap) continue;
      const contentDoc = documentMap[tab.content];
      if (contentDoc && docContainsName(contentDoc, itemName)) {
        result.contentIds.push(tab.content);
      }
    }
  }

  return result;
}

/**
 * Render blocks from a specific content document.
 */
function renderDocumentBlocks(
  doc: any,
  colIdx: number,
  includeMaterials: boolean,
  talentRank = -1,
  nextColIdx = -1,
): WikiRenderedBlock[] {
  const blocks: WikiRenderedBlock[] = [];
  const blockMap: Record<string, WikiDocumentBlock> = doc.blockMap;
  // 标记材料章节：遇到"升级材料"标题后跳过下一张表
  let pendingMaterialSection = false;

  for (const blockId of doc.blockIds) {
    const block = blockMap[blockId] as any;
    if (!block) continue;

    if (block.kind === "heading3" || block.kind === "text") {
      const segments = extractInlineSegments(block);
      if (!segments) continue;
      // Skip upgrade material sections
      const plainText = segmentsToPlainText(segments);
      if (plainText.includes("技能升级材料") || plainText.includes("升级材料")) {
        pendingMaterialSection = true;
        continue;
      }
      pendingMaterialSection = false;
      blocks.push({
        kind: "text",
        data: {
          kind: block.kind === "heading3" || block.text?.kind === "heading3" ? "heading3" : "text",
          segments,
        },
      });
    }

    if (block.kind === "horizontalLine") {
      pendingMaterialSection = false;
      blocks.push({
        kind: "text",
        data: { kind: "text", segments: [{ text: "" }] },
      });
    }

    if (block.kind === "table") {
      // 材料章节后的第一张表直接跳过
      if (pendingMaterialSection) {
        pendingMaterialSection = false;
        continue;
      }

      let isMaterial = isMaterialTable(block);
      if (isMaterial && !includeMaterials) continue;
      if (colIdx < 1 && talentRank < 1) continue;

      const parsed = parseWikiTable(block, blockMap);
      if (!parsed) continue;

      const params: WikiSkillParam[] = [];

      if (talentRank >= 1) {
        const rowIdx = talentRank - 1;
        if (rowIdx < parsed.grid.length) {
          for (let ci = 0; ci < parsed.grid[rowIdx].length; ci++) {
            const cell = parsed.grid[rowIdx][ci];
            const label = parsed.columnHeaders[ci + 1] || "";
            if (label.includes("材料消耗")) continue;
            params.push({
              label,
              value: cell.value,
              highlighted: false,
            });
          }
        }
      } else {
        for (const rowData of parsed.grid) {
          const cell = rowData[colIdx - 1];
          if (cell && cell.value) {
            const nextCell = nextColIdx >= 1 ? rowData[nextColIdx - 1] : undefined;
            params.push({
              label: cell.label,
              value: cell.value,
              nextValue: nextCell?.value,
              highlighted: cell.highlighted,
            });
          }
        }
      }

      if (params.length > 0) {
        blocks.push({ kind: isMaterial ? "materials" : "params", data: params });
      }
    }
  }

  return blocks;
}

export function getWikiRenderedBlocks(
  wikiItemDetail: any,
  itemName: string,
  skillLevel: number,
  itemType: string,
  talentRank = -1,
): WikiRenderedBlock[] {
  if (!wikiItemDetail) return [];

  const doc = wikiItemDetail.document
    || wikiItemDetail.data?.item?.document
    || wikiItemDetail.item?.document;
  if (!doc) return [];

  const documentMap = doc.documentMap;
  const widgetCommonMap = doc.widgetCommonMap;
  if (!documentMap || !widgetCommonMap) return [];

  const colIdx = skillLevel >= 1 && skillLevel <= 12
    ? LEVEL_TO_COLUMN_INDEX[skillLevel]
    : -1;
  const maxLevel = LEVEL_TO_COLUMN_INDEX.length - 1;
  const hasNextLevel = itemType === "skill" && skillLevel >= 1 && skillLevel < maxLevel;
  const nextColIdx = hasNextLevel ? LEVEL_TO_COLUMN_INDEX[skillLevel + 1] : -1;

  // Look up content and description doc IDs by item name
  const { contentIds, descriptionIds } = findContentIds(widgetCommonMap, documentMap, itemName);
  if (contentIds.length === 0 && descriptionIds.length === 0) return [];

  const blocks: WikiRenderedBlock[] = [];

  // Render description documents first (text only, colIdx = -1 to skip tables)
  // Only skills have a separate description doc referenced by tab.description
  if (itemType === "skill") {
    for (const descId of descriptionIds) {
      const descDoc = documentMap[descId] as any;
      if (descDoc?.blockIds && descDoc?.blockMap) {
        blocks.push(...renderDocumentBlocks(descDoc, -1, false));
      }
    }
  }

  // Render content documents (with level-specific data)
  for (const contentId of contentIds) {
    const contentDoc = documentMap[contentId] as any;
    if (contentDoc?.blockIds && contentDoc?.blockMap) {
      blocks.push(...renderDocumentBlocks(contentDoc, colIdx, false, talentRank, nextColIdx));
    }
  }

  return blocks;
}
