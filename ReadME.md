# 程序作用

可以导入、微调和导出多条航线，每条航线存在一个csv文件中


# 功能枚举:
    - 导入多个csv文件，用于对比或同时编辑多条航线
    - 选择不同的在线底图，不同底图显示的信息不完全相同，在需要的时候切换
    - 开启和关闭编辑状态，防止误操作，不同航线的可编辑状态是独立的
        - 编辑时，须先选择航线，点击加载其中一个点，再拖动修改
        - 添加节点功能有问题，只可在尾节点后添加
        - 删除节点功能没有问题，但是没什么用
        - 重置视图，是将显示中心和缩放倍率初始化，不知道有什么用
    - 测距功能，基本准确，用于参考
    - 平滑半径，用于微调航线时的美观度和可用性
    - 航线列表，用于选择航线(也可在地图中点击航线选择)修改调整，也可用于导出，只导出勾选的航线勾选
    - 制定起点终点并截取航段，用于加载部分航段测试


# 天地图 API 配置

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

## 天地图密钥类型

注意：天地图密钥分为"浏览器端"和"服务端"两种类型：
- **浏览器端密钥**：仅能在客户端 JavaScript 中使用
- **服务端密钥**：可在服务器端（如 Worker 代理）使用

本项目使用 Cloudflare Worker 代理天地图请求，需要使用**服务端密钥**。
