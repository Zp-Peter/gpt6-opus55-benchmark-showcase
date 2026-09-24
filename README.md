# Zp Studio · 五项模型实测作品集

本期 GPT-6 / Claude Opus 5.5 视频中实际展示的作品归档。**13 组模型 × 测试组合，合计 21 个作品**。型号沿用录制时标注，归档不构成官方产品规格或能力认证。

仓库目前为私人审阅版本，尚未发布公开试玩站。

## 打开与体验

GitHub 文件页展示源代码，不会直接运行 HTML。下载本仓库 ZIP 并解压，或克隆后，在仓库根目录运行：

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Windows 可用 `py -m http.server 8080 --bind 127.0.0.1`。然后打开 **http://localhost:8080/**，从目录选择作品。不需要安装 Node.js 或重新构建即可浏览已归档的版本。

桌面 Chrome / Edge 等支持 WebGL 的浏览器更适合 3D 场景。部分作品使用 Google Fonts，Claude 网站还使用在线 Three.js CDN，需要联网。广告视频是已渲染 MP4，不需要运行渲染器。

## 收录目录

| 测试 | 模型 | 入口 |
| --- | --- | --- |
| 鹈鹕骑车 | GPT-6 Sol | [打开入口 / 查看文件](benchmarks/pelican/sol/index.html) |
| 鹈鹕骑车 | GPT-6 Luna | [打开入口 / 查看文件](benchmarks/pelican/luna/index.html) |
| 鹈鹕骑车 | GPT-6 Astra | [打开入口 / 查看文件](benchmarks/pelican/astra/index.html) |
| 鹈鹕骑车 | Claude Opus 5.5 | [打开入口 / 查看文件](benchmarks/pelican/opus/index.html) |
| 五种个人网站 | GPT-6 Sol | [打开入口 / 查看文件](benchmarks/websites/sol/index.html) |
| 五种个人网站 | Claude Opus 5.5 | [打开入口 / 查看文件](benchmarks/websites/opus/index.html) |
| 恐龙摧毁城市 | GPT-6 Astra | [打开入口 / 查看文件](benchmarks/dinosaur/astra/播放小城.html) |
| 恐龙摧毁城市 | GPT-6 Sol | [打开入口 / 查看文件](benchmarks/dinosaur/sol/dist/index.html) |
| 恐龙摧毁城市 | Claude Opus 5.5 | [打开入口 / 查看文件](benchmarks/dinosaur/opus/dist/index.html) |
| 模型宣传视频 | GPT-6 Sol | [打开入口 / 查看文件](benchmarks/promo/sol/index.html) |
| 模型宣传视频 | Claude Opus 5.5 | [打开入口 / 查看文件](benchmarks/promo/opus/index.html) |
| 马特洪峰 3D | GPT-6 Astra | [打开入口 / 查看文件](benchmarks/matterhorn/astra/马特洪峰.html) |
| 马特洪峰 3D | Claude Opus 5.5 | [打开入口 / 查看文件](benchmarks/matterhorn/opus/index.html) |

五种网站风格分别作为一组；进入该组首页后可打开全部五个网站。恐龙项目为时间轴动画，保留原有暂停、重播等控制，并非玩家自由控制的完整游戏。

## 代码与复现

- 骑行动画和网站：HTML / CSS / JavaScript 原文件即可运行。
- 恐龙：Astra 含离线单文件、源码及 Three.js；Sol / Opus 含源码与录制对应构建产物 `dist/`。重建时在相应项目目录安装依赖，再执行 `npm run build`；嵌套部署需 `vite build --base=./`。
- 马特洪峰：Astra 含离线单文件、地形与航拍素材及构建源；Opus 含源文件与本地 Three.js。Astra 可在页面中导出 GLB，因此未重复存放 51 MB 的预导出模型。
- 宣传视频：成品及创作源文件均保留。Sol 的 Swift 渲染依赖 macOS；视频源中 Node 依赖使用普通包名，需自行安装 Playwright / Puppeteer Core、NumPy 等工具。渲染源为参考留档，本次未完整重跑视频生成。

原项目说明保存在各目录的 `ORIGINAL_README.md`，其中原有测试、性能和交付描述不等于本次归档重新验证的结果。本次核对见 [收录说明](CURATION.md)。

[第三方素材与许可](THIRD_PARTY.md)。未替原创内容擅自指定开源许可；第三方库与地理数据沿用各自授权和署名要求。
