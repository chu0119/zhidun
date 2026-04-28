```
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   ███████╗██╗  ██╗ ██████╗██╗  ██╗██╗   ██╗ █████╗ ███╗   ██╗║
║   ╚══██╔╝╚██╗██╔╝██╔════╝██║  ██║██║   ██║██╔══██╗████╗  ██║║
║      ██╔╝  ╚███╔╝ ██║     ███████║██║   ██║███████║██╔██╗ ██║║
║     ██╔╝   ██╔██╗ ██║     ██╔══██║██║   ██║██╔══██║██║╚██╗██║║
║    ███████╗██╔╝ ██╗╚██████╗██║  ██║╚██████╔╝██║  ██║██║ ╚████║║
║    ╚══════╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═══╝║
║                    Z H I D U N                                ║
║              AI 驱动的网站日志安全分析系统                      ║
╚══════════════════════════════════════════════════════════════╝
```

<p align="center">
  <img src="https://img.shields.io/badge/Electron-33+-47848F?style=flat-square&logo=electron&logoColor=white" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" />
  <img src="https://img.shields.io/badge/Version-1.0.0-00f0ff?style=flat-square" />
  <img src="https://img.shields.io/badge/License-MIT-ff6b6b?style=flat-square" />
</p>

<p align="center">
  <strong>星川智盾</strong> 是一款基于 AI 的网站日志安全分析桌面应用，<br/>
  支持 <strong>AI 智能分析</strong> 和 <strong>本地规则引擎</strong> 双模式，<br/>
  配备赛博朋克风格 UI、多维度可视化图表、DOCX/PDF 报告导出。
</p>

---

## 功能特性

| 功能 | 说明 |
|------|------|
| **AI 智能分析** | 接入 8 大 AI 平台（DeepSeek、通义千问、智谱、Kimi、文心、Ollama、LM Studio、OpenAI），深度理解日志语义 |
| **本地规则引擎** | 43 条 OWASP/CRS 规则，覆盖 SQL 注入、XSS、命令注入、目录遍历、暴力破解、SSRF、文件上传、WebShell 等 |
| **双模式独立** | AI 分析和本地规则分析完全独立，互不干扰，各自拥有独立的报告页面 |
| **可视化图表** | 攻击类型分布、风险等级统计、攻击源 IP、攻击时间线 — ECharts 科技感图表 |
| **报告导出** | 支持 DOCX（Word）和 PDF 两种格式，专业报告模板，封面页 + 分级标题 + 彩色风险标签 |
| **多编码支持** | 自动检测文件编码（UTF-8、GBK、GB2312 等），支持中文日志 |
| **主题系统** | 7 种赛博朋克主题色：Cyber 青、能量紫、矩阵绿、警报红、深海蓝、经典暗、经典亮 |
| **字体缩放** | 全局字体比例缩放，从 10px 到 40px 自由调节，等比缩放所有文字 |
| **历史记录** | 自动保存分析历史，支持搜索和查看历史报告 |
| **分析中途停止** | 支持随时停止 AI 分析，通过 AbortController 立即中断 HTTP 请求 |

## 截图预览

> **注意**: 请在运行程序后手动截图并放入 `screenshots/` 目录

| 开屏界面 | 主界面 |
|:---:|:---:|
| ![开屏](screenshots/splash.png) | ![主界面](screenshots/main.png) |

| AI 分析过程 | 可视化图表 |
|:---:|:---:|
| ![分析](screenshots/analysis.png) | ![图表](screenshots/charts.png) |

## 快速开始

### 环境要求

- **Node.js** >= 18
- **npm** >= 9

### 安装

```bash
# 克隆项目
git clone https://github.com/your-username/zhidun.git
cd zhidun

# 安装依赖
npm install

# 启动开发模式
npm run dev
```

### 构建打包

```bash
# 构建 Electron 应用
npm run build
```

构建产物位于 `release/` 目录，Windows 平台生成 NSIS 安装包。

## 使用指南

1. **选择日志文件** — 点击左侧"文件选择"区域，支持 `.log` `.txt` `.csv` `.json` `.ndjson` `.jsonl` 格式
2. **配置 AI 模型**（可选）— 在左侧面板选择 AI 提供商，填入 API Key
3. **开始分析**
   - 点击 **"AI 分析"** — 使用 AI 模型深度分析日志
   - 点击 **"本地规则分析"** — 使用本地规则引擎离线分析
4. **查看报告** — 分析完成后自动跳转到对应报告页面
5. **导出报告** — 点击左侧 "PDF" 或 "DOCX" 按钮导出

### 示例数据

项目提供了示例日志文件 `samples/sample-access.log`，包含：
- SQL 注入攻击（UNION、盲注、时间盲注）
- XSS 攻击（反射型、DOM 型、SVG）
- 目录遍历攻击
- 暴力破解尝试
- SSRF 攻击
- WebShell 上传
- 扫描探测行为
- 正常访问请求

## 技术架构

```
src/
├── ai-providers/          # AI 提供商适配层
│   ├── base.ts            # 抽象基类 + AbortController 支持
│   ├── deepseek-provider.ts
│   ├── qwen-provider.ts
│   ├── zhipu-provider.ts
│   ├── kimi-provider.ts
│   ├── wenxin-provider.ts
│   ├── ollama-provider.ts
│   ├── lmstudio-provider.ts
│   ├── openai-provider.ts
│   └── custom-provider.ts
├── components/
│   ├── layout/            # 布局组件
│   │   ├── AppLayout.tsx  # 主布局 + 5 Tab 管理
│   │   ├── TitleBar.tsx   # 自定义标题栏
│   │   ├── Sidebar.tsx    # 左侧控制面板
│   │   └── StatusBar.tsx  # 底部状态栏
│   ├── panels/            # 内容面板
│   │   ├── AnalysisPanel.tsx   # 分析日志面板（AI/本地双模式）
│   │   ├── ReportPanel.tsx     # 详细报告面板（AI/本地双模式）
│   │   └── ChartsPanel.tsx     # 可视化图表面板
│   └── dialogs/           # 弹窗组件
│       ├── SettingsDialog.tsx  # 设置对话框
│       ├── HistoryDialog.tsx   # 历史记录对话框
│       └── SplashOverlay.tsx   # 开屏动画
├── core/                  # 核心引擎
│   ├── analyzer.ts        # AI 分析引擎 + AbortController
│   ├── log-parser.ts      # 日志格式检测
│   ├── log-processor.ts   # 日志预处理 + 采样
│   ├── rule-engine.ts     # 本地规则引擎（43 条 OWASP 规则）
│   ├── report-generator.ts # DOCX/PDF 报告生成
│   ├── pattern-matcher.ts # 正则模式匹配
│   ├── demo-messages.ts   # 分析阶段演示消息
│   └── constants.ts       # 常量定义
├── stores/                # Zustand 状态管理
│   ├── analysis-store.ts  # 分析状态（双 AI/本地独立状态）
│   ├── config-store.ts    # 配置持久化
│   ├── history-store.ts   # 历史记录
│   └── theme-store.ts     # 主题管理
├── styles/
│   ├── globals.css        # 全局样式 + 六边形背景
│   ├── theme.css          # 7 套主题 CSS 变量
│   ├── animations.css     # 18 种动画效果
│   └── cyber-components.css # 赛博朋克 UI 组件库
├── types/                 # TypeScript 类型定义
├── utils/                 # 工具函数
└── App.tsx                # 根组件
electron/
├── main.ts                # Electron 主进程
└── preload.js             # 预加载脚本
```

## AI 提供商

| 提供商 | 默认模型 | 需要 API Key |
|--------|----------|:---:|
| DeepSeek | deepseek-chat | ✅ |
| 通义千问 | qwen-turbo | ✅ |
| 智谱 AI | glm-4-flash | ✅ |
| Kimi | moonshot-v1-8k | ✅ |
| 文心一言 | ernie-speed-128k | ✅ |
| Ollama | qwen2.5:7b | ❌ |
| LM Studio | local-model | ❌ |
| OpenAI | gpt-4o-mini | ✅ |
| 自定义 | - | 可选 |

> **Ollama / LM Studio** 为本地部署方案，无需 API Key，适合内网环境。

## 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+O` | 打开文件 |
| `Ctrl+Enter` | 开始 AI 分析 |
| `Escape` | 停止分析 |
| `Ctrl+H` | 打开历史记录 |
| `Ctrl+,` | 打开设置 |
| `Ctrl+F` | 搜索报告内容 |

## 开发

```bash
# 开发模式（热重载）
npm run dev

# TypeScript 类型检查
npx tsc --noEmit

# 生产构建
npx vite build

# Electron 打包
npm run build
```

## 项目结构

本项目基于以下技术栈构建：

- **Electron 33+** — 跨平台桌面应用框架
- **React 18** — UI 组件库
- **TypeScript 5** — 类型安全
- **Vite 5** — 构建工具
- **Tailwind CSS 3.4** — 原子化 CSS
- **Zustand 4** — 轻量状态管理
- **ECharts 5** — 数据可视化
- **OpenAI SDK** — AI 接口调用
- **docx** — Word 文档生成
- **jsPDF** — PDF 文档生成

## License

MIT License

---

<p align="center">
  <strong>星川智盾</strong> v1.0.0 | 星川智盾安全团队 | &copy; 2025
</p>
