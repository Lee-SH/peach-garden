# 그림 프롬프트 모음 (Gemini)

## 공통 사용법
- 새 대화창을 열고 **유비·장비 그림 두 장을 첨부**한 뒤 프롬프트를 붙여 넣는다(그림체를 맞추기 위해서).
- 같은 대화창에서 이어서 요청할 때는 "Same style as before."로 시작하는 짧은 프롬프트로 충분하다.
- 받으면 다운로드 폴더에 저장하고 Claude에게 "OO 받았어"라고 알려 준다. 자르기·투명 처리·방향 뒤집기는 Claude가 한다.
- 다운로드 버튼은 한 번만 누른다. 두 번 누르면 "(1)"이 붙은 같은 파일이 하나 더 생긴다.
- Gemini 화면에 그림이 두 장 보이면 마음에 드는 하나만 받는다.

## 진행 상황
| 묶음 | 상태 |
|---|---|
| 유비·관우·장비 (전신, 관절 부위) | ✅ |
| 황건적 졸병 9종, 적장 7명 | ✅ |
| 아이콘 7개 (보병, 기병, 도구 5종) | ✅ |
| 마을 그림 5장: 탁현, 청주, 광종, 영천, 곡양 | ✅ |
| 주막 안 그림 | ✅ |
| 타이틀 그림 1장 | ✅ |
| 이야기 그림 6장 (화마다) | ✅ |
| **전투 배경 6장** (화마다) | ⏳ 아래 E — 한 번에 한 장씩 |

---

## A. 마을(진영) 그림 — 5장

게임에서 누르는 자리가 정해져 있어서, 건물은 **항상 같은 자리**에 그려야 한다. 아래 [공통 배치]는 다섯 장 모두 그대로 쓰고, [장소] 문단만 바꾼다.

### A-1. 첫 장 (새 대화창, 그림 2장 첨부)

```
Create an image. The attached images show our game's art style (hand-drawn chibi Three Kingdoms heroes): hand-inked lines with varied weight, flat 2-tone cel shading, limited and slightly muted palette. Now draw a BACKGROUND in the same style.

A tall vertical image (portrait, 9:16) of a late-Han-dynasty Chinese village used as a volunteer army's camp, seen from a high three-quarter top-down view, like a game town map. No people.

[Fixed layout — keep exactly]
- Upper-left (about 26% from the left, 33% from the top): a large white canvas army tent with a blue banner on a pole beside it.
- Upper-right (about 74% from the left, 33% from the top): a stone blacksmith's forge with a chimney puffing smoke, a glowing orange furnace door and an anvil outside.
- Left-middle (about 26% from the left, 60% from the top): a small tavern with red lanterns hanging under the eaves and a cloth wine flag on a pole.
- Right-middle (about 74% from the left, 57% from the top): a wooden storehouse with a dark roof, crates and sacks stacked beside it.
- Lower-right (about 74% from the left, 82% from the top): a wooden village gate (paifang style) where a dirt road leaves the village.
- A dirt road from the left edge across the village square, then down past the storehouse to that gate.
- Keep the area just below each building plain (ground or road) — name signs will be placed there by the game.
- Top 18% of the image: only sky and distant scenery. Bottom 9%: plain ground. (The game's UI covers these strips.)

[Place]
Zhuo county (탁현), spring: thatched farmhouses, peach trees in full pink blossom, green fields and gentle hills behind.

No text, no letters, no writing on signs or flags, no frame. Generate only ONE image.
```

### A-2 ~ A-5. 나머지 네 장 (같은 대화창에서 이어서, **한 메시지에 한 장소만**)

네 장소 문장을 한 번에 넣으면 Gemini가 한 그림에 섞어 그린다(실제로 그랬음). 한 메시지에 한 장소씩 보낸다.

```
Same style and EXACTLY the same building layout as the first town image (Zhuo county) (tent upper-left, forge upper-right, tavern left-middle, storehouse right-middle, gate lower-right, road to the gate, plain sky on top and plain ground at the bottom). Only the surroundings change:
[Place]
(아래에서 하나만 골라 붙인다)
The WHOLE image shows only this one place — do not mix in other places.
No text, no letters, no frame. Generate only ONE image.
```

[Place]에 넣을 문장:
- **청주 (qingzhou)**: `Outside Qingzhou city: a tall grey city wall with battlements along the horizon, a city gate tower in the distance, a few relieved townspeople's houses, late spring.`
- **광종 (guangzong)**: `The imperial army camp near Guangzong: rows of small government tents and red Han banners in the background, wooden palisades, trampled dusty ground, early summer.`
- **영천 (yingchuan)**: `The plains of Yingchuan after a great fire: scorched black patches of grass, thin smoke rising far away, an orange-tinted evening sky, a few burnt trees.`
- **곡양 (quyang)**: `Near Quyang under a gloomy sky: dark purple clouds, eerie mist on the ground, bare trees, a few torn yellow paper talismans caught on branches.`

받으면 Claude가 `public/art/town/<영문이름>.png`로 넣는다. 한 장만 먼저 와도 되고, 그림이 없는 진영은 지금처럼 도형 마을로 나온다.

---

## B. 주막 안 그림 — 1장

주막 화면(대화 목록) 뒤에 어둡게 깔린다. 목록 글자가 위에 올라가므로 복잡하지 않게 그린다.

```
Create an image. Same art style as the attached images (hand-drawn chibi Three Kingdoms heroes; hand-inked lines, flat 2-tone cel shading, muted palette). Draw a BACKGROUND, no people.

A tall vertical image (portrait, 9:16): the cozy inside of a small late-Han-dynasty Chinese village tavern at night. Low wooden tables with wine jars and cups, a warm lantern glow, a wooden counter with large clay wine urns in the back, paper windows, a peach blossom branch in a vase. Calm composition with large plain areas (walls and floor) — text will be shown on top.

No text, no letters, no writing on jars or signs, no frame. Generate only ONE image.
```

받으면 Claude가 `public/art/town/tavern.png`로 넣는다.

---

## C. 타이틀 그림 — 1장

타이틀 "도원" 글자는 위쪽 하늘에, 버튼은 아래쪽(어둡게 덮임)에 올라간다. 인물은 가운데에 둔다.

```
Create an image. The attached images show our game's art style (hand-drawn chibi Three Kingdoms heroes): hand-inked lines with varied weight, flat 2-tone cel shading, limited and slightly muted palette. Now draw the TITLE SCREEN key art in the same style.

A tall vertical image (portrait, 9:16). The Peach Garden Oath: Liu Bei (green robe, gentle face), Guan Yu (long black beard, green robe, red face) and Zhang Fei (wild black beard, dark armour) standing side by side in a blooming peach orchard, raising wine cups together toward the sky in a solemn oath. A small altar with incense in front of them. Peach petals drifting in the air.

Layout:
- Top 25%: open soft spring sky with a few blossom branches at the edges only (the game title will be written here).
- 30%–60% from the top: the three brothers, full body, centred.
- Bottom 40%: simple ground of fallen petals and grass, no important details (menu buttons go here).

No text, no letters, no frame. Generate only ONE image.
```

받으면 Claude가 `public/art/scenes/title.png`로 넣는다.

## D. 이야기 그림 — 화마다 1장 (6장)

이야기 화면에서 제목과 대사 상자 뒤에 깔린다. 아래 40%는 대사 상자에 가려지고, 초상화가 왼쪽 아래에 선다. 그래서 **장면의 중심을 위쪽 절반에** 둔다. 인물은 작게(얼굴 클로즈업 없음) 그린다.

### D-1. 첫 장 (새 대화창, 유비·장비 그림 첨부)

```
Create an image. The attached images show our game's art style (hand-drawn chibi Three Kingdoms heroes): hand-inked lines with varied weight, flat 2-tone cel shading, limited and slightly muted palette. Now draw a STORY ILLUSTRATION in the same style.

A tall vertical image (portrait, 9:16). Put the whole scene in the TOP 55% of the image; the bottom 45% fades into plain dark ground (a dialogue box covers it). Figures are small, seen from a distance — no close-up faces.

[Scene]
Spring of 184 AD, Zhuo county: a small volunteer army of about five hundred marching out of the town gate along a dirt road, simple spears and a few banners, peach trees in blossom by the road. Three riders lead them at the front.

No text, no letters, no writing on banners, no frame. Generate only ONE image.
```

### D-2 ~ D-6. 나머지 (같은 대화창에서, 한 메시지에 한 장면씩)

```
Same style and the same layout as the previous story illustration (scene in the top 55%, bottom 45% plain dark ground, small distant figures, no close-up faces). Only the scene changes:
[Scene]
(아래에서 하나만 골라 붙인다)
No text, no letters, no writing on banners, no frame. Generate only ONE image.
```

[Scene]에 넣을 문장:
- **2화 청주 구원 (ch1-2)**: `Qingzhou city under siege: a grey walled city in the distance surrounded by a sea of yellow-turbaned rebels and their yellow banners, smoke rising. In the foreground, wooded hills on both sides of a narrow road where a few soldiers hide in ambush.`
- **3화 광종 원군 (ch1-3)**: `The imperial army camp at Guangzong: orderly rows of government tents and red Han banners behind wooden palisades, an old general in a command tent looking at a map, and far across the plain a huge rebel camp under yellow banners.`
- **4화 영천의 불길 (ch1-4)**: `Night on the plains of Yingchuan: a vast grass field set on fire by the wind, a wall of orange flames, yellow-turbaned rebels fleeing out of the smoke, imperial soldiers with torches waiting on a hill.`
- **5화 곡양의 요술 (ch1-5)**: `Quyang under a dark purple sky: a rebel sorcerer-general on a hill raising a sword with paper talismans, a swirling black whirlwind full of sand and ghostly shapes sweeping toward a small army.`
- **6화 천공장군 장각 (ch1-6)**: `The plains of Guangzong at dusk: a great rebel army under countless yellow banners, an old mystic in a golden robe and tall yellow hat on a raised platform calling down yellow lightning from storm clouds, routed imperial soldiers in the distance.`

받으면 Claude가 `public/art/scenes/ch1-1.png` … `ch1-6.png`로 넣는다. 같은 그림이 전투 뒤 이야기, 주막의 '지난 이야기 다시 보기'에도 쓰인다.

---

## E. 전투 배경 — 화마다 1장 (6장)

가로로 긴 전장 그림을 Claude가 지평선(위에서 30%)에서 잘라 **하늘 층**과 **땅 층**으로 나누고, 좌우를 거울처럼 이어 붙여 끝없이 스크롤되게 만든다(`node tools/battle-bg.mjs <그림> <화 id>`). 그래서:
- 지평선이 **위에서 30%** 높이에 곧게 있어야 한다.
- 땅 가운데(장수와 적이 서는 곳)는 **넓고 평평하게 비워** 둔다. 자세한 것은 땅 아래 가장자리와 지평선 근처에만.
- 사람·말·글자는 없어야 한다.

### E-1. 첫 장 (새 대화창, 유비·장비 그림 첨부)

```
Create an image. The attached images show our game's art style (hand-drawn chibi Three Kingdoms heroes): hand-inked lines with varied weight, flat 2-tone cel shading, limited and slightly muted palette. Now draw a BATTLE BACKGROUND in the same style for a side-view auto-battle game.

A wide landscape image (16:9), seen from the side at ground level like a side-scrolling game stage. No people, no horses, no text.

Layout (important):
- A straight, level horizon exactly 30% from the top. Above it: sky and distant scenery.
- Below the horizon: open flat ground filling the rest of the image. Keep the middle of the ground (from 40% to 90% of the height) wide open and simple — only soft texture like grass tufts, dirt and small stones — because the fighters stand there.
- Put any bigger details (bushes, rocks, fence posts) only right under the horizon or along the very bottom edge.
- The left and right edges should look alike (it will be repeated sideways).

[Battlefield]
Outside Zhuo county in spring: green fields with a dirt road running sideways across the ground, distant blue hills, a few peach trees in pink blossom along the horizon, a soft dusk sky.

No text, no letters, no frame. Generate only ONE image.
```

### E-2 ~ E-6. 나머지 (같은 대화창에서, 한 메시지에 한 장씩)

아래 완성본을 하나씩 그대로 보낸다.

**2화 청주 (ch1-2)**
```
Same style and EXACTLY the same layout as the previous battle background (side view, straight horizon 30% from the top, wide open flat ground in the middle, details only near the horizon and the bottom edge, left and right edges alike, no people). Only the battlefield changes:
A narrow road between wooded hills near Qingzhou: forested slopes along the horizon, the grey walls of Qingzhou far away, trampled grass and dirt on the ground, late spring daylight.
No text, no letters, no frame. Generate only ONE image.
```

**3화 광종 (ch1-3)**
```
Same style and EXACTLY the same layout as the previous battle background (side view, straight horizon 30% from the top, wide open flat ground in the middle, details only near the horizon and the bottom edge, left and right edges alike, no people). Only the battlefield changes:
The dusty plain of Guangzong: wooden palisades and a few distant tents with red banners along the horizon, dry yellowish ground with wheel ruts, hazy early-summer sky.
No text, no letters, no frame. Generate only ONE image.
```

**4화 영천 (ch1-4)**
```
Same style and EXACTLY the same layout as the previous battle background (side view, straight horizon 30% from the top, wide open flat ground in the middle, details only near the horizon and the bottom edge, left and right edges alike, no people). Only the battlefield changes:
The grassland of Yingchuan at night during a great fire: a line of orange flames and smoke along the horizon, a dark red-orange sky, scorched black and half-burnt grass on the ground with a few glowing embers.
No text, no letters, no frame. Generate only ONE image.
```

**5화 곡양 (ch1-5)**
```
Same style and EXACTLY the same layout as the previous battle background (side view, straight horizon 30% from the top, wide open flat ground in the middle, details only near the horizon and the bottom edge, left and right edges alike, no people). Only the battlefield changes:
Near Quyang under sorcery: swirling dark purple clouds, a faint black whirlwind far away on the horizon, bare dead trees, grey ground with low drifting mist and a few torn yellow paper talismans.
No text, no letters, no frame. Generate only ONE image.
```

**6화 장각 (ch1-6)**
```
Same style and EXACTLY the same layout as the previous battle background (side view, straight horizon 30% from the top, wide open flat ground in the middle, details only near the horizon and the bottom edge, left and right edges alike, no people). Only the battlefield changes:
The plain of Guangzong at dusk before the final battle: countless yellow rebel banners standing along the horizon, storm clouds with distant yellow lightning, trampled earth with broken spears and a fallen banner near the bottom edge.
No text, no letters, no frame. Generate only ONE image.
```

받으면 Claude가 `public/art/battle/ch1-N-sky.png`, `-ground.png`로 만든다. 그림이 없는 화는 지금처럼 도형 배경으로 나온다.
