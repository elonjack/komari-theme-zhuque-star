# 视觉资产说明

除单独标注外，以下视觉图由 OpenAI 内置 ImageGen 生成，并已复制到 `src/assets/images/`。它们不使用动画截图、官方 Logo、台词或水印。

- `wanglin-original-4k-v3.png`：使用者提供的本地测试源图，经确定性 3840×2160 放大；Release 使用同分辨率、质量 92 的 `wanglin-original-4k-v3.jpg` 纹理。人物本身不重新生成，WebGL 只对头发、衣袍、眼部微光、雾气和粒子做局部动态处理。此素材不随项目授予再分发权，公开部署前应由使用者确认授权或替换。

## v0.6.0 朱雀星地表材质

以下 4 张贴图全部本地打包，不会在浏览器运行时请求第三方站点。它们由 MIT 许可的 `komari-theme-Glassmorphism` 项目地球组件提供的素材整理而来；白天地表基于 NASA Visible Earth 的 Blue Marble 数据。公开发布主题时应一并保留本说明，并按上游素材页面核对署名要求。

- `earth-blue-marble-2048.jpg`：4096×2048 白天地表，用于日照面。
- `earth-night.jpg`：4096×2048 夜间灯光，用于背光面。
- `earth-topology.png`：2048×1024 地形高度，调制山脉与陆地明暗。
- `earth-water.png`：1600×800 水体遮罩，限定海面镜面高光。

参考实现：`sanrokamlan-prog/komari-theme-Glassmorphism` 的 `NodeEarthRealisticGlobe.vue`；Blue Marble 来源：NASA Visible Earth。主题没有复制其 Vue/Three.js 代码，当前球体、矩阵与 GLSL 着色器均在本项目中独立实现。

- `zhuque-hero-v2.png`：朱雀星与悬空宗门主视觉；21:9 电影构图，黑灰山门、云海、暗红修真星及阵法。
- `sect-hengyue-v2.png`：正道山门场景；云海群峰、瀑布、巨型山门及青白护宗阵法。
- `sect-lianhun-v2.png`：炼魂宗场景；黑石宗城、地火深渊、魂灯和残破阵环。
- `realm-ancient-god-v2.png` / `realm-ancient-god-v2.jpg`：古神遗境源图与 Release 运行时纹理；巨型石质神躯、古殿、星骸和日蚀。
- `wanglin-whitehair-v3.png`：透明背景的白发王林非官方同人形象；全身三分之四站姿、黑红修真长袍、冷色轮廓光，用于首页主视觉叠层。

环境图生成提示的共同约束：原创中国修真动画电影感环境；环境为主体；不出现人物、文字、UI、Logo、水印、现代物件或西式飞船；禁止复制现有动画镜头。

人物图生成模式：OpenAI 内置 ImageGen，`stylized-concept`，透明背景。最终提示摘要：高精度、非商业的白发王林同人诠释；中国男性修士、长银白发、沉静冷峻神情、黑灰与深红多层长袍、克制的古铜细节、暗红灵气与灰烬；高品质中国 3D 动画电影感、完整全身、面向页面标题；冷色轮廓光配朱红底光；单人、无武器、无场景、无文字、无 Logo、无水印、不复制动画帧。

## v0.7.0 宗门万象

以下 6 张场景使用 OpenAI 内置 ImageGen 分别生成，再以 JPEG 88 质量压缩到约 291–419 KB；项目内不保留对应的大体积 PNG 副本，原生成结果仍保存在本机 ImageGen 输出目录。

- `sect-hengyue-v3.jpg`：恒岳派；晨光、群山云海、白石山门、青玉护宗阵纹，正道清朗。
- `sect-daluo-v1.jpg`：大罗剑宗；高空剑宫、成列悬剑、蓝白剑气与云海，凌厉但明亮。
- `sect-rain-immortal-v1.jpg`：雨之仙界；天雨、银蓝仙宫、水镜、虹雾与柔和仙光。
- `sect-soul-refining-v3.jpg`：炼魂宗；黑石魂殿、幽渊、魂灯、暗红与青绿魂火，明确魔道暗系。
- `sect-war-god-v1.jpg`：战神殿；金色天光、赤铜战殿、战鼓、旌旗与山巅云海，庄严正派。
- `sect-cloud-heaven-v1.jpg`：云天宗；晴空、白玉云桥、浮空山门、鹤影和青白灵雾。

共同提示约束：原创高品质中国修真动画电影感；2:1 宽幅环境；宗门建筑与其名称语义一致；环境为主体；不出现人物、文字、UI、Logo、水印、现代建筑或西式飞船；正派宗门采用明亮通透的昼景，只有炼魂宗采用幽暗魔道视觉。
