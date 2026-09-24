# 马特洪峰 · Alpine Atlas

直接用 Chrome、Edge 或其他支持 WebGL 2 的现代浏览器打开 **马特洪峰.html**。无需安装、联网或启动服务器。

## 操作

- 拖动画面旋转，滚轮或双指缩放。
- 底部切换经典视角、北壁、东壁与俯瞰。
- 环境面板切换晴日与金色时刻，调节新增积雪、远山薄雾。手机上点击右上角设置按钮展开。
- 工具栏依次为：放大、缩小、自动环绕、山峰标注、等高线、保存 PNG、复位视角。
- 点击三维画面后，可使用方向键旋转，`+` / `-` 缩放，`R` 复位。
- 右上角可导出 GLB。交付包也已包含 `Matterhorn.glb`。

## 模型与数据

主山体使用 **swisstopo swissALTI3D 2024** 的 2 米网格源数据，重采样为 8 米间距；主山体 564,001 个顶点、1,125,000 个三角面。包括远景的总场景为 1,297,800 个三角面。

核心范围为瑞士 LV95 坐标 E 2,614,000–2,620,000、N 1,089,000–1,095,000，即 6 × 6 公里。Three.js 坐标原点对应 LV95 E 2,617,050、N 1,091,650，海拔 2,500 米；X 朝东、Y 向上、Z 朝南，1 单位为 1 米，垂直比例 1:1。显示网格最高点为海拔约 4,476.5 米；界面标示 4,478 米是山峰公布海拔，并非篡改采样结果。

SWISSIMAGE 航空影像通过官方 WMS 获得，导出分辨率 3,072 × 3,072（约 1.95 米/像素）。仅进行轻微提亮，未用生成图片代替山体。影像保留拍摄时的雪况与阴影；新增积雪、光照和远山材质为视觉模拟，不代表实时天气或完全去阴影的物理材质。

瑞士数据边界的缺测区和远景用 Mapzen Terrain Tiles 补全，并在接缝处过渡。境外与远景精度较低。源数据瓦片与请求信息见 `assets/data-manifest.json`。高程场无法表达岩檐底部、洞穴等多层垂直结构；这是基于真实地形的视觉重建，不是完整摄影测量扫描，也不用于测绘或登山导航。

`Matterhorn.glb` 包含核心山体、法线、UV、内嵌航空影像和标准 PBR 材质，可供 Blender、Unity、其他 Three.js 项目等导入。GLB 不包含浏览器中的模拟积雪、雾、天空、灯光和界面。已检查导出容器、几何与内嵌纹理，未逐一验证其他三维软件的导入效果。

## 验证

已用独立的 macOS Chrome / WebGL 2 浏览器会话实际打开离线 HTML，检查拖动、按钮及键盘旋转缩放、四个视角、积雪与雾、日照、自动环绕、标注和等高线、弹窗、PNG 与 GLB 下载。检查 1440 × 960 与 390 × 844 布局、减少动态效果偏好。页面与控制台无错误，无网络请求。详细记录见 `evidence/verification.json`。

手机布局由桌面浏览器模拟验证；尚未在实体手机、Safari 或 Windows 上实测。复杂模型的流畅度取决于显卡与设备。

## 修改源码

编辑 `src/app.js`、`src/style.css` 或 `src/template.html`。`src/terrain-data.js` 已包含离线高程与影像数据。

安装 Node.js 后，在本目录运行：

```sh
npm ci
npm run build
```

这会重新生成单文件 `马特洪峰.html`。日常打开成品不需要 Node.js。

## 数据来源与署名

- **© swisstopo** — [swissALTI3D](https://www.swisstopo.admin.ch/en/height-model-swissalti3d)、[SWISSIMAGE](https://www.swisstopo.admin.ch/en/orthoimage-swissimage-10)、[官方 STAC 服务](https://data.geo.admin.ch/api/stac/v0.9/collections/ch.swisstopo.swissalti3d)。
- **Mapzen Terrain Tiles** — [AWS 开放数据](https://registry.opendata.aws/terrain-tiles/)，访问日期 2026-09-22。Europe terrain data produced using Copernicus data and information funded by the European Union — EU-DEM layers; global GMTED2010 and SRTM terrain data courtesy of the U.S. Geological Survey. [数据署名说明](https://github.com/tilezen/joerd/blob/master/docs/attribution.md)。
- **Three.js 0.180.0** — MIT；许可证见 `assets/THREE-LICENSE.txt`。
