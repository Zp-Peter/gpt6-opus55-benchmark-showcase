# Five Folios · 5 个 3D 个人网站

打开 [`dist/index.html`](dist/index.html) 进入总览，选择以下五种风格：

| 风格 | 页面 | 视觉方向 |
| --- | --- | --- |
| Atelier | `dist/atelier.html` | 暖色编辑排版与悬浮纸雕 |
| Orbit | `dist/orbit.html` | 深色宇宙与 3D 行星轨道 |
| Signal | `dist/signal.html` | 粗野主义色块与旋转立方体 |
| Chrome | `dist/chrome.html` | 黑白极简与金属环 |
| Bloom | `dist/bloom.html` | 自然绿色与层叠花朵 |

[`dist/components.html`](dist/components.html) 是独立的交互组件库，包含按钮、筛选、页签、风格切换、作品卡、指标卡、标签、折叠内容、弹窗、轻提示、进度控件与 3D 视觉展示。

所有造型、插画和主要动效均由 HTML/CSS/JavaScript 在浏览器中绘制，无需安装依赖。网页可直接双击打开；使用本地服务预览时，在本目录运行：

```sh
python3 -m http.server 8765 --directory dist
```

然后访问 `http://localhost:8765/`。页面支持桌面与手机布局、键盘操作、减少动态效果设置。字体优先加载 Google Fonts，离线时使用系统回退字体。

人物、项目、经历和邮箱为演示内容。定制时，从 `dist/app.js` 顶部的 `themes` 与 `projects` 数据、页面文案和 `dist/styles.css` 中的主题变量开始修改。`hello@zhiyao.example` 是占位邮箱，正式使用前必须替换。
