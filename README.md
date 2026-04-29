<div align="center">

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
╚══════════════════════════════════════════════════════════════╝
```

# 星川智盾 `ZhiDun`

**AI 驱动的网站日志安全分析系统**

![Electron](https://img.shields.io/badge/Electron-33-47848F?style=for-the-badge&logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)

![Version](https://img.shields.io/badge/Version-1.4.0-00f0ff?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-ff6b6b?style=for-the-badge)
![Rules](https://img.shields.io/badge/Security_Rules-65+-22c55e?style=for-the-badge)
![AI Providers](https://img.shields.io/badge/AI_Providers-8-a855f7?style=for-the-badge)

<br/>

**双引擎驱动** — AI 智能分析 + 本地规则引擎，深度检测网站日志中的安全威胁

**8 大 AI 平台** — DeepSeek / 通义千问 / 智谱 / Kimi / 文心 / Ollama / LM Studio / OpenAI

**65+ 条安全规则** — 基于 OWASP CRS 规则库，覆盖 OWASP Top 10 2021，低误报率

</div>

---

## 功能全景

<table>
<tr>
<td width="50%">

### 分析引擎

- **AI 智能分析** — 深度语义理解，生成专业安全报告
- **本地规则引擎** — 65+ 条 OWASP CRS 规则，离线可用
- **双模式独立** — AI 与本地分析互不干扰，独立报告
- **智能采样** — 按威胁评分优先选取样本，控制 Token 用量

</td>
<td width="50%">

### 数据分析面板

- **威胁检测面板** — MITRE ATT&CK 战术映射、CWE 漏洞关联
- **攻击会话面板** — 按 IP 分组攻击序列，展开查看原始日志
- **路径分析面板** — URL 路径排行、攻击热力图、HTTP 方法分布
- **地理分析面板** — GeoIP 世界地图、国家分布、IP 地理定位

</td>
</tr>
<tr>
<td width="50%">

### 可视化 & 导出

- **ECharts 科技感图表** — 10 种图表，自适应缩放
- **攻击时间线** — 基于实际时间戳，自动格式化
- **DOCX 报告导出** — 专业 Word 模板，彩色风险标签
- **PDF 报告导出** — 完美中文渲染，自动分页

</td>
<td width="50%">

### 体验优化

- **7 种赛博朋克主题** — Cyber 青 / 能量紫 / 矩阵绿 ...
- **字体大小可调** — 独立控制日志/报告/图表/面板字号
- **图表自适应** — 字体缩放时图表自动调整尺寸和坐标
- **分析中途停止** — AbortController 立即中断请求

</td>
</tr>
</table>

---

## v1.4.0 更新

### 规则引擎重构

基于 **ModSecurity CRS v4** 和 **OWASP Top 10 2021** 标准，全面重写检测规则：

- 移除 25+ 条高误报规则（管道命令、登录 POST、User-Agent、邮箱、内网 IP 等）
- 所有模式添加 `\b` 词边界，防止子串误匹配
- SQL 注入要求关键字组合（如 `union...select`），而非单个关键字
- SSTI 仅检测明确攻击特征（`{{7*7}}`、`{{__globals__}}`），不再匹配正常模板语法
- 规则分类对齐 OWASP Top 10 2021，新增 AWS 密钥泄露、.NET 反序列化检测
- MITRE ATT&CK 战术映射自动生成，CWE 编号自动关联

### 图表优化

- **攻击时间线** — 从百分比改为实际时间戳（支持 Apache/Nginx、ISO 8601、Syslog 格式）
- **URL 路径排行** — 蝴蝶图布局，攻击向左、正常向右，路径居中显示
- **图表自适应** — 新增 `ScalingChart` 组件，字体缩放时图表自动调整高度和坐标
- **ResizeObserver** — 图表容器尺寸变化时自动触发 ECharts 重绘

### AI 分析优化

- 发送本地分析摘要 + 小样本（每类最多 3 条），总 Token 控制在 2 万以内
- 按威胁评分优先选取高风险样本
- 失败时显示详细错误信息和排查建议

---

## 截图预览

<div align="center">

### 开屏界面
<img src="screenshots/home.png" width="800" alt="开屏界面"/>

### AI 分析过程
<img src="screenshots/ai-analysis.png" width="800" alt="AI 分析过程"/>

### AI 安全分析报告
<img src="screenshots/ai-report.png" width="800" alt="AI 安全分析报告"/>

### 本地规则分析
<img src="screenshots/local-analysis.png" width="800" alt="本地规则分析"/>

### 本地分析报告
<img src="screenshots/local-report.png" width="800" alt="本地分析报告"/>

### 可视化图表
<img src="screenshots/charts.png" width="800" alt="可视化图表"/>

### 威胁检测面板
<img src="screenshots/threat.png" width="800" alt="威胁检测面板"/>

### 地理分析面板
<img src="screenshots/geo.png" width="800" alt="地理分析面板"/>

</div>

---

## 快速开始

### 环境要求

| 依赖 | 版本 |
|:---:|:---:|
| Node.js | >= 18 |
| npm | >= 9 |

### 安装 & 运行

```bash
# 克隆项目
git clone https://github.com/chu0119/zhidun.git
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

---

## 使用指南

```
  ┌─────────────────────────────────────────────────────────┐
  │  1. 选择日志文件  →  .log .txt .csv .json .ndjson       │
  │  2. 配置 AI 模型  →  选择提供商，填入 API Key（可选）   │
  │  3. 开始分析                                            │
  │     ├── AI 分析    →  深度语义分析，生成详细报告        │
  │     └── 本地分析   →  65+ 条规则离线检测，即时出结果    │
  │  4. 查看报告      →  自动跳转到对应报告页面             │
  │  5. 导出报告      →  DOCX / PDF 两种格式                │
  │  6. 数据面板      →  威胁/攻击/会话/路径/地理 5 大分析  │
  └─────────────────────────────────────────────────────────┘
```

### 示例数据

项目提供示例日志文件 `samples/sample-access.log`，包含：

| 攻击类型 | 示例 |
|----------|------|
| SQL 注入 | UNION 注入、盲注、时间盲注 |
| XSS 攻击 | 反射型、DOM 型、SVG |
| 目录遍历 | `../../etc/passwd` |
| 暴力破解 | Hydra、字典攻击 |
| SSRF 攻击 | 内网元数据、file:// 协议 |
| WebShell | 蚁剑、一句话木马 |
| 扫描探测 | Nikto、sqlmap、Nmap |
| 正常流量 | 搜索引擎蜘蛛、正常用户访问 |

---

## AI 提供商

| 提供商 | 默认模型 | API Key |
|:---:|:---:|:---:|
| **DeepSeek** | `deepseek-chat` | 必需 |
| **通义千问** | `qwen-turbo` | 必需 |
| **智谱 AI** | `glm-4-flash` | 必需 |
| **Kimi** | `moonshot-v1-8k` | 必需 |
| **文心一言** | `ernie-speed-128k` | 必需 |
| **Ollama** | `qwen2.5:7b` | 本地部署 |
| **LM Studio** | `local-model` | 本地部署 |
| **OpenAI** | `gpt-4o-mini` | 必需 |

> **Ollama / LM Studio** 为本地部署方案，无需 API Key，适合内网环境。

---

## 本地规则引擎

基于 **ModSecurity CRS v4** 规则库，**65+ 条规则** 覆盖 **19 个攻击类别**：

<table>
<tr>
<td>

| 类别 | 风险等级 |
|:---|:---:|
| SQL 注入 | 🔴 危急 |
| XSS 攻击 | 🔴 危急 |
| 命令注入 | 🔴 危急 |
| WebShell | 🔴 危急 |
| 反序列化攻击 | 🔴 危急 |
| 模板注入 (SSTI) | 🔴 危急 |
| Log4j 注入 | 🔴 危急 |
| Spring 漏洞 | 🔴 危急 |
| SSRF 攻击 | 🔴 危急 |
| 目录遍历 | 🔴 危急 |

</td>
<td>

| 类别 | 风险等级 |
|:---|:---:|
| 文件包含 | 🔴 危急 |
| HTTP 请求走私 | 🔴 危急 |
| HTTP 头注入 | 🔴 危急 |
| JWT 攻击 | 🔴 危急 |
| 敏感文件访问 | 🟠 高危 |
| 攻击工具 | 🟠 高危 |
| 信息泄露 | 🟡 中危 |
| 暴力破解 | 🟡 中危 |
| 爬虫 Bot | 🔵 低危 |

</td>
</tr>
</table>

**设计原则**：高置信度检测、低误报率、面向 Web 日志分析。所有规则使用 `\b` 词边界防止子串匹配，要求多个特征组合而非单关键字。

---

## 技术架构

```
src/
├── ai-providers/              # AI 提供商适配层 (8 个提供商)
│   ├── base.ts                #   抽象基类 + AbortController
│   ├── deepseek-provider.ts   #   DeepSeek
│   ├── qwen-provider.ts       #   通义千问
│   ├── zhipu-provider.ts      #   智谱 AI
│   ├── kimi-provider.ts       #   Kimi
│   ├── wenxin-provider.ts     #   文心一言
│   ├── ollama-provider.ts     #   Ollama (本地)
│   ├── lmstudio-provider.ts   #   LM Studio (本地)
│   ├── openai-provider.ts     #   OpenAI
│   └── custom-provider.ts     #   自定义
├── components/
│   ├── common/                # 通用组件
│   │   └── ScalingChart.tsx   #   自适应缩放图表 (ResizeObserver)
│   ├── layout/                # 布局组件
│   │   ├── AppLayout.tsx      #   主布局 + Tab 管理
│   │   ├── TitleBar.tsx       #   自定义标题栏
│   │   ├── Sidebar.tsx        #   左侧控制面板
│   │   └── StatusBar.tsx      #   底部状态栏
│   ├── panels/                # 内容面板
│   │   ├── AnalysisPanel.tsx  #   分析日志面板
│   │   ├── ReportPanel.tsx    #   详细报告面板
│   │   ├── ChartsPanel.tsx    #   可视化图表 (10 种图表)
│   │   ├── OverviewPanel.tsx  #   分析概览面板
│   │   ├── AttackPanel.tsx    #   攻击分析面板
│   │   ├── AttackSessionPanel.tsx # 攻击会话面板
│   │   ├── ThreatPanel.tsx    #   威胁检测面板 (MITRE ATT&CK)
│   │   ├── PathAnalysisPanel.tsx # 路径分析面板
│   │   ├── GeoPanel.tsx       #   地理分析面板 (GeoIP)
│   │   └── CompliancePanel.tsx #  合规性面板
│   └── dialogs/               # 弹窗组件
│       ├── SettingsDialog.tsx #   设置对话框
│       ├── HistoryDialog.tsx  #   历史记录
│       └── SplashOverlay.tsx  #   开屏动画
├── core/                      # 核心引擎
│   ├── analyzer.ts            #   AI 分析引擎
│   ├── log-parser.ts          #   日志格式检测
│   ├── log-processor.ts       #   日志预处理 + 智能采样
│   ├── rule-engine.ts         #   本地规则引擎 (65+ 条 OWASP CRS 规则)
│   ├── report-generator.ts    #   DOCX/PDF 报告生成
│   ├── pattern-matcher.ts     #   正则模式匹配
│   ├── geoip.ts               #   GeoIP 地理定位
│   ├── world-map.ts           #   世界地图 GeoJSON
│   └── constants.ts           #   常量定义
├── stores/                    # Zustand 状态管理
│   ├── analysis-store.ts      #   分析状态
│   ├── config-store.ts        #   配置持久化
│   ├── history-store.ts       #   历史记录
│   └── theme-store.ts         #   主题管理
└── styles/                    # 赛博朋克样式系统
    ├── globals.css            #   全局样式 + 六边形背景
    ├── theme.css              #   7 套主题 CSS 变量
    ├── animations.css         #   18 种动画效果
    └── cyber-components.css   #   赛博朋克 UI 组件库
```

---

## 键盘快捷键

| 快捷键 | 功能 |
|:---:|:---|
| `Ctrl+O` | 打开文件 |
| `Ctrl+Enter` | 开始 AI 分析 |
| `Escape` | 停止分析 |
| `Ctrl+H` | 打开历史记录 |
| `Ctrl+,` | 打开设置 |
| `Ctrl+F` | 搜索报告内容 |

---

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

---

## 技术栈

| 技术 | 用途 |
|:---:|:---|
| **Electron 33+** | 跨平台桌面应用框架 |
| **React 18** | UI 组件库 |
| **TypeScript 5** | 类型安全 |
| **Vite 5** | 构建工具 |
| **Tailwind CSS 3.4** | 原子化 CSS |
| **Zustand 4** | 轻量状态管理 |
| **ECharts 5** | 数据可视化 |
| **geoip-lite** | 离线 IP 地理定位 |
| **topojson-client** | 世界地图 GeoJSON |
| **docx** | Word 文档生成 |
| **jsPDF + html2canvas** | PDF 文档生成 |

---

## 更新日志

### v1.4.0 (2026-04-29)
- 规则引擎全面重构，基于 OWASP CRS v4，移除 25+ 条高误报规则
- 攻击时间线改为实际时间戳，支持多种日志格式
- URL 路径排行改为蝴蝶图布局
- 新增 ScalingChart 组件，图表自适应字体缩放
- AI 分析优化：智能采样 + Token 控制 + 详细错误信息

### v1.3.0
- 字体大小设置扩展到数据面板
- 修复文件清空后文件名残留问题
- 图表坐标系统随字体缩放自动调整

### v1.2.0
- AI 输入优化：发送分析摘要 + 小样本，控制在 2 万 Token 以内
- AI 失败时显示详细错误信息和排查建议
- 修复 AI 分析静默失败问题

### v1.1.0
- 新增 5 大数据分析面板（威胁/攻击/会话/路径/地理）
- MITRE ATT&CK 战术映射 + 通俗化描述
- 攻击会话按 IP 分组，可展开查看原始日志
- GeoIP 世界地图 + 国家分布
- 修复地图反经线穿越问题

### v1.0.0
- 初始发布
- AI 智能分析 + 本地规则引擎双引擎
- 8 大 AI 平台支持
- DOCX / PDF 报告导出
- 7 种赛博朋克主题

---

<div align="center">

**星川智盾** v1.4.0 | 星川智盾安全团队

![Made with TypeScript](https://img.shields.io/badge/Made_with-TypeScript-blue?style=for-the-badge&logo=typescript)
![Platform](https://img.shields.io/badge/Platform-Windows-0078d4?style=for-the-badge&logo=windows&logoColor=white)

</div>
