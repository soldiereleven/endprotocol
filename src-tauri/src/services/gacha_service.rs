use serde::de::DeserializeOwned;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};

use crate::models::gacha::{
    GachaApiResponse, GachaMetaData, GachaPoolInfo, GachaRecord, GachaRecordData, GachaSyncProgress,
    GachaSyncResult, SavedGachaData,
};
use crate::utils::{http_client, paths, AppError};
use crate::{log_debug, log_info};

/// ef-webview 抽卡记录服务基础 URL
const EF_WEBVIEW_BASE: &str = "https://ef-webview.hypergryph.com";

/// 与抓包一致的客户端 UA
const GACHA_USER_AGENT: &str = "Mozilla/5.0 (Windows NT 6.2; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) QtWebEngine/5.15.8 Chrome/87.0.4280.144 Safari/537.36 PC/WIN/HGSDK HGWebPC/1.38.1";

/// 同步进度事件名（前端监听）
pub const GACHA_SYNC_PROGRESS_EVENT: &str = "gacha-sync-progress";

/// 无状态服务：负责抽卡记录 API 抓取、本地文件存储与增量同步
pub struct GachaService {
    app_handle: Option<AppHandle>,
}

impl GachaService {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            app_handle: Some(app_handle),
        }
    }

    // ---------- API ----------

    /// GET /api/record/char/meta：获取可用卡池 Tab 列表
    pub async fn get_pool_meta(
        &self,
        u8token: &str,
        server_id: &str,
    ) -> Result<GachaMetaData, AppError> {
        self.get_api("/api/record/char/meta", &[], u8token, server_id)
            .await
    }

    /// GET /api/record/char：拉取一页记录
    /// pool_type 必填；pool_id 仅 joint 类需要；seq_id 为上一页最后一条的 seqId（用于翻页）
    pub async fn get_records_page(
        &self,
        u8token: &str,
        server_id: &str,
        pool_type: &str,
        pool_id: Option<&str>,
        seq_id: Option<&str>,
    ) -> Result<GachaRecordData, AppError> {
        let mut params: Vec<(&str, &str)> = Vec::with_capacity(3);
        params.push(("pool_type", pool_type));
        if let Some(pid) = pool_id {
            params.push(("pool_id", pid));
        }
        if let Some(sid) = seq_id {
            params.push(("seq_id", sid));
        }
        self.get_api("/api/record/char", &params, u8token, server_id)
            .await
    }

    /// 拉取某个 Tab 的完整历史（从最新翻到最旧，hasMore=false 结束）
    pub async fn fetch_pool_records_all(
        &self,
        u8token: &str,
        server_id: &str,
        pool_type: &str,
        pool_id: Option<&str>,
    ) -> Result<Vec<GachaRecord>, AppError> {
        self.fetch_pool_records_until_overlap(
            u8token,
            server_id,
            pool_type,
            pool_id,
            &HashSet::new(),
            None,
        )
        .await
    }

    /// 从最新向前翻页拉取记录，遇到本地已保存的 seqId 即停止（不包含该条）
    /// progress 传入时，每拉取一页都会更新进度并通过 gacha-sync-progress 事件推送；
    /// baseline 为本 Tab 开始前已累计拉取的记录数（用于计算 total_fetched）
    async fn fetch_pool_records_until_overlap(
        &self,
        u8token: &str,
        server_id: &str,
        pool_type: &str,
        pool_id: Option<&str>,
        saved_seq_ids: &HashSet<String>,
        mut progress: Option<(&mut GachaSyncProgress, usize)>,
    ) -> Result<Vec<GachaRecord>, AppError> {
        let mut result = Vec::new();
        let mut seq_id: Option<String> = None;
        let mut page_no = 0;
        loop {
            page_no += 1;
            let page = self
                .get_records_page(u8token, server_id, pool_type, pool_id, seq_id.as_deref())
                .await?;
            log_debug!(
                "gacha: page {} for pool_type={} pool_id={:?} -> {} records, hasMore={}",
                page_no,
                pool_type,
                pool_id,
                page.list.len(),
                page.has_more
            );

            let mut reached_saved = false;
            for rec in &page.list {
                if saved_seq_ids.contains(&rec.seq_id) {
                    reached_saved = true;
                    break;
                }
                result.push(rec.clone());
            }

            // 每翻一页推送一次进度
            if let Some((p, baseline)) = &mut progress {
                p.page = page_no;
                p.tab_fetched = result.len();
                p.total_fetched = *baseline + result.len();
                self.emit_progress(p);
            }

            if reached_saved || !page.has_more || page.list.is_empty() {
                break;
            }
            seq_id = page.list.last().map(|r| r.seq_id.clone());
        }
        Ok(result)
    }

    // ---------- 本地存储 ----------

    /// 抽卡记录文件路径（app_config.json 同级目录）
    pub fn records_file_path(
        &self,
        user_id: &str,
        server_id: &str,
    ) -> Result<PathBuf, AppError> {
        paths::gacha_records_file_path(user_id, server_id).map_err(|e| {
            AppError::ConfigError {
                message: e.to_string(),
            }
        })
    }

    /// 读取本地保存的抽卡记录；文件不存在时返回 None
    pub fn load_records(
        &self,
        user_id: &str,
        server_id: &str,
    ) -> Result<Option<SavedGachaData>, AppError> {
        let path = self.records_file_path(user_id, server_id)?;
        if !path.exists() {
            // 兼容旧位置（与 app_config.json 同级）的存量文件
            let legacy = paths::gacha_records_file_path_legacy(user_id, server_id)
                .map_err(|e| AppError::ConfigError { message: e.to_string() })?;
            if legacy.exists() {
                log_info!(
                    "gacha: load FALLBACK to legacy path for user={} server={}",
                    user_id,
                    server_id
                );
                return Self::read_records_file(&legacy);
            }
            return Ok(None);
        }
        Self::read_records_file(&path)
    }

    fn read_records_file(path: &PathBuf) -> Result<Option<SavedGachaData>, AppError> {
        let content = fs::read_to_string(path)?;
        let data = serde_json::from_str(&content)?;
        Ok(Some(data))
    }

    /// 读取本地记录；不存在时返回空结构
    pub fn load_records_or_empty(
        &self,
        user_id: &str,
        server_id: &str,
    ) -> Result<SavedGachaData, AppError> {
        Ok(self.load_records(user_id, server_id)?.unwrap_or_else(|| {
            SavedGachaData {
                user_id: user_id.to_string(),
                server_id: server_id.to_string(),
                last_sync_time: None,
                pools: HashMap::new(),
                records: Vec::new(),
            }
        }))
    }

    /// 保存抽卡记录到本地文件
    pub fn save_records(
        &self,
        user_id: &str,
        server_id: &str,
        data: &SavedGachaData,
    ) -> Result<(), AppError> {
        let path = self.records_file_path(user_id, server_id)?;
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let content = serde_json::to_string_pretty(data)?;
        fs::write(&path, content)?;
        Ok(())
    }

    // ---------- 同步 ----------

    /// 增量同步抽卡记录（手动触发）：
    /// 1. 拉取 meta 得到全部 Tab
    /// 2. 对每个 Tab 从最新向前翻页，直到遇到本地已保存的 seqId 或翻完（不重复拉取已保存内容）
    /// 3. 按 seqId 去重合并（全局从新到旧），并保存本地文件
    pub async fn sync_records(
        &self,
        user_id: &str,
        server_id: &str,
        u8token: &str,
    ) -> Result<GachaSyncResult, AppError> {
        log_info!(
            "gacha: sync START user={} server={} u8token_len={}",
            user_id,
            server_id,
            u8token.len()
        );

        let mut saved = self.load_records_or_empty(user_id, server_id)?;
        let saved_seq_ids: HashSet<String> =
            saved.records.iter().map(|r| r.seq_id.clone()).collect();
        log_info!(
            "gacha: existing records={} pools={}",
            saved.records.len(),
            saved.pools.len()
        );

        let meta = self.get_pool_meta(u8token, server_id).await?;
        log_info!("gacha: meta tabs={}", meta.tabs.len());

        // 进度跟踪（每页推送 gacha-sync-progress 事件）
        let mut progress = GachaSyncProgress {
            user_id: user_id.to_string(),
            server_id: server_id.to_string(),
            tab_index: 0,
            tab_count: meta.tabs.len(),
            tab_key: String::new(),
            page: 0,
            tab_fetched: 0,
            total_fetched: 0,
            done: false,
        };

        let mut per_tab_new: HashMap<String, i32> = HashMap::new();
        let mut new_records: Vec<GachaRecord> = Vec::new();

        for (tab_index, tab) in meta.tabs.iter().enumerate() {
            progress.tab_index = tab_index;
            progress.tab_key = tab.key.clone();
            progress.page = 0;
            progress.tab_fetched = 0;
            let baseline = progress.total_fetched;

            let fetched = self
                .fetch_pool_records_until_overlap(
                    u8token,
                    server_id,
                    &tab.pool_type,
                    tab.request_pool_id(),
                    &saved_seq_ids,
                    Some((&mut progress, baseline)),
                )
                .await?;
            log_info!("gacha: tab key={} fetched_new={}", tab.key, fetched.len());
            per_tab_new.insert(tab.key.clone(), fetched.len() as i32);
            progress.total_fetched = baseline + fetched.len();
            new_records.extend(fetched);
        }

        let before = saved.records.len();
        saved.records = Self::merge_records(&saved.records, &new_records);
        saved.pools = Self::build_pools_map(&meta, &saved.records);
        saved.last_sync_time = Some(Self::now_ms());

        self.save_records(user_id, server_id, &saved)?;

        // 推送完成进度
        progress.done = true;
        self.emit_progress(&progress);

        let new_count = (saved.records.len() as i64 - before as i64).max(0) as i32;
        log_info!(
            "gacha: sync DONE user={} server={} new={} total={}",
            user_id,
            server_id,
            new_count,
            saved.records.len()
        );

        Ok(GachaSyncResult {
            user_id: user_id.to_string(),
            server_id: server_id.to_string(),
            synced_at: saved.last_sync_time.unwrap_or(0),
            new_records: new_count,
            total_records: saved.records.len() as i32,
            per_tab_new,
        })
    }

    // ---------- 工具方法 ----------

    /// 按 seqId 去重合并记录（新记录在前），结果保证全局从新到旧
    pub fn merge_records(
        existing: &[GachaRecord],
        new_prefix: &[GachaRecord],
    ) -> Vec<GachaRecord> {
        let mut seen: HashSet<String> = HashSet::new();
        let mut merged: Vec<GachaRecord> = Vec::with_capacity(existing.len() + new_prefix.len());
        for rec in new_prefix.iter().chain(existing.iter()) {
            if seen.insert(rec.seq_id.clone()) {
                merged.push(rec.clone());
            }
        }
        merged.sort_by(|a, b| {
            let a_key = (a.seq_id.parse::<i64>().unwrap_or(0), a.gacha_ts_ms().unwrap_or(0));
            let b_key = (b.seq_id.parse::<i64>().unwrap_or(0), b.gacha_ts_ms().unwrap_or(0));
            b_key.cmp(&a_key)
        });
        merged
    }

    /// 构建 poolId -> 卡池信息（meta 中明确给出的 + 记录中出现过的）
    pub fn build_pools_map(
        meta: &GachaMetaData,
        records: &[GachaRecord],
    ) -> HashMap<String, GachaPoolInfo> {
        let mut pools: HashMap<String, GachaPoolInfo> = HashMap::new();
        for tab in &meta.tabs {
            if let Some(pid) = &tab.pool_id {
                pools.insert(
                    pid.clone(),
                    GachaPoolInfo {
                        pool_name: tab.label.clone().unwrap_or_default(),
                        pool_type: tab.pool_type.clone(),
                    },
                );
            }
        }
        for rec in records {
            pools.entry(rec.pool_id.clone()).or_insert_with(|| GachaPoolInfo {
                pool_name: rec.pool_name.clone(),
                pool_type: Self::pool_type_of_pool_id(&rec.pool_id).to_string(),
            });
        }
        pools
    }

    /// 记录 poolId -> 对应的请求 pool_type（special_*/joint_*/standard）
    pub fn pool_type_of_pool_id(pool_id: &str) -> &'static str {
        if pool_id.starts_with("joint_") {
            "E_CharacterGachaPoolType_Joint"
        } else if pool_id.starts_with("standard") {
            "E_CharacterGachaPoolType_Standard"
        } else {
            "E_CharacterGachaPoolType_Special"
        }
    }

    /// 按 poolId 分组记录（组内从新到旧）
    pub fn group_records_by_pool(records: &[GachaRecord]) -> HashMap<String, Vec<GachaRecord>> {
        let mut map: HashMap<String, Vec<GachaRecord>> = HashMap::new();
        for rec in records {
            map.entry(rec.pool_id.clone()).or_default().push(rec.clone());
        }
        map
    }

    /// 稀有度统计（rarity -> 数量），仅统计 draw 记录
    pub fn count_by_rarity(records: &[GachaRecord]) -> HashMap<i32, i32> {
        let mut map: HashMap<i32, i32> = HashMap::new();
        for rec in records {
            if !rec.is_draw() {
                continue;
            }
            if let Some(rarity) = rec.rarity {
                *map.entry(rarity).or_insert(0) += 1;
            }
        }
        map
    }

    /// 角色统计（charId -> 抽到次数），仅统计 draw 记录
    pub fn count_by_char(records: &[GachaRecord]) -> HashMap<String, i32> {
        let mut map: HashMap<String, i32> = HashMap::new();
        for rec in records {
            if !rec.is_draw() {
                continue;
            }
            if let Some(cid) = &rec.char_id {
                *map.entry(cid.clone()).or_insert(0) += 1;
            }
        }
        map
    }

    fn now_ms() -> i64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0)
    }

    /// 推送同步进度事件给前端
    fn emit_progress(&self, progress: &GachaSyncProgress) {
        if let Some(ref handle) = self.app_handle {
            let _ = handle.emit(GACHA_SYNC_PROGRESS_EVENT, progress);
        }
    }

    /// 统一 GET（UA/referer 与抓包一致），校验 code==0 后返回 data
    /// 所有参数（尤其 token）经 query_pairs_mut 做 URL 编码，避免 u8token 中的 +/ 被服务端误解析
    async fn get_api<T: DeserializeOwned>(
        &self,
        endpoint: &str,
        params: &[(&str, &str)],
        u8token: &str,
        server_id: &str,
    ) -> Result<T, AppError> {
        let mut url = reqwest::Url::parse(&format!("{}{}", EF_WEBVIEW_BASE, endpoint))
            .map_err(|e| AppError::ApiError {
                code: 0,
                message: format!("Invalid endpoint: {}", e),
            })?;
        url.query_pairs_mut()
            .append_pair("lang", "zh-cn")
            .append_pair("token", u8token)
            .append_pair("server_id", server_id)
            .extend_pairs(params.iter().copied());

        let referer = format!(
            "{}/page/gacha_char?u8_token={}&channel=1&lang=zh-cn&platform=Windows&server={}&subChannel=1",
            EF_WEBVIEW_BASE,
            urlencoding::encode(u8token),
            urlencoding::encode(server_id),
        );
        let client = http_client::create_client();
        log_debug!("gacha: GET {}", url);
        let response = client
            .get(url)
            .header(reqwest::header::USER_AGENT, GACHA_USER_AGENT)
            .header(reqwest::header::REFERER, referer)
            .header(reqwest::header::ACCEPT, "application/json, text/plain, */*")
            .send()
            .await?;
        let response = response.error_for_status()?;
        let wrapper: GachaApiResponse<T> = response.json().await?;
        if wrapper.code != 0 {
            return Err(AppError::ApiError {
                code: wrapper.code,
                message: wrapper.msg,
            });
        }
        wrapper.data.ok_or_else(|| AppError::ApiError {
            code: 0,
            message: "empty data".to_string(),
        })
    }
}
