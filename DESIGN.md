# 激活码管理控制台 — Design System

> Product register · Restrained accent · DM Sans UI

## Color strategy

**Restrained** — 插件 accent 仅用于主操作、选中态、统计强调；背景保持中性。

### Base tokens (`admin-ui/src/index.css`)

| Token | Role |
|-------|------|
| `--admin-bg` | 页面背景 `#f4f5f7` |
| `--admin-surface` | 卡片 / 面板 `#ffffff` |
| `--admin-surface-muted` | 次级面 `#f6f7f9` |
| `--admin-ink` / `--admin-text` | 主文字 `#151820` |
| `--admin-muted` | 辅助文字 `#525866`（≥4.5:1 on bg） |
| `--admin-primary` | 当前插件 accent（见 plugins.css） |
| `--admin-accent-soft` | 选中背景 12% primary mix |

### Plugin themes (`themes/plugins.css`)

| Plugin | Primary |
|--------|---------|
| flowx | `#4f46a8` |
| cjzs | `#059669` |
| zhiliao | `#8b7355` |
| zhixiao | `#b84332` |

## Typography

- **UI**：`DM Sans` + `Noto Sans SC` — 控制台标题、按钮、表格、表单
- **Display**：`Noto Serif SC` / `Fraunces` — 仅登录页 hero
- **Mono**：`IBM Plex Mono` — 激活码、设备码

Scale ratio ~1.125。控制台 h1 28px / mobile 22px，不 fluid clamp。

## Layout

- Max content `1480px`，padding 20px desktop / 12px mobile
- Breakpoints：`768px` mobile，`1280px` wide（侧栏生成面板）
- Z-index：`--z-sticky: 15`, `--z-nav: 50`, `--z-sheet: 60`, `--z-toast: 70`

## Components

- **Button**：实色 primary，ghost 1px border，danger 浅红底
- **Card**：1px border + `--admin-shadow`，无 nested card 装饰
- **Segmented control**：视图切换（自动 / 表格 / 卡片），≥44px 触摸高度
- **Stats**：色点 + 顶边 accent（mobile），无 4px side-stripe
- **Bottom nav**：mobile 三 Tab，SVG 图标 + 顶条 active 指示

## Motion

150–200ms ease-out，仅状态反馈。`prefers-reduced-motion` 关闭 transform。

## Bans

- Side-stripe `border-left` > 1px 装饰
- Primary 按钮 135° 渐变
- 全大写 tracked eyebrow
- 视图「自动」无 resolved 提示

## Dev

```bash
cd admin-ui && npm run dev   # Vite 本地预览
npm run build:admin          # 根目录 Vercel 构建
```

Impeccable skill: `.cursor/skills/impeccable/`
