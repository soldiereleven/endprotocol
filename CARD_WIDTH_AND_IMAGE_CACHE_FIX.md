# 卡片宽度优化与图片缓存修复

## 完成的改进

### 1. 修复长方形头像缓存问题

**问题**：后端只缓存了 `avatarSqUrl`（正方形头像），没有缓存 `avatarRtUrl`（长方形头像）。

**修复**：在 `get_char_detail` 命令中添加长方形头像的缓存逻辑。

```rust
// 缓存角色长方形头像
if let Some(ref mut avatar_rt_url_opt) = char_data.avatar_rt_url {
    if !avatar_rt_url_opt.is_empty() && !avatar_rt_url_opt.starts_with("data:") {
        let url_clone = avatar_rt_url_opt.clone();
        match image_cache.get_or_download_image_base64(&url_clone, ImageType::Avatar).await {
            Ok(base64_str) => {
                *avatar_rt_url_opt = base64_str;
            }
            Err(e) => {
                log_warn!("Failed to download rectangular avatar for {}: {}",
                    char_data.name.as_deref().unwrap_or("unknown"), e);
            }
        }
    }
}
```

**效果**：

- ✅ 首次加载时下载并缓存长方形头像
- ✅ 后续从本地缓存读取，无需网络请求
- ✅ 转换为 base64 格式直接嵌入 JSON
- ✅ 离线也能正常显示

---

### 2. 增大卡片宽度和高度

**之前**：

- 最小高度：`min-h-[340px]`
- 宽度：自适应内容

**现在**：

- 最小高度：`min-h-[380px]`（+40px）
- 宽度：`w-full`（占满容器）

**优势**：

- ✅ 充分利用水平空间
- ✅ 更多垂直空间展示角色
- ✅ 视觉更大气

---

### 3. 优化图片容器高度

**之前**：固定高度 `h-40`（160px）

**现在**：固定网格高度 `h-[280px]`，图片 `h-full`

**效果**：

- ✅ 图片高度从 160px 增加到约 280px（+75%）
- ✅ 充分利用卡片下方空间
- ✅ 三个角色均匀分布

---

### 4. 优化文字覆盖层

**之前**：

```tsx
<div className="bg-gradient-to-t from-black/80 to-transparent p-2">
  <p className="text-xs font-semibold">{name}</p>
  <p className="text-[10px]">
    {rarity}★ {profession}
  </p>
</div>
```

**现在**：

```tsx
<div className="bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3">
  <p className="text-sm font-bold">{name}</p>
  <p className="text-xs mt-1">
    {rarity}★ · {profession}
  </p>
</div>
```

**改进**：

- ✅ 渐变更平滑（三层渐变）
- ✅ 内边距更大（p-3 vs p-2）
- ✅ 字体更大更清晰（text-sm + text-xs）
- ✅ 添加分隔符 "·" 提升可读性

---

### 5. 优化空槽位显示

**之前**：简单文字 "Empty"

**现在**：图标 + 文字组合

```tsx
<svg className="w-12 h-12 mb-2 text-muted opacity-50">
  <path d="M12 4v16m8-8H4" />
</svg>
<span>Empty Slot</span>
```

**效果**：

- ✅ 视觉更友好
- ✅ 明确提示可点击添加
- ✅ 与有角色的槽位高度一致

---

### 6. 增加间距

**之前**：`space-y-4`（16px）

**现在**：`space-y-5`（20px）

让标题和图片区域之间有更多呼吸空间。

---

## 📊 尺寸对比

| 元素         | 之前             | 现在             | 增幅          |
| ------------ | ---------------- | ---------------- | ------------- |
| 卡片最小高度 | 340px            | 380px            | +40px (+12%)  |
| 卡片宽度     | 自适应           | w-full           | 充分利用      |
| 图片网格高度 | 自动             | 280px            | 固定高度      |
| 图片高度     | 160px (h-40)     | ~280px (h-full)  | +120px (+75%) |
| 覆盖层内边距 | p-2 (8px)        | p-3 (12px)       | +4px          |
| 名称字体     | text-xs (12px)   | text-sm (14px)   | +2px          |
| 信息字体     | text-[10px]      | text-xs (12px)   | +2px          |
| 垂直间距     | space-y-4 (16px) | space-y-5 (20px) | +4px          |

---

## 🔧 修改的文件

### 1. `src-tauri/src/commands/account.rs`

- 添加长方形头像缓存逻辑
- 位置：第 224-238 行

### 2. `src/components/cards/character-list-card.tsx`

- 卡片宽度改为 `w-full`
- 卡片高度从 340px 增加到 380px
- 图片网格固定高度 280px
- 图片使用 `h-full` 填满容器
- 优化文字覆盖层样式
- 优化空槽位显示

---

## 🎯 用户体验提升

### 视觉效果

- ✅ 卡片更宽大，充分利用屏幕空间
- ✅ 角色头像更大更清晰（+75% 高度）
- ✅ 文字信息更易读
- ✅ 空槽位更友好

### 性能优化

- ✅ 长方形头像也被缓存
- ✅ 减少重复网络请求
- ✅ 支持离线显示
- ✅ 首次加载后秒开

### 交互体验

- ✅ 点击区域更大
- ✅ 悬停效果更明显
- ✅ 视觉层次更清晰

---

## 💡 技术要点

### 图片缓存机制

1. **首次加载**：从 URL 下载图片 → 保存到本地 → 转换为 base64
2. **后续加载**：直接从本地读取 → 返回 base64 字符串
3. **数据格式**：`data:image/png;base64,iVBORw0KGgo...`
4. **存储位置**：`%LOCALAPPDATA%/cn.msk-network.endprotocol/image_cache/avatars/`

### 响应式设计

- 使用 `w-full` 让卡片自适应父容器宽度
- 使用固定高度 `h-[280px]` 确保一致性
- 使用 `object-cover` 保持图片比例

### 渐变遮罩

- 三层渐变：`from-black/90 via-black/60 to-transparent`
- 底部深色保证文字可读性
- 顶部透明不遮挡角色面部

---

## 🚀 下一步建议

1. **添加懒加载**：只在卡片进入视口时加载图片
2. **添加错误处理**：图片加载失败时显示占位图
3. **添加动画**：卡片悬停时的缩放效果
4. **添加拖放**：实现磁贴式布局的拖放功能
5. **添加对齐线**：拖放时的智能对齐提示
