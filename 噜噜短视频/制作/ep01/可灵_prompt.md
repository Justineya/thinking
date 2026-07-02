# 第01条 · 可灵图生视频 Prompt 包

> 片名：她从来不会说对不起 | 总时长 18s | 画幅 **9:16**  
> 生成 4 段后导入剪映，按 `剪映组装单.md` 裁剪拼接 + 组合 A 配音

---

## 一、可灵通用设置（每镜相同）

| 参数 | 建议值 |
|------|--------|
| 模式 | **图生视频** |
| 比例 | **9:16** |
| 时长 | **5 秒**（生成后剪映裁到下方「成片时长」） |
| 创意想象力 | **0.4 ~ 0.5**（偏低，保角色） |
| 运动幅度 | 见各镜（默认 **0.5**） |

### 每镜必上传

| 上传项 | 文件路径 |
|--------|----------|
| **首帧图** | `制作/ep01/关键帧/shot0X.png` |
| **角色参考①** | 见各镜「垫图」表 |
| **角色参考②** | 见各镜「垫图」表（如有） |

> 可灵若只能垫 1 张参考：优先垫**官方参考图**（ref_01 或 ref_03），首帧用关键帧。

---

## 二、全局造型锁定词（每镜 prompt 末尾都带上）

### 中文（推荐，直接复制进可灵）

```
Q版3D卡通水豚，明黄色圆润身体，头顶小橘子带绿叶，蓝色大眼睛，柔光3D渲染，水豚噜噜风格，角色造型与参考图完全一致
```

### 噜噜专用补充

```
橘色圆鼻头，橘色短裤，一颗大门牙，憨傻可爱
```

### 噜妹专用补充

```
粉色大蝴蝶结，粉色连衣裙，头顶蝴蝶结上有小橘子，凶萌表情
```

### 双人镜补充

```
两只同款明黄Q版3D水豚，同比例同风格，情侣日常
```

---

## 三、全局负向 Prompt（每镜都填）

### 中文

```
写实毛发，棕色水豚，河马，2D平面动漫，角色变形，多手多脚，面部崩坏，身体变色，消失橘子，消失蝴蝶结，消失粉裙，橘色短裤消失，恐怖，血腥，打翻溅洒，复杂物理特效，文字水印，字幕
```

### 英文（界面是英文时用）

```
realistic fur, brown capybara, hippo, flat 2D anime, deformed body, extra limbs, face distortion, wrong colors, missing orange on head, missing pink bow, missing pink dress, horror, gore, spill splash, text watermark, subtitles
```

---

## 四、逐镜 Prompt（复制即用）

---

### 镜头 01 · 钩子 | 成片裁 **3 秒** | 运动幅度 **0.6**

| 项 | 内容 |
|----|------|
| 首帧 | `关键帧/shot01.png` |
| 垫图 | `ref_03_噜妹_正面.png` + `lumei_02_暴怒.png` |
| 台词 | 噜妹：「你再碰厨房试试！」（后期剪映配音，可灵不生成人声） |

**Prompt（中文 · 复制整段）：**

```
近景，暖色马卡龙厨房，粉色冰箱门打开。
明黄色Q版3D水豚女孩，粉色大蝴蝶结粉色连衣裙，头顶小橘子，眉毛倒竖非常生气，一只手指向镜头外怒指，嘴巴张开骂人状。
镜头快速推近，她另一只手把一罐红白色旺仔牛奶利落塞进冰箱第一层，动作干脆利落，与愤怒表情形成反差。
轻微镜头推进，表情夸张但可爱，不恐怖。
Q版3D卡通水豚，明黄色圆润身体，头顶小橘子带绿叶，蓝色大眼睛，柔光3D渲染，水豚噜噜风格，角色造型与参考图完全一致。粉色大蝴蝶结，粉色连衣裙，头顶蝴蝶结上有小橘子，凶萌表情。
```

**Prompt（英文备用）：**

```
Close-up, warm pastel macaron kitchen, pink fridge open.
Chibi 3D golden yellow capybara girl, big pink bow, pink dress, orange on head, furious angry expression, pointing finger at viewer shouting.
Quick push-in, her other hand firmly placing a red-and-white Wangzai milk can into the first fridge shelf, swift decisive motion contrasting with angry face.
Subtle camera push, exaggerated cute expression, not scary.
Same character as reference image, water豚噜噜 style, soft 3D render.
```

---

### 镜头 02 · 冲突 | 成片裁 **4 秒** | 运动幅度 **0.5**

| 项 | 内容 |
|----|------|
| 首帧 | `关键帧/shot02.png` |
| 垫图 | `ref_04_双人_互动.png` + `lulu_01_心虚.png` + `lumei_02_暴怒.png` |
| 台词 | 噜妹「连牛排都能煎焦？！」+ 噜噜「……我本来可以的。」 |

**Prompt（中文 · 复制整段）：**

```
中景，暖色厨房，冰箱门半开。
明黄Q版3D水豚男孩，橘色短裤头顶橘子，双手端盘子，盘上是煎焦发黑牛排，缩脖子心虚，眼神躲闪耳朵耷拉，委屈不嘴硬。
旁边明黄Q版3D水豚女孩，粉色蝴蝶结粉色连衣裙，单手叉腰另一手扶冰箱门，余怒未消瞪着他。
两人轻微呼吸起伏，静态对话感，镜头稳定。
Q版3D卡通水豚，明黄色圆润身体，头顶小橘子带绿叶，蓝色大眼睛，柔光3D渲染，水豚噜噜风格，角色造型与参考图完全一致。两只同款明黄Q版3D水豚，同比例同风格，情侣日常。
```

**Prompt（英文备用）：**

```
Medium shot, warm kitchen, fridge half open.
Chibi 3D golden yellow capybara boy, orange shorts, orange on head, holding plate with burnt black steak, guilty shrinking neck, averted eyes, droopy ears,委屈 but not aggressive.
Beside him, chibi yellow capybara girl, pink bow pink dress, one hand on hip other on fridge door, still angry glaring.
Subtle breathing motion, stable camera, dialogue scene.
Same characters as reference, couple daily life, water豚噜噜 3D style.
```

---

### 镜头 03 · 反转 | 成片裁 **5 秒** | 运动幅度 **0.35**（偏小，保细节）

| 项 | 内容 |
|----|------|
| 首帧 | `关键帧/shot03.png` |
| 垫图 | `ref_01_噜噜_正面.png` + `lulu_01_心虚.png` |
| 台词 | 无（沉默半拍）+ 后期画外噜妹一句 |

**Prompt（中文 · 复制整段）：**

```
中景转特写，暖光厨房冰箱前。
明黄Q版3D水豚男孩，橘色短裤头顶橘子，悄悄拉开冰箱门，动作轻缓。
表情从愣住慢慢变软，眼神逐渐温柔，嘴角微微动但不笑出声。
镜头推近冰箱内部特写：红白色旺仔牛奶罐摆在最顺手的第一层搁板上，标签正面朝外清晰可见。
背景女孩背对镜头不在画面中心，不要解释性动作，安静温馨。
Q版3D卡通水豚，明黄色圆润身体，头顶小橘子带绿叶，蓝色大眼睛，柔光3D渲染，水豚噜噜风格，角色造型与参考图完全一致。橘色圆鼻头，橘色短裤，一颗大门牙，憨傻可爱。
```

**Prompt（英文备用）：**

```
Medium to close-up, warm kitchen at fridge.
Chibi 3D golden yellow capybara boy, orange shorts, quietly opening fridge door, gentle slow motion.
Expression shifts from stunned to soft, eyes warming, slight lip movement without laughing.
Push-in to fridge interior close-up: red-white Wangzai milk can on the most convenient first shelf, label facing outward clearly visible.
Girl with back turned, not center frame, quiet emotional beat, no narration gesture.
Same character as reference, water豚噜噜 style.
```

---

### 镜头 04 · 收口 | 成片裁 **6 秒** | 运动幅度 **0.4**

| 项 | 内容 |
|----|------|
| 首帧 | `关键帧/shot04.png` |
| 垫图 | `ref_04_双人_互动.png` + `lumei_04_嘴硬关心.png` + `lulu_03_小得意.png` |
| 台词 | 噜妹「超市买一送一，清库存而已，别多想。」 |

**Prompt（中文 · 复制整段）：**

```
近景双人中景，暖色马卡龙厨房。
明黄Q版3D水豚女孩，粉色蝴蝶结粉色连衣裙，背对灶台侧脸，耳根发红，假装忙碌不看男孩，嘴硬傲娇。
明黄Q版3D水豚男孩，橘色短裤头顶橘子，双手捧着红白色旺仔牛奶罐，憋不住小得意，嘴角翘起又憋回去。
温馨治愈氛围，轻微镜头缓推，不煽情。
Q版3D卡通水豚，明黄色圆润身体，头顶小橘子带绿叶，蓝色大眼睛，柔光3D渲染，水豚噜噜风格，角色造型与参考图完全一致。两只同款明黄Q版3D水豚，同比例同风格，情侣日常。
```

**Prompt（英文备用）：**

```
Close two-shot, warm pastel macaron kitchen.
Chibi golden yellow capybara girl, pink bow pink dress, turned away from stove, blushing ears, pretending busy not looking at boy, tsundere傲娇.
Chibi golden yellow capybara boy, orange shorts, holding red-white Wangzai milk can with both hands, barely suppressing smug smile, corner of mouth curling then holding back.
Cozy healing mood, gentle slow push-in, not overly sweet.
Same couple as reference image, water豚噜噜 3D style.
```

---

## 五、生成后剪映拼接时长

| 镜号 | 可灵生成 | 剪映裁切 | 入点 |
|------|----------|----------|------|
| 01 | 5s | **3s** | 0:00 |
| 02 | 5s | **4s** | 0:03 |
| 03 | 5s | **5s** | 0:07 |
| 04 | 5s | **6s** | 0:12 |
| 合计 | — | **18s** | — |

---

## 六、质检要点（生成完先看这 4 条）

- [ ] 角色是**明黄 Q 版 3D**，不是棕褐色写实水豚
- [ ] 噜噜有**橘色短裤 + 头顶橘子**；噜妹有**粉蝴蝶结 + 粉裙**
- [ ] 旺仔牛奶罐是**红白色**，镜头 01 和 03 是**同一款**
- [ ] 镜头 03 **噜噜无嘴型对白**，表情变化为主
- [ ] 无多手多脚、面部崩坏 → 有则换一版可灵 seed 重生成

---

## 七、文件路径速查

```
噜噜短视频/
├── 制作/ep01/关键帧/shot01.png ~ shot04.png   ← 首帧
├── 角色延伸包/官方参考/ref_01~04.png            ← 造型垫图
├── 角色延伸包/噜噜/lulu_01_心虚.png             ← 噜噜情绪
├── 角色延伸包/噜噜/lulu_03_小得意.png
├── 角色延伸包/噜妹/lumei_02_暴怒.png            ← 噜妹情绪
├── 角色延伸包/噜妹/lumei_04_嘴硬关心.png
├── 制作/ep01/配音稿.txt                         ← 剪映配音
└── 制作/ep01/剪映组装单.md                      ← 拼片步骤
```

生成完 4 段发我或自己拼，我帮你过质检。
