# 统一数据查询系统 - 快速参考

## 🚀 快速开始

### 前端调用示例

```typescript
import { roleDataService } from "@/utils/roleDataService";

// 获取完整角色详情
const detail = await roleDataService.getFullCharDetail("role_id_123");

// 获取特定字段
const result = await roleDataService.queryData("role_id_123", "char_detail", [
  "base.name",
  "base.level",
  "chars.0.charData.id",
]);

console.log(result["base.name"]); // "PlayerName"
console.log(result["base.level"]); // 50
```

---

## 📖 API 参考

### RoleDataService

#### queryData(roleId, apiName, paths?)

通用查询方法

**参数**：

- `roleId: string` - 角色 ID
- `apiName: string` - API 名称（如 `'char_detail'`）
- `paths?: string[]` - 路径列表（空数组返回完整数据）

**返回**：`Promise<QueryResult | null>`

**示例**：

```typescript
const result = await roleDataService.queryData("role_123", "char_detail", [
  "base.name",
  "base.level",
]);
// 返回: { 'base.name': 'Player', 'base.level': 50 }
```

#### getFullCharDetail(roleId)

获取完整角色详情

**参数**：

- `roleId: string` - 角色 ID

**返回**：`Promise<any | null>`

**示例**：

```typescript
const detail = await roleDataService.getFullCharDetail("role_123");
console.log(detail.base.name);
console.log(detail.chars[0].charData.name);
```

#### getBaseInfo(roleId)

获取角色基础信息

**参数**：

- `roleId: string` - 角色 ID

**返回**：`Promise<any | null>`

**示例**：

```typescript
const base = await roleDataService.getBaseInfo("role_123");
console.log(base.name, base.level, base.serverName);
```

#### getRoleName(roleId)

获取角色名称

**参数**：

- `roleId: string` - 角色 ID

**返回**：`Promise<string | null>`

**示例**：

```typescript
const name = await roleDataService.getRoleName("role_123");
console.log(name); // "PlayerName"
```

#### getCharacter(roleId, charIndex)

获取指定干员数据

**参数**：

- `roleId: string` - 角色 ID
- `charIndex: number` - 干员索引

**返回**：`Promise<any | null>`

**示例**：

```typescript
const char = await roleDataService.getCharacter("role_123", 0);
console.log(char.charData.name);
```

#### getAllCharIds(roleId)

获取所有干员 ID

**参数**：

- `roleId: string` - 角色 ID

**返回**：`Promise<string[]>`

**示例**：

```typescript
const ids = await roleDataService.getAllCharIds("role_123");
console.log(ids); // ['char_001', 'char_002', ...]
```

#### batchQuery(roleId, paths)

批量查询多个路径

**参数**：

- `roleId: string` - 角色 ID
- `paths: string[]` - 路径列表

**返回**：`Promise<QueryResult | null>`

**示例**：

```typescript
const result = await roleDataService.batchQuery("role_123", [
  "base.name",
  "chars.0.charData.id",
  "chars.1.charData.id",
]);
```

---

## 🔍 路径语法

### 基本规则

路径使用点分格式，支持对象字段和数组索引。

**格式**：`field.subfield.array_index.field`

### 示例

```typescript
// 对象字段访问
'base.name'              // → data.base.name
'base.level'             // → data.base.level

// 数组索引访问（两种方式）
'chars.0'                // → data.chars[0]
'chars.[0]'              // → data.chars[0]（括号可选）

// 嵌套访问
'chars.0.charData.id'    // → data.chars[0].charData.id
'chars.0.skills.0.name'  // → data.chars[0].skills[0].name

// 空路径（返回完整数据）
[]                       // → 返回整个数据对象
```

### 注意事项

1. **数组索引从 0 开始**
2. **路径不存在时返回 null**
3. **路径大小写敏感**
4. **不支持通配符或正则表达式**

---

## 🎯 最佳实践

### 1. 优先使用精确路径

❌ **不推荐**：获取完整数据然后提取字段

```typescript
const detail = await roleDataService.getFullCharDetail(roleId);
const name = detail.base.name;
```

✅ **推荐**：直接查询需要的字段

```typescript
const result = await roleDataService.queryData(roleId, "char_detail", [
  "base.name",
]);
const name = result["base.name"];
```

**优势**：

- 减少数据传输
- 提高性能
- 代码更清晰

### 2. 批量查询相关字段

❌ **不推荐**：多次单独查询

```typescript
const name = await roleDataService.getRoleName(roleId);
const level = await roleDataService.queryData(roleId, "char_detail", [
  "base.level",
]);
```

✅ **推荐**：一次批量查询

```typescript
const result = await roleDataService.batchQuery(roleId, [
  "base.name",
  "base.level",
]);
const name = result["base.name"];
const level = result["base.level"];
```

**优势**：

- 减少 invoke 调用次数
- 提高性能
- 原子性操作

### 3. 错误处理

```typescript
const result = await roleDataService.queryData(roleId, "char_detail", [
  "base.name",
]);

if (!result || !result["base.name"]) {
  console.error("Failed to get role name");
  return;
}

const name = result["base.name"];
```

### 4. 缓存利用

后端已实现缓存机制，重复查询相同数据会直接从内存返回，无需担心性能问题。

---

## 🛠️ 调试技巧

### 1. 查看日志

后端会记录详细的查询日志：

```
[DEBUG] query_role_data: role_id=xxx, api_name=char_detail, paths_count=3
[DEBUG] query_role_data: Extracting path: base.name
[INFO] query_role_data: Successfully retrieved 3 paths for xxx
```

### 2. 浏览器控制台测试

```javascript
// 在浏览器控制台中直接测试
const result = await window.__TAURI__.core.invoke("query_role_data", {
  roleId: "your_role_id",
  apiName: "char_detail",
  paths: ["base.name", "base.level"],
});
console.log(result);
```

### 3. 检查返回数据结构

```typescript
const result = await roleDataService.queryData(roleId, "char_detail", []);
console.log("Available keys:", Object.keys(result));
```

---

## ❓ 常见问题

### Q: 如何知道有哪些可用的路径？

A: 先获取完整数据查看结构：

```typescript
const detail = await roleDataService.getFullCharDetail(roleId);
console.log(JSON.stringify(detail, null, 2));
```

### Q: 路径不存在时会怎样？

A: 返回的值为 `null`：

```typescript
const result = await roleDataService.queryData(roleId, "char_detail", [
  "base.nonexistent",
]);
console.log(result["base.nonexistent"]); // null
```

### Q: 可以查询嵌套数组吗？

A: 可以，使用多级索引：

```typescript
"chars.0.skills.1.desc"; // → data.chars[0].skills[1].desc
```

### Q: 性能如何？

A:

- **缓存命中**：< 10ms
- **缓存未命中**：取决于 API 响应速度（通常 200-500ms）
- **图片处理**：首次加载较慢，后续从缓存读取

### Q: 如何添加新的 API？

A: 见 [IMPLEMENTATION_COMPLETE.md](./IMPLEMENTATION_COMPLETE.md) 中的"扩展新 API"章节。

---

## 📚 更多信息

- [完整实施报告](./IMPLEMENTATION_COMPLETE.md)
- [测试与验收方案](./TEST_AND_ACCEPTANCE.md)
- [源代码](./src/utils/roleDataService.ts)

---

**最后更新**：2026-05-21
