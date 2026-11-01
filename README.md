# 小牧场 · 3D 天气网页

运行在浏览器里的 Three.js 网页应用，电脑端为主要体验。无需安装手机 App；窄窗口仅做网页响应式适配。当前使用演示天气，尚未连接天气服务。

本地预览：<http://localhost:4173/>

## 已完成

- 独立的真实 3D 房屋、有限地形、牛、羊、马、锦鲤和体积云；房屋及山坡背面都有结构。
- 左右拖动可绕 Y 轴完整环绕，俯视角度保持固定；滚轮缩放、自动环绕、视角复位，画布支持左右方向键与 R 键。
- 10 种演示状态：晴、阴、小雨、中雨、大雨、雷阵雨、小雪、薄雾、有风、晴夜。
- 雨雪、雷电、水波、鱼群游动、草地随风、动物吃草与移动；雨雪和夜间减少外出动物。
- 左上玻璃天气卡、右侧四个动态仪表、可点击三日预报、演示城市搜索。
- 场景环境读取用户本地时间，自动分为清晨、白天、黄昏、夜间；太阳方位、天空、环境光、房屋和路灯随之变化。
- 按本地月份切换季节：秋天植被变黄，落叶从树冠落到地面；冬天/积雪时地表覆盖白雪并出现雪人。
- 天气云形分开设计：晴空万里无云，阴天为 4 片层积云，小雨 2 片薄雨云、中雨 3 片连绵雨云、大雨和雷阵雨 4 片厚云，小雪为 4 片柔和层云。云层按后山、前草地和两侧分布，背面山顶也有覆盖；体积渲染保留柔边、自阴影和内部疏密，雨雪从云底落到地表。
- 秋叶从原地形模型的 6 棵真实树冠表面脱落，轻微翻转、落在树旁裸地并停留。雷阵雨包含局部云内亮闪、云底分叉立体闪电；天气菜单可重复演示闪电并单独开启雷声，默认静音。
- 网页界面支持中文/英文切换，语言偏好保存在浏览器中。
- 积雪按城市保存在浏览器中，每小时消融 0.012。下雪后选择“明天”，即使晴天也保留积雪；重新载入也保留。天气菜单的“融化积雪”可复位演示。
- 明确的载入进度与失败重试。

## 素材与动画

`assets/tripo-inputs/` 保存同一视觉方向的原始参考图。`assets/tripo-originals/` 保存 5 个 Tripo 原始 GLB；`docs/tripo/tasks.json` 记录任务 ID、原始校验值和已确认的积分。网页只使用 `public/assets/models/` 的处理版本，不包含早期未采用的素材库候选。

| 素材 | 网页文件 | 可编辑来源 | 动画方式 |
| --- | --- | --- | --- |
| 房屋 | `cottage.glb` | `assets/cottage.blend` | 静态；夜间灯光和窗户材质变化 |
| 草地、山、树、围栏、池岸 | `terrain.glb` | `assets/terrain-layout.blend` | 静态主体；叠加草叶、水面与积雪材质 |
| 牛、羊、马 | `cow.glb` / `sheep.glb` / `horse.glb` | `assets/*-animation.blend` | 每种 13 根骨骼，`Graze` 4 秒、`Walk` 2 秒 |
| 锦鲤 | `fish.glb` | `assets/koi-swim.blend` | 3 根骨骼，`Swim` 2 秒，加游动路线 |
| 云 | `public/assets/clouds/*.density.bin` | `assets/cloud-volumes/*.blend` 与同目录 `.vdb`；`scripts/create-cloud-volumes.py` | `src/clouds.js` 体积渲染，按天气控制密度、光照、形态和漂移 |
| 秋叶 | `autumn-leaf.glb`、`public/assets/tree-anchors.json` | `assets/autumn-leaf.blend`；`scripts/prepare-tree-effects.py` | `src/leaves.js` 实例化叶片；真实树冠表面到树旁地面 |
| 雷声 | `public/assets/audio/thunder.wav` | `scripts/create-thunder.py` | 本地合成的短促雷击与低频余响；闪电后延迟播放 |

动物的网格通过骨骼和权重产生头、腿、尾巴的形变，GLB 携带动作片段；Three.js 的 AnimationMixer 播放这些片段，另行控制整只动物的位置和朝向。每个实例有独立骨架，多个动物不会共用同一个动作状态。当前是适合远景的小幅循环动作；这套轻量绑定可在 Blender 中继续精修，不等同于完整的电影级四足控制器。

查看 [动画与 Blender 编辑说明](docs/animation-guide.md)，了解动作和移动路线的区别、每个源文件的播放范围、修改及导出方法。`docs/qa/blender-assets.json` 记录了实际打开七个源文件并核验网格形变和循环连续性的结果。

雨雪是粒子，起点使用密度体素计算出的真实云底坐标，并随云体旋转、缩放和漂移，终点贴合地形高度。闪电锚定在雨云底部，包含白色主干、细分支和淡蓝光晕；放电点局部照亮云体与附近场景，数次短闪后间歇。雷声由用户主动开启，延迟约 0.6–1 秒播放。水面使用实时着色器。积雪覆盖朝上的表面，动物本身不染成白色。地形中的树是静态模型的一部分；`prepare-tree-effects.py` 根据原网格、纹理颜色和裸地高度识别真实树冠并导出发射点，落叶不在全屏随机生成。

云体在降水之后合成，避免后方雨丝穿透前方云面；雨丝从云底略下方开始，风的横向位移随下落距离增加。

原始效果图是视觉方向，实际模型是图生三维重建，几何及纹理细节存在差异。`docs/visual-target.png` 是选中的第一张微缩景观图。

## 天气数据接入

将服务端或天气供应商响应转换为以下格式即可更新页面，无需重新创建场景：

```js
window.PocketWeather.setEnvironment({ season: "autumn", phase: "day", hour: 12 }); // optional preview/debug override
window.PocketWeather.update({
  city: '杭州',
  condition: 'rain', // sunny/cloudy/rain/moderateRain/heavyRain/storm/snow/fog/windy/night
  temperature: 19, // °C
  feelsLike: 18,
  wind: 4.2, // m/s
  humidity: 88, // %
  uv: 1,
  precipitation: 86, // %
  direction: '东北风',
  observedAt: new Date().toISOString(),
  source: 'api',
});
```

`src/weather.js` 的 `normalizeWeather` 处理缺失值、异常值及数值边界。真实 API 的密钥应放到后端；当前页面未添加密钥、真实定位或天气请求。三日预报当前为演示组合，接入预报接口时替换 `src/App.jsx` 的 `forecasts` 数据来源。

## 开发与检查

```sh
npm install
npm run dev -- --host 0.0.0.0 --port 4173 --strictPort
npm test
npm run build
npm run test:sites
```

`src/world.js` 管理 Three.js 场景；`src/App.jsx` 管理界面状态；`src/styles.css` 管理网页样式。构建输出在 `dist/client/`，保留了 Sites 兼容的 worker 和 hosting 文件，尚未部署。

如需从原始 GLB 重新生成来源与动作：

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/prepare-terrain.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/create-companion-assets.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/create-cloud-volumes.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/prepare-tree-effects.py
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/animate-animals.py
```

`animate-animals.py -- horse` 可单独重建马。原始 Tripo GLB 保留高分辨率贴图，网页使用较小贴图；所有导出为自包含 GLB。

云素材来源与渲染：密度场包含积云、层积云，以及小雨薄云、中雨层云、大雨厚云五种体型。旧实体云 GLB 保存在 `assets/cloud-mesh-archive/`，不再供网页加载。Blender 来源使用 Y 轴作为云高，与 Three.js 对齐；打开时使用材质或渲染预览查看体积。

雨量分级由 `src/rain.js` 控制：`rain` 继续表示小雨；`moderateRain` 表示中雨；`heavyRain` 表示大雨；`storm` 独立表示雷阵雨。分级同时改变密度素材、云厚、覆盖面积、明暗、雨丝密度/速度/长度、湿润程度与涟漪。三档参数用于视觉演示，不对应气象业务的毫米阈值。所有天气共用同一套固定正交取景：桌面视口高度为 14.5 单位，窄视口按宽度响应式换算；云的空间布局必须适配该取景，切换天气不会改变镜头比例、环绕倾角或观察目标。云的空间布局、叶片轨迹和闪电时序由 `src/spatial-effects.js` 管理。
