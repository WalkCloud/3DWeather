# 素材完成记录

2026-11-01，五个 Tripo 图生模型均已完成并下载：房屋、牛、羊、马、静态地形。原始 GLB 和任务 ID 见 `tasks.json`；参考图见 `assets/tripo-inputs/`。

- 五个模型各 55 积分，模型生成共 275 积分。
- 三种动物在 Studio 的“其他”类型自动绑定均成功，各 20 积分，已确认另用 60 积分。
- 已确认合计 335 积分。未将未核实的其他费用或余额作为精确账单。
- 用户已明确取消积分上限，早期 275 积分预算已被取代；没有购买额外订阅。
- Studio 绑定后的动画 GLB 下载遇到 CDN 超时。未重复生成模型；网页最终使用本地 Blender 创建的可编辑骨骼与循环动作。
- 鱼、云由 Blender 制作，无额外 Tripo 生成消耗。
- 所有运行素材已导入 Three.js。原始模型保存在 `assets/tripo-originals/`，网页优化 GLB 在 `public/assets/models/`，`.blend` 在 `assets/`。

房屋正面、侧面和背面已在 Studio 查看；完整组合也已在网页中旋转检查。运行文件和动画校验由 `tests/assets.test.mjs` 检查。
