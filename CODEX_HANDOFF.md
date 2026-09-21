# Codex 账号切换交接

## 接管指令

用户说“接管此项目”时，先执行以下只读步骤：

1. 读取 `AGENTS.md`、`FRONTEND_ENGINEERING_STANDARD.md` 与本文件。
2. 运行 `git status --short --branch`、`git diff --stat` 与 `git diff`。
3. 暂不修改文件，先用中文总结当前工作现场、风险和建议的下一步，等待用户确认。

## 当前项目

- 项目：猎盈 Customer App 前端。
- 仓库根目录：本目录。
- 技术栈：Vue + Vite；常用命令为 `npm run dev`、`npm run build`、`npm run preview`。
- 该仓库的工作规则在 `AGENTS.md` 和 `FRONTEND_ENGINEERING_STANDARD.md`。

## 切换时现场快照（2026-09-18）

- 分支：`main`，相对 `origin/main` 领先 1 个提交。
- 已修改且未提交：`AGENTS.md`、`FRONTEND_ENGINEERING_STANDARD.md`。
- 未发现未跟踪文件。
- 上述改动的业务意图尚未在交接材料中确认；必须视为用户现有工作，禁止覆盖、回退、格式化或擅自提交。

## Git 安全约束

在用户明确授权前，不执行 `git pull`、`git reset`、`git rebase`、`git checkout --`、`git clean` 或任何可能覆盖本地改动的操作。
