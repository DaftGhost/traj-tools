# traj-tools

航线编辑器 - 基于 Leaflet 的地理轨迹编辑工具

## 功能

- 导入多个 CSV/GeoJSON/WKT 文件
- 微调航线节点位置
- 导出航线数据
- 多底图切换（OpenStreetMap、卫星图、暗色/浅色地图）
- 编辑模式（拖动节点修改航线）
- 测距工具
- 航段截取导出
- 热力图显示

## 项目结构

```
src/
├── main.ts              # 应用入口
├── state/
│   └── store.ts         # 全局状态管理
├── routes/              # 航线 CRUD
│   ├── index.ts        # 路由操作 API
│   └── geometry.ts     # 几何处理
├── map/                # 地图模块
├── tools/              # 工具模块
│   ├── measure.ts      # 测距工具
│   ├── segment.ts     # 航段导出
│   ├── draw.ts        # 绘制工具
│   └── heatmap.ts     # 热力图
├── ui/                 # UI 组件
│   ├── commands.ts     # 命令面板
│   └── index.ts
├── utils/              # 工具函数
│   ├── uiStatus.ts    # UI 状态
│   └── snap.ts        # 吸附工具
├── types/              # 类型定义
│   ├── refs.ts        # 引用类型
│   └── heatLayer.ts   # 热力图类型
├── import/             # 导入
└── export/            # 导出
```

## 天地图 API 配置

天地图底图需要 API Key，配置方式如下：

## 本地开发

1. 创建 `.dev.vars` 文件：
   ```
   TIANDITU_API_KEY=你的天地图密钥
   ```

2. 运行本地开发服务器：
   ```bash
   npm run dev:worker
   ```

## 生产部署

1. 设置 Cloudflare Secrets：
   ```bash
   npx wrangler secret put TIANDITU_API_KEY
   ```

2. 或在 Cloudflare Dashboard 配置：
   - 进入 Workers & Pages → traj-tools → Settings → Variables
   - 添加 `TIANDITU_API_KEY` 变量

## 命令

| 命令 | 说明 |
|------|------|
| `npm install` | 安装依赖 |
| `npm run build` | 构建 SPA |
| `npm run dev` | Vite 开发服务器（不含 Worker） |
| `npm run dev:worker` | 本地 Worker 开发服务器 |
| `npm run deploy` | 构建并部署到 Cloudflare |
| `npm test` | 运行测试 |
| `npm run test:watch` | 监听模式运行测试 |

## 测试

项目使用 Vitest 进行测试，测试文件位于各模块目录下：

| 测试文件 | 覆盖模块 |
|---------|---------|
| `src/utils/helpers.test.ts` | 辅助函数 |
| `src/utils/uiStatus.test.ts` | UI 状态工具 |
| `src/utils/snap.test.ts` | 吸附工具 |
| `src/types/heatLayer.test.ts` | 热力图类型 |
| `src/ui/commandDefinitions.test.ts` | 命令定义 |
| `src/routes/index.test.ts` | 航线操作 |
| `src/export/index.test.ts` | 导出功能 |

运行测试：
```bash
npm test        # 运行所有测试
npm run test:watch  # 监听模式
npx vitest run src/utils/snap.test.ts  # 运行单个文件
```

## 天地图密钥类型

注意：天地图密钥分为"浏览器端"和"服务端"两种类型：
- **浏览器端密钥**：仅能在客户端 JavaScript 中使用
- **服务端密钥**：可在服务器端（如 Worker 代理）使用

本项目使用 Cloudflare Worker 代理天地图请求，需要使用**服务端密钥**。
