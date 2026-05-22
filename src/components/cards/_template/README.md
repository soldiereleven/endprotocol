# 卡片开发模板

## 快速开始

1. **复制此目录**

   ```bash
   cp -r _template my-new-card
   ```

2. **重命名元数据文件**

   ```bash
   mv my-new-card/_template.meta.json my-new-card/my-new-card.meta.json
   ```

3. **编辑元数据文件**
   - 修改 `id` 为你的卡片标识（小写字母和下划线）
   - 修改 `name` 和 `description` 的多语言文本
   - 选择合适的 `icon` emoji
   - 设置 `defaultSize` 默认尺寸

4. **实现卡片组件**
   - 编辑 `index.tsx`
   - 删除模板代码和注释
   - 实现你的业务逻辑

5. **测试**
   - 重启开发服务器
   - 在"添加卡片"对话框中查看新卡片

## 文件说明

- `_template.meta.json`: 卡片元数据配置
- `index.tsx`: 卡片组件实现
- `README.md`: 本说明文件（可选保留或删除）

## 注意事项

- 以 `_` 开头的目录不会被自动注册为卡片
- 确保 meta.json 中的 `id` 全局唯一
- 组件必须使用 `export default`
- 组件 Props 必须符合 `BaseCardProps` 接口

## 参考资源

- [完整开发指南](../../../docs/card_development.md)
- [类型定义](../registry/types.ts)
- [示例卡片](../character-list/)
