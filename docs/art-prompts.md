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
| 마을 그림: 탁현 | ✅ (다른 진영도 그림이 올 때까지 이 그림을 씀) |
| **마을 그림: 청주, 광종, 영천, 곡양** | ⏳ 아래 A-2 — 한 번에 한 장소씩! |
| 주막 안 그림 | ✅ |

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
