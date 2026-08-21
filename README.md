# 🎵 网易云音乐 Netlify Functions 音频代理

> 基于 Netlify Functions 的网易云音乐音频代理服务，为 [163music Telegram Bot](https://github.com/XiOuDi/163music) 提供高速音频代理。

## ✨ 特性

- **无 CPU 时间限制**：相比 Cloudflare Workers 的 10ms CPU 限制，Netlify Functions 可以处理大文件
- **10秒超时**：足够下载和转发大部分音频文件（标准音质 3-5MB）
- **weapi 加密**：完整实现网易云官方加密协议
- **CDN 缓存**：自动缓存音频 24 小时，重复请求秒回
- **CORS 支持**：支持跨域访问
- **路径重写**：`/audio/{song_id}` 简洁 URL

## 🚀 快速部署

### 一键部署

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/XiOuDi/163music-netlify-proxy)

### 手动部署

1. Fork 本仓库
2. 登录 [Netlify](https://app.netlify.com)
3. 点击 **Add new site** → **Import an existing project**
4. 选择你 Fork 的仓库
5. **Build command**: 留空
6. **Publish directory**: `.`
7. 点击 **Deploy site**

部署完成后，你会获得一个域名，如 `https://your-site.netlify.app`。

## 📖 API 使用

### 请求格式

```
GET https://your-site.netlify.app/audio/{song_id}?quality={quality}&name={name}&artist={artist}
```

### 参数说明

| 参数 | 必填 | 说明 | 默认值 |
|------|------|------|--------|
| `song_id` | ✅ | 网易云歌曲ID | - |
| `quality` | ❌ | 音质：standard/higher/exhigh/lossless | standard |
| `name` | ❌ | 歌曲名（用于文件名） | song_{id} |
| `artist` | ❌ | 艺术家（用于文件名） | 空 |

### 示例

```bash
# 标准音质
curl -o song.mp3 "https://your-site.netlify.app/audio/1824010970"

# 较高音质
curl -o song.mp3 "https://your-site.netlify.app/audio/1824010970?quality=higher"

# 带文件名
curl -o song.mp3 "https://your-site.netlify.app/audio/1824010970?name=泡沫&artist=邓紫棋"
```

## 💰 免费额度

| 项目 | 免费额度 | 超出后 |
|------|----------|--------|
| 请求次数 | 12.5万/月 | $25/百万请求 |
| 运行时间 | 100小时/月 | $0.02/GB-秒 |
| 出站流量 | 100GB/月 | $0.05/GB |
| 函数超时 | 10秒 | 付费版 26秒 |

> 对于个人 Telegram Bot，免费额度完全够用。按每天播放 100 首歌计算，每月约 3000 次请求、3GB 流量。

## 🔧 配置到 Telegram Bot

部署完成后，将代理 URL 配置到 Bot 的环境变量：

### Render 部署

在 Render → Environment 中添加：

```
AUDIO_PROXY_URL=https://your-site.netlify.app
```

### 本地部署

在 `.env` 文件中添加：

```
AUDIO_PROXY_URL=https://your-site.netlify.app
```

> 注意：URL 末尾不要加斜杠 `/`

## 📁 项目结构

```
163music-netlify-proxy/
├── netlify/
│   └── functions/
│       └── audio-proxy.js    # Netlify Functions 音频代理
├── netlify.toml               # Netlify 部署配置
├── .gitignore                 # Git 忽略文件
└── README.md                  # 本文档
```

## 🆚 与 Cloudflare Workers 对比

| 对比项 | Cloudflare Workers | Netlify Functions |
|--------|-------------------|-------------------|
| CPU限制 | 10ms/请求 ⚠️ | 无限制 |
| 超时 | 无明确超时 | 10秒 |
| 冷启动 | ~5ms | ~200ms |
| 大文件处理 | 差 | 好 |
| 免费流量 | 无限（受CPU限制） | 100GB/月 |
| 音频加载速度 | 慢 | 快 |

## ❓ 常见问题

### Q: 音频还是加载慢？
A: 
1. 检查 Netlify Functions 日志，看是否有超时
2. 尝试降低音质（standard 比 higher 小）
3. Netlify 节点主要在海外，国内访问可能有延迟

### Q: 提示 404 无法获取音频地址？
A: 
1. 歌曲可能需要 VIP 或已下架
2. 检查 song_id 是否正确
3. 查看 Netlify Functions 日志获取详细错误

### Q: 如何查看函数日志？
A: Netlify Dashboard → 你的站点 → Functions → audio-proxy → Logs

## 📄 许可证

MIT License

## 🔗 相关项目

- [163music](https://github.com/XiOuDi/163music) - 网易云音乐 Telegram Bot 主项目
