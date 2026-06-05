import { useEffect, useMemo, useState, useCallback, useRef, memo } from "react";
import type { ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Card,
  Button,
  Switch,
  Input,
  Spinner,
  Tabs,
  ListBox,
  Select,
  Label,
} from "@heroui/react";
import { useTranslation } from "react-i18next";
import { getAccounts, getSelectedAccount, type Account } from "@/utils/accountService";
import logger from "@/utils/logger";

type SourceId =
  | "char_detail"
  | "char_wiki_list"
  | "char_wiki_detail"
  | "accounts"
  | "config";

interface SourceDef {
  id: SourceId;
  label: { zh: string; en: string };
  desc: { zh: string; en: string };
  needsRole: boolean;
}

const SOURCES: SourceDef[] = [
  {
    id: "char_detail",
    label: { zh: "角色详情", en: "Char Detail" },
    desc: { zh: "基础信息、干员、技能、天赋等", en: "Base info, chars, skills, talents" },
    needsRole: true,
  },
  {
    id: "char_wiki_list",
    label: { zh: "Wiki 目录", en: "Wiki Catalog" },
    desc: { zh: "Wiki 物品分类目录", en: "Wiki item catalog" },
    needsRole: true,
  },
  {
    id: "char_wiki_detail",
    label: { zh: "Wiki 物品", en: "Wiki Items" },
    desc: { zh: "已加载的 Wiki 物品详情 (合并缓存)", en: "Loaded wiki item details (merged)" },
    needsRole: true,
  },
  {
    id: "accounts",
    label: { zh: "账户列表", en: "Accounts" },
    desc: { zh: "当前登录的账户数据", en: "Currently logged-in accounts" },
    needsRole: false,
  },
  {
    id: "config",
    label: { zh: "应用配置", en: "App Config" },
    desc: { zh: "持久化的应用配置 (ConfigService)", en: "Persisted app config (ConfigService)" },
    needsRole: false,
  },
];

const DEFAULT_CHILD_LIMIT = 50;
const MAX_DEPTH = 32;

function isPrimitive(v: unknown): boolean {
  return v === null || (typeof v !== "object" && typeof v !== "function");
}

function getType(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

function getChildCount(v: unknown): number {
  if (Array.isArray(v)) return v.length;
  if (v && typeof v === "object") return Object.keys(v as object).length;
  return 0;
}

function getChildren(v: unknown): Array<[string | number, unknown]> {
  if (Array.isArray(v)) return v.map((item, i): [number, unknown] => [i, item]);
  if (v && typeof v === "object") {
    return Object.keys(v as object).map((k): [string, unknown] => [k, (v as Record<string, unknown>)[k]]);
  }
  return [];
}

function pathToString(path: (string | number)[]): string {
  if (path.length === 0) return "$";
  let s = "";
  for (const seg of path) {
    if (typeof seg === "number") s += `[${seg}]`;
    else if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(seg)) s += `.${seg}`;
    else s += `["${seg.replace(/"/g, '\\"')}"]`;
  }
  return s.replace(/^\./, "");
}

function pathToKey(path: (string | number)[]): string {
  return path.map((s) => String(s)).join("\u0001");
}

function isPathMatch(pathStr: string, term: string): boolean {
  return pathStr.toLowerCase().includes(term);
}

function isValueMatch(v: unknown, term: string): boolean {
  if (v === null) return "null".includes(term);
  const t = typeof v;
  if (t === "string") return (v as string).toLowerCase().includes(term);
  if (t === "number" || t === "boolean") return String(v).toLowerCase().includes(term);
  return false;
}

function nodeMatches(name: string, value: unknown, term: string): boolean {
  if (!term) return true;
  if (name.toLowerCase().includes(term)) return true;
  if (isValueMatch(value, term)) return true;
  return false;
}

function valueToRawString(v: unknown): string {
  if (v === undefined) return "undefined";
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function highlightText(text: string, term: string): ReactNode {
  if (!term) return text;
  const lower = text.toLowerCase();
  const t = term.toLowerCase();
  const idx = lower.indexOf(t);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-warning/40 text-foreground rounded px-0.5">
        {text.slice(idx, idx + term.length)}
      </mark>
      {text.slice(idx + term.length)}
    </>
  );
}

interface CollectedLeaf {
  path: (string | number)[];
  pathStr: string;
  name: string;
  value: unknown;
}

function collectLeaves(
  value: unknown,
  name: string,
  path: (string | number)[],
  out: CollectedLeaf[],
  depth: number,
  term: string,
): void {
  if (depth > MAX_DEPTH) return;
  if (isPrimitive(value)) {
    if (!term || nodeMatches(name, value, term)) {
      out.push({ path, pathStr: pathToString(path), name, value });
    }
    return;
  }
  for (const [k, v] of getChildren(value)) {
    const childPath = [...path, k];
    const childName = typeof k === "number" ? `[${k}]` : k;
    collectLeaves(v, childName, childPath, out, depth + 1, term);
  }
}

interface JsonNodeProps {
  name: string;
  path: (string | number)[];
  value: unknown;
  depth: number;
  expanded: Set<string>;
  onToggle: (key: string) => void;
  searchTerm: string;
  matchedPaths: Set<string> | null;
  childLimit: number;
  showValues: boolean;
  onCopyPath: (path: string) => void;
  onCopyValue: (value: unknown) => void;
}

const JsonNode = memo(function JsonNode(props: JsonNodeProps) {
  const {
    name,
    path,
    value,
    depth,
    expanded,
    onToggle,
    searchTerm,
    matchedPaths,
    childLimit,
    showValues,
    onCopyPath,
    onCopyValue,
  } = props;

  const key = pathToKey(path);
  const isExp = expanded.has(key);
  const isMatch = matchedPaths ? matchedPaths.has(key) : false;
  const type = getType(value);
  const primitive = isPrimitive(value);
  const childCount = primitive ? 0 : getChildCount(value);

  const [forceExpand, setForceExpand] = useState(false);
  const useLimit = !forceExpand && childCount > childLimit;
  const displayChildren = useLimit ? getChildren(value).slice(0, childLimit) : getChildren(value);

  const isKeyMatch = searchTerm && name.toLowerCase().includes(searchTerm);
  const nameClass = isKeyMatch ? "text-warning font-semibold" : "text-primary";

  return (
    <div className="font-mono text-xs">
      <div
        className={`flex items-start gap-1.5 py-0.5 px-1 rounded hover:bg-default-100 transition-colors ${
          isMatch ? "bg-warning/10" : ""
        }`}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        {!primitive ? (
          <button
            className="shrink-0 w-4 h-4 flex items-center justify-center text-muted hover:text-foreground"
            onClick={() => onToggle(key)}
            aria-label={isExp ? "Collapse" : "Expand"}
          >
            <svg
              className={`w-3 h-3 transition-transform ${isExp ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <span className="shrink-0 w-4 h-4" />
        )}

        <span
          className={`shrink-0 ${nameClass} cursor-pointer hover:underline`}
          onClick={() => onCopyPath(pathToString(path))}
          title="Click to copy path"
        >
          {highlightText(name, searchTerm)}
        </span>

        <span className="text-muted shrink-0">:</span>

        {primitive ? (
          <span
            className="break-all min-w-0 flex-1 cursor-pointer hover:bg-default-200 rounded px-1 -mx-1"
            onClick={() => onCopyValue(value)}
            title="Click to copy value"
          >
            {showValues ? (
              type === "string" ? (
                <span className="text-success">
                  {value === null
                    ? "null"
                    : `"${highlightText(String(value), searchTerm)}"`}
                </span>
              ) : type === "number" ? (
                <span className="text-warning">{String(value)}</span>
              ) : type === "boolean" ? (
                <span className="text-secondary">{String(value)}</span>
              ) : (
                <span className="text-muted">{String(value)}</span>
              )
            ) : (
              <span className="text-muted">[…]</span>
            )}
          </span>
        ) : (
          <span
            className="text-muted shrink-0 cursor-pointer hover:text-foreground"
            onClick={() => onToggle(key)}
            title="Click to toggle"
          >
            {type === "array" ? `Array(${childCount})` : `Object{${childCount}}`}
          </span>
        )}

        <button
          className="shrink-0 text-muted hover:text-primary opacity-0 group-hover:opacity-100"
          onClick={() => onCopyValue(value)}
          title="Copy JSON"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        </button>
      </div>

      {!primitive && isExp && (
        <div>
          {displayChildren.map(([k, v]) => {
            const childPath = [...path, k];
            const childName = typeof k === "number" ? `[${k}]` : k;
            return (
              <JsonNode
                key={pathToKey(childPath)}
                name={childName}
                path={childPath}
                value={v}
                depth={depth + 1}
                expanded={expanded}
                onToggle={onToggle}
                searchTerm={searchTerm}
                matchedPaths={matchedPaths}
                childLimit={childLimit}
                showValues={showValues}
                onCopyPath={onCopyPath}
                onCopyValue={onCopyValue}
              />
            );
          })}
          {useLimit && (
            <div
              className="py-0.5 px-1 text-muted italic"
              style={{ paddingLeft: `${(depth + 1) * 12 + 4}px` }}
            >
              … {childCount - childLimit} more (click to load all)
              <button
                className="ml-2 underline hover:text-primary"
                onClick={() => setForceExpand(true)}
              >
                show all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

interface RawJsonViewProps {
  data: unknown;
  searchTerm: string;
  onCopy: (text: string) => void;
}

function RawJsonView({ data, searchTerm, onCopy }: RawJsonViewProps) {
  const raw = useMemo(() => valueToRawString(data), [data]);
  return (
    <div className="relative group">
      <Button
        size="sm"
        variant="outline"
        className="absolute top-2 right-2 z-10"
        onPress={() => onCopy(raw)}
      >
        copy
      </Button>
      <pre className="font-mono text-xs leading-5 whitespace-pre-wrap break-all p-3 bg-default-50 rounded-lg border border-separator max-h-[60vh] overflow-auto">
        {searchTerm ? highlightText(raw, searchTerm) : raw}
      </pre>
    </div>
  );
}

interface LeavesViewProps {
  data: unknown;
  searchTerm: string;
  onCopy: (text: string) => void;
}

function LeavesView({ data, searchTerm, onCopy }: LeavesViewProps) {
  const leaves = useMemo(() => {
    const arr: CollectedLeaf[] = [];
    collectLeaves(data, "$", [], arr, 0, searchTerm);
    return arr;
  }, [data, searchTerm]);

  if (leaves.length === 0) {
    return (
      <div className="text-sm text-muted italic text-center py-8">
        {searchTerm ? "no matches" : "no leaf values"}
      </div>
    );
  }

  return (
    <div className="max-h-[60vh] overflow-auto border border-separator rounded-lg">
      <table className="w-full text-xs font-mono">
        <thead className="sticky top-0 bg-default-100 z-10">
          <tr className="text-left">
            <th className="px-2 py-1.5 font-semibold w-[45%]">path</th>
            <th className="px-2 py-1.5 font-semibold w-[10%]">type</th>
            <th className="px-2 py-1.5 font-semibold">value</th>
            <th className="px-2 py-1.5 font-semibold w-12"></th>
          </tr>
        </thead>
        <tbody>
          {leaves.slice(0, 2000).map((leaf, idx) => {
            const t = getType(leaf.value);
            const valDisplay =
              t === "string" ? `"${String(leaf.value)}"` : String(leaf.value);
            const truncated = valDisplay.length > 200 ? valDisplay.slice(0, 200) + "…" : valDisplay;
            return (
              <tr key={`${leaf.pathStr}-${idx}`} className="border-t border-separator hover:bg-default-50">
                <td
                  className="px-2 py-1 text-primary cursor-pointer hover:underline align-top"
                  onClick={() => onCopy(leaf.pathStr)}
                  title={leaf.pathStr}
                >
                  {highlightText(leaf.pathStr, searchTerm)}
                </td>
                <td className="px-2 py-1 text-muted align-top">{t}</td>
                <td
                  className={`px-2 py-1 break-all cursor-pointer align-top ${
                    t === "string"
                      ? "text-success"
                      : t === "number"
                        ? "text-warning"
                        : t === "boolean"
                          ? "text-secondary"
                          : "text-muted"
                  }`}
                  onClick={() => onCopy(String(leaf.value))}
                >
                  {highlightText(truncated, searchTerm)}
                </td>
                <td className="px-2 py-1 text-muted align-top">
                  <button
                    className="hover:text-primary"
                    onClick={() => onCopy(valueToRawString(leaf.value))}
                    title="Copy JSON"
                  >
                    ⧉
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {leaves.length > 2000 && (
        <div className="px-2 py-1.5 text-xs text-muted text-center border-t border-separator">
          … showing first 2000 of {leaves.length} leaves
        </div>
      )}
    </div>
  );
}

export default function CacheDataViewer() {
  const { i18n } = useTranslation();
  const isZh = i18n.language === "zh";

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [accountsLoading, setAccountsLoading] = useState(true);

  const [source, setSource] = useState<SourceId>("accounts");
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadEpoch, setLoadEpoch] = useState(0);

  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"tree" | "leaves" | "raw">("tree");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showValues, setShowValues] = useState(true);

  const [copyHint, setCopyHint] = useState<string | null>(null);
  const copyHintTimer = useRef<number | null>(null);

  const currentSource = useMemo(() => SOURCES.find((s) => s.id === source)!, [source]);
  const currentRoleId = useMemo(() => {
    if (!currentSource.needsRole) return null;
    return selectedAccountId ?? accounts[0]?.id ?? null;
  }, [currentSource, selectedAccountId, accounts]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setAccountsLoading(true);
      try {
        const [list, selected] = await Promise.all([getAccounts(), getSelectedAccount()]);
        if (cancelled) return;
        setAccounts(list);
        setSelectedAccountId(selected ?? list[0]?.id ?? null);
      } catch (e) {
        logger.warn("CacheDataViewer: failed to load accounts: " + e, "CacheDataViewer");
      } finally {
        if (!cancelled) setAccountsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        let value: unknown = null;
        if (source === "accounts") {
          value = await invoke<Account[]>("get_accounts");
        } else if (source === "config") {
          value = await invoke<Record<string, unknown>>("get_all_configs");
        } else {
          if (!currentRoleId) {
            if (!cancelled) {
              setData(null);
              setError(isZh ? "请先选择一个账户" : "Please select an account first");
              setLoading(false);
            }
            return;
          }
          const apiName =
            source === "char_detail"
              ? "char_detail"
              : source === "char_wiki_list"
                ? "char_wiki_list"
                : "char_wiki_detail";
          const result = await invoke<Record<string, unknown>>("query_role_data", {
            roleId: currentRoleId,
            apiName,
            paths: [],
          });
          value = result?.__full__ ?? null;
        }
        if (cancelled) return;
        setData(value);
        setExpanded(new Set());
      } catch (e) {
        if (cancelled) return;
        logger.error(`CacheDataViewer: load ${source} failed: ${e}`, "CacheDataViewer");
        setData(null);
        setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [source, currentRoleId, loadEpoch, isZh]);

  const matchedPaths = useMemo<Set<string> | null>(() => {
    const t = searchTerm.trim().toLowerCase();
    if (!t) return null;
    const set = new Set<string>();
    const visit = (val: unknown, name: string, path: (string | number)[]) => {
      if (nodeMatches(name, val, t) || isPathMatch(pathToString(path), t)) {
        for (let i = 0; i <= path.length; i++) {
          set.add(pathToKey(path.slice(0, i)));
        }
      }
      if (isPrimitive(val)) return;
      for (const [k, v] of getChildren(val)) {
        const childName = typeof k === "number" ? `[${k}]` : k;
        visit(v, childName, [...path, k]);
      }
    };
    visit(data, "$", []);
    return set;
  }, [data, searchTerm]);

  const stats = useMemo(() => {
    let nodes = 0;
    let leaves = 0;
    let maxDepth = 0;
    const walk = (val: unknown, depth: number) => {
      if (depth > MAX_DEPTH) return;
      nodes++;
      if (depth > maxDepth) maxDepth = depth;
      if (isPrimitive(val)) {
        leaves++;
        return;
      }
      for (const [, v] of getChildren(val)) {
        walk(v, depth + 1);
      }
    };
    walk(data, 0);
    return { nodes, leaves, maxDepth };
  }, [data]);

  const showCopyHint = useCallback((text: string) => {
    if (copyHintTimer.current !== null) {
      window.clearTimeout(copyHintTimer.current);
    }
    setCopyHint(text);
    copyHintTimer.current = window.setTimeout(() => {
      setCopyHint(null);
      copyHintTimer.current = null;
    }, 1400);
  }, []);

  const copyText = useCallback(
    async (text: string) => {
      const label = text.length > 60 ? text.slice(0, 60) + "…" : text;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
        }
        showCopyHint(`copied: ${label}`);
      } catch (e) {
        showCopyHint(`copy failed`);
        logger.warn("CacheDataViewer: copy failed: " + e, "CacheDataViewer");
      }
    },
    [showCopyHint],
  );

  const handleToggle = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    if (data === null || data === undefined) return;
    const all = new Set<string>();
    const walk = (val: unknown, path: (string | number)[]) => {
      all.add(pathToKey(path));
      if (isPrimitive(val)) return;
      for (const [k, v] of getChildren(val)) {
        walk(v, [...path, k]);
      }
    };
    walk(data, []);
    setExpanded(all);
  }, [data]);

  const collapseAll = useCallback(() => {
    setExpanded(new Set());
  }, []);

  const sourceTabs = useMemo(
    () =>
      SOURCES.map((s) => (
        <Tabs.Tab key={s.id} id={s.id}>
          {isZh ? s.label.zh : s.label.en}
          <Tabs.Indicator />
        </Tabs.Tab>
      )),
    [isZh],
  );

  const accountOptions = useMemo(
    () =>
      accounts.map((acc) => (
        <ListBox.Item key={acc.id} id={acc.id} textValue={`${acc.nickname} (${acc.id})`}>
          {acc.nickname} <span className="text-muted text-xs">· Lv.{acc.level} · {acc.id}</span>
          <ListBox.ItemIndicator />
        </ListBox.Item>
      )),
    [accounts],
  );

  return (
    <Card id="developer-cache-data" className="p-6 bg-content1 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">
            {isZh ? "API 响应缓存查看器" : "API Response Cache Viewer"}
          </h2>
          <p className="text-xs text-muted mt-0.5">
            {isZh
              ? "通过通用查询接口 query_role_data 直接读取后端内存缓存，精确到叶节点值"
              : "Reads backend in-memory caches via the generic query_role_data IPC, down to leaf node values"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onPress={() => setLoadEpoch((e) => e + 1)}
            isDisabled={loading}
          >
            {isZh ? "刷新" : "Refresh"}
          </Button>
        </div>
      </div>

      <Tabs
        selectedKey={source}
        onSelectionChange={(k) => setSource(String(k) as SourceId)}
        variant="secondary"
        className="mb-4"
      >
        <Tabs.ListContainer>
          <Tabs.List aria-label="Cache source" className="flex-wrap">
            {sourceTabs}
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>

      <div className="text-xs text-muted mb-3">
        {isZh ? currentSource.desc.zh : currentSource.desc.en}
      </div>

      {currentSource.needsRole && (
        <div className="mb-4 flex items-center gap-3 flex-wrap">
          <Label className="text-sm shrink-0">
            {isZh ? "账户:" : "Account:"}
          </Label>
          <Select
            className="min-w-[260px] max-w-[400px]"
            isDisabled={accountsLoading || accounts.length === 0}
            selectedKey={currentRoleId}
            onChange={(k) => setSelectedAccountId(String(k))}
            placeholder={isZh ? "选择账户" : "Select an account"}
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>{accountOptions}</ListBox>
            </Select.Popover>
          </Select>
          {currentRoleId && (
            <span className="text-xs text-muted font-mono">
              roleId: {currentRoleId}
            </span>
          )}
        </div>
      )}

      {data !== null && !loading && !error && (
        <>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Input
              className="flex-1 min-w-[200px] h-8"
              placeholder={
                isZh
                  ? "搜索 (路径或值，大小写不敏感)"
                  : "Search (path or value, case-insensitive)"
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="flex items-center gap-1 bg-default-100 p-0.5 rounded-lg">
              {(["tree", "leaves", "raw"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                    viewMode === m
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {m === "tree"
                    ? isZh
                      ? "树"
                      : "Tree"
                    : m === "leaves"
                      ? isZh
                        ? "仅叶子"
                        : "Leaves"
                      : isZh
                        ? "原始"
                        : "Raw"}
                </button>
              ))}
            </div>
            {viewMode === "tree" && (
              <>
                <Button size="sm" variant="outline" onPress={expandAll}>
                  {isZh ? "全部展开" : "Expand all"}
                </Button>
                <Button size="sm" variant="outline" onPress={collapseAll}>
                  {isZh ? "全部折叠" : "Collapse all"}
                </Button>
                <div className="flex items-center gap-1.5 text-xs text-muted">
                  <Switch
                    isSelected={showValues}
                    onChange={setShowValues}
                    size="sm"
                    aria-label="Show values"
                  >
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch>
                  <span>{isZh ? "显示值" : "show values"}</span>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs text-muted mb-2 flex-wrap">
            <span>
              {stats.nodes} {isZh ? "节点" : "nodes"}
            </span>
            <span>
              {stats.leaves} {isZh ? "叶子" : "leaves"}
            </span>
            <span>
              {isZh ? "最大深度" : "max depth"}: {stats.maxDepth}
            </span>
            {searchTerm && matchedPaths && (
              <span>
                {matchedPaths.size} {isZh ? "个路径匹配" : "paths match"}
              </span>
            )}
          </div>
        </>
      )}

      <div className="border border-separator rounded-lg bg-background overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-muted text-sm">
            <Spinner size="sm" />
            {isZh ? "加载中..." : "Loading..."}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="text-danger text-sm font-medium mb-1">
              {isZh ? "加载失败" : "Failed to load"}
            </div>
            <div className="text-xs text-muted font-mono max-w-full break-all">{error}</div>
          </div>
        ) : data === null || data === undefined ? (
          <div className="flex items-center justify-center py-12 text-muted text-sm italic">
            {isZh ? "暂无数据" : "No data"}
          </div>
        ) : viewMode === "tree" ? (
          <div className="max-h-[60vh] overflow-auto p-2 group">
            <JsonNode
              name="$"
              path={[]}
              value={data}
              depth={0}
              expanded={expanded}
              onToggle={handleToggle}
              searchTerm={searchTerm.trim().toLowerCase()}
              matchedPaths={matchedPaths}
              childLimit={DEFAULT_CHILD_LIMIT}
              showValues={showValues}
              onCopyPath={(p) => copyText(p)}
              onCopyValue={(v) => copyText(valueToRawString(v))}
            />
          </div>
        ) : viewMode === "leaves" ? (
          <div className="p-2">
            <LeavesView data={data} searchTerm={searchTerm.trim().toLowerCase()} onCopy={copyText} />
          </div>
        ) : (
          <div className="p-2">
            <RawJsonView
              data={data}
              searchTerm={searchTerm.trim().toLowerCase()}
              onCopy={copyText}
            />
          </div>
        )}
      </div>

      {copyHint && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-foreground text-background px-3 py-1.5 rounded-lg text-xs font-mono shadow-lg animate-slide-down">
          {copyHint}
        </div>
      )}

      <div className="mt-3 text-[11px] text-muted leading-relaxed">
        {isZh ? (
          <>
            <span className="font-semibold">用法:</span>{" "}
            点击键复制路径，点击值复制值，使用搜索框按路径或值过滤，
            切换到「仅叶子」可扁平查看所有原始字段，切换到「原始」可查看完整 JSON。
            所有数据通过 <code className="px-1 bg-default-100 rounded">query_role_data</code>{" "}
            / <code className="px-1 bg-default-100 rounded">get_accounts</code> /{" "}
            <code className="px-1 bg-default-100 rounded">get_all_configs</code>{" "}
            通用接口读取，无后端修改。
          </>
        ) : (
          <>
            <span className="font-semibold">Usage:</span>{" "}
            click a key to copy the path, click a value to copy it, use the search box to filter
            by path or value, switch to <em>Leaves</em> to flatten all primitive fields, or{" "}
            <em>Raw</em> to view the full JSON. All data is read via the generic{" "}
            <code className="px-1 bg-default-100 rounded">query_role_data</code> /{" "}
            <code className="px-1 bg-default-100 rounded">get_accounts</code> /{" "}
            <code className="px-1 bg-default-100 rounded">get_all_configs</code> IPC
            commands — no backend changes required.
          </>
        )}
      </div>
    </Card>
  );
}
