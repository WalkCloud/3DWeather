# 已落实的素材方案

房屋、牛、羊、马、地形保留五个已完成的 Tripo 图生模型。地形包括山、树、围栏、道路、池岸；房屋和动物独立。锦鲤与云在本地 Blender 制作，无新增 Tripo 消耗。

网页加载 6 个自包含 GLB 和 5 个体积云密度场。动物有吃草/行走骨骼片段，鱼有摆尾片段，位置由 Three.js 控制。

## 云来源

用户拒绝了照片感 Billboard 云和光滑实体云。当前云使用 `scripts/create-cloud-volumes.py` 制作 96×64×64 密度场：

- `public/assets/clouds/cumulus.density.bin`：积云，有较高的顶部云峰。
- `public/assets/clouds/stratus.density.bin`：层积云，更扁、覆盖更宽。
- `public/assets/clouds/rainLight.density.bin`：低起伏、较薄的小雨云。
- `public/assets/clouds/rainModerate.density.bin`：连绵、较厚的中雨层云。
- `public/assets/clouds/rain.density.bin`：厚雨云，用于大雨和雷阵雨，密度和云峰体积更大。

`manifest.json` 包含维度、格式和从密度计算的降水起点。`src/clouds.js` 使用三维密度积分生成柔边、透光和自阴影；环绕时所有方向都有体积。体积不通过 GLB 传输。

可编辑来源在 `assets/cloud-volumes/`，包含 `.vdb` 和 `.blend`。旧实体云保存到 `assets/cloud-mesh-archive/`，不再供网页使用。晴天无云、阴天三团、小雨两片、中雨三片、大雨四片、雷雨四片、雪天三团。云不遮盖整座小屋和后山。

用户授权必要积分不设数额上限，已完成的 Tripo 任务不重复提交；当前云修改不消耗 Tripo 积分。
