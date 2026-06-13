---
name: plugin-wrapup
description: HanaAgent 插件阶段性开发完成后的收尾工作流。覆盖清理备份、更新技能经验、准备 GitHub 材料、协同写分享文档。MANDATORY TRIGGERS: 收尾, 阶段性完成, 开发完成, 打包发布, wrap up, 插件收尾, 写分享文档, 发到社交平台
compatibility: "纯流程技能，无外部依赖"
default-enabled: false
---
# Plugin Wrapup · 插件收尾工作流

插件开发阶段性完成后执行的标准收尾流程。四个步骤，顺序执行。

## 前置确认

开始前确认：
- 插件在当前 dev slot 中可正常运行
- 所有功能已测试通过
- manifest.json 的 name / title / version / description 已定稿

## 步骤 1：清理 & 备份

```
1. 删除临时文件（test-*.json、*-sketch.html 等）
2. 删除旧版本 zip
3. 重新打包最新版本 zip（包含 app/、routes/、index.js、manifest.json、README.md）
4. 更新开发简报（ariang-rebuild-brief.md 或类似文件），记录最终状态和踩坑清单
```

zip 打包命令参考：
```bash
Compress-Archive -Path "app\*","routes\*","index.js","manifest.json","README.md" -DestinationPath "plugin-name.zip" -Force
```

## 步骤 2：更新技能经验

将本次开发中的可复用经验写入 `hana-plugin-creator` 技能或其他相关技能：

**常见的经验类型：**
- 跨域/CORS 问题的解决方案（同源代理路由）
- 轮询重渲染导致的 UI 问题（状态保持、过渡动画冲突）
- dev 与 community 插件的行为差异
- manifest 元数据缓存机制（dev 可热更，community 需重装）
- 其他在本次开发中踩过的坑

**操作方式：**
在 hana-plugin-creator 的 SKILL.md 中添加新的 "Production Lessons" 条目，
或在已有条目末尾追加。每个条目包含问题描述 + 解决路径。

## 步骤 3：GitHub 材料准备 & 上传

```
1. 确保 README.md 已写好（功能列表、技术要点、安装步骤、配置说明）
2. 确保 .gitignore 已创建
3. 将文件迁移到 projects/<plugin-name>/ 目录
4. 初始化 git 仓库
5. 走浏览器在 github.com/new 创建仓库（Public，不初始化任何文件）
6. 推送到 GitHub
7. 更新 pinned memory 记录仓库地址
```

Git 操作：
```bash
cd projects/<plugin-name>
git init
git add -A
git commit -m "v1.0.0: <简短描述>"
git branch -M main
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

## 步骤 4：协同写分享文档

走 subagent 将写作任务委派给 祈（qi），使用 `qi-writing-voice` 技能。

**委派时需提供：**
- 项目背景（一两句话）
- 开发过程关键节点（挑 2-3 个最有故事性的坑）
- 技术要点（简洁列表）
- 目标平台（小红书/知乎等）
- 风格要求（去 AI 感、有人味、不要流水账）
- 长度要求（800-1500 字）
- 输出路径

**委派模板：**
```
帮 Revm 写一篇社交平台分享文档。

项目背景：<一两句>
关键节点：<2-3 个带冲突感的场景>
技术要点：<简洁列表>
目标平台：小红书/知乎
风格：qi-writing-voice，去 AI 感，有人味
长度：800-1500 字
输出到：D:/Work/OH-WorkSpace/plugins/<name>/share-post.md
```

**发布前审阅：**
- 文档完成后先给 Revm 审阅
- 确认无误后，将文件移至 `docs/` 目录
- 使用易于记忆的文件名，如 `<插件名>开发过程分享.md`
- **不要将分享文档同步到 GitHub**（仅本地保留）

## 注意事项

- 分享文档是社交平台内容，不是技术文档，不要混入 README 或 GitHub
- docs/ 目录是分享文档的归档位置，命名要直观
- 每完成一次收尾，回顾这个技能本身是否有需要更新的地方
