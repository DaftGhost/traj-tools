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

2. 前端开发模式，推荐同时启动本地 MBTiles 服务：

   ```bash
   MBTILES_DIR=./data/mbtiles bun run dev:mbtiles
   bun run dev
   ```

   前端默认访问地址为 `http://localhost:3000`。

3. 如果需要联调 Worker 代理与本地 MBTiles：

   ```bash
   bun run build
   MBTILES_DIR=./data/mbtiles bun run dev:mbtiles
   MBTILES_PROXY_URL=http://127.0.0.1:3001 bun run dev:worker
   ```

   Worker 默认访问地址为 `http://localhost:8787`。
   `bun run dev:worker` 会直接服务 `dist/` 产物，所以前端改动后需要重新执行 `bun run build`。

4. 如果只需要本地 Worker 代理天地图，也可以直接运行：
   ```bash
   bun run dev:worker
   ```

## 本地 MBTiles 工作流

- `bun run dev:mbtiles` 会启动 Bun 本地服务，扫描 `MBTILES_DIR` 目录下的顶层 `.mbtiles` 文件。
- 栅格 MBTiles 支持 `png`、`jpg`、`jpeg`、`webp`，会作为普通底图显示。
- 矢量 MBTiles 只有在 metadata 中声明 `format=pbf`，且 `json` 字段包含有效 `vector_layers` 时才会加入目录。
- 应用允许栅格与矢量 MBTiles 混合出现，都会出现在底图选择器中。
- 矢量 MBTiles 在界面中显示为 `本地矢量 MBTiles · ...`，服务端会先解压瓦片，再交给浏览器中的 Leaflet VectorGrid 渲染。
- 当前仅提供内置默认矢量样式，项目仍然只使用 Leaflet，不支持自定义矢量样式、标签、sprites、POI 覆盖层或 MapLibre。

## 生产部署

1. 设置 Cloudflare Secrets：

   ```bash
   bunx wrangler secret put TIANDITU_API_KEY
   ```

2. 或在 Cloudflare Dashboard 配置：
   - 进入 Workers & Pages → traj-tools → Settings → Variables
   - 添加 `TIANDITU_API_KEY` 变量

## 命令

| 命令                  | 说明                           |
| --------------------- | ------------------------------ |
| `bun install`         | 安装依赖                       |
| `bun run build`       | 前端类型检查并构建 SPA         |
| `bun run build:all`   | `build` 的别名                 |
| `bun run dev`         | Vite 开发服务器（不含 Worker） |
| `bun run dev:mbtiles` | 本地 MBTiles 目录与瓦片服务    |
| `bun run dev:worker`  | 本地 Worker 开发服务器         |
| `bun run deploy`      | 构建并部署到 Cloudflare        |
| `bun run test`        | 运行测试                       |
| `bun run test:ui`     | Vitest UI                      |
| `bun run test:watch`  | 监听模式运行测试               |
| `bun run typecheck`   | 仅运行前端类型检查             |
| `bun run lint`        | 检查 `src` 下 TS/Vue 文件      |
| `bun run format`      | 格式化 `src` 下文件            |

## 测试

项目使用 Vitest 进行测试，当前已验证 `bun run test` 通过，总计 247 个测试。测试文件位于各模块目录下：

| 测试文件                            | 覆盖模块    |
| ----------------------------------- | ----------- |
| `src/utils/helpers.test.ts`         | 辅助函数    |
| `src/utils/uiStatus.test.ts`        | UI 状态工具 |
| `src/utils/snap.test.ts`            | 吸附工具    |
| `src/types/heatLayer.test.ts`       | 热力图类型  |
| `src/ui/commandDefinitions.test.ts` | 命令定义    |
| `src/routes/index.test.ts`          | 航线操作    |
| `src/export/index.test.ts`          | 导出功能    |

运行测试：

```bash
bun run test        # 运行所有测试
bun run test:watch  # 监听模式
bun run test -- src/utils/snap.test.ts  # 运行单个文件
```

## 天地图密钥类型

注意：天地图密钥分为"浏览器端"和"服务端"两种类型：

- **浏览器端密钥**：仅能在客户端 JavaScript 中使用
- **服务端密钥**：可在服务器端（如 Worker 代理）使用

本项目使用 Cloudflare Worker 代理天地图请求，需要使用**服务端密钥**。
