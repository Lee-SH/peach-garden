import Phaser from 'phaser';
import { CAV_ATK, CAV_SPD, INF_DEF, INF_HP } from '../core/army';
import { unassigned } from '../core/campaign';
import { loadSave, type CampaignSave } from '../core/save';
import { artKey, hasArt, hasPose } from '../data/art';
import { TOWN_FILES } from '../data/artManifest';
import { ITEM_ORDER, ITEMS } from '../data/items';
import { PICTURE_SPOTS, PLACE_KEY, SPOTS, townOf } from '../data/town';
import { newTalks } from '../data/tavern';
import { GENERALS } from '../data/units';
import { icon } from '../ui/icons';
import { button, COLOR, FONT, H, hd, RES, text, W } from '../ui/theme';
import { startScenario } from './TitleScene';

const bgKey = (name: string) => `town-${name}`;

export function preloadTown(scene: Phaser.Scene) {
  // public/art/town/<place>.png per camp, bg.png for any camp without its own (360×640 layout, see SPOTS)
  for (const name of TOWN_FILES) scene.load.image(bgKey(name), `${import.meta.env.BASE_URL}art/town/${name}.png`);
}

/** Colours of the drawn placeholder town, by camp. */
const LOOK: Record<string, { sky: [number, number]; ground: number; hill: number; extra?: 'wall' | 'tents' | 'burnt' | 'gloom' }> = {
  탁현: { sky: [0x3b5a86, 0xc9b48a], ground: 0x6f7f45, hill: 0x51653f },
  청주: { sky: [0x46628c, 0xd2c09a], ground: 0x75824a, hill: 0x5a6a44, extra: 'wall' },
  광종: { sky: [0x55617a, 0xc8b07c], ground: 0x7d7a48, hill: 0x5f6040, extra: 'tents' },
  영천: { sky: [0x6a4a44, 0xd09a6a], ground: 0x6a6a3e, hill: 0x4f4a34, extra: 'burnt' },
  곡양: { sky: [0x2a2c44, 0x7a6e8a], ground: 0x5a6644, hill: 0x3f4a3a, extra: 'gloom' },
};

/**
 * 진영: the town map between battles. 군영 (generals, soldiers, gear), 창고 (tools and spare soldiers)
 * and the road out of town that leads to the next battle. Drawn with shapes until a town picture
 * exists; the clickable spots stay the same either way.
 */
export class TownScene extends Phaser.Scene {
  private save!: CampaignSave;

  constructor() {
    super('Town');
  }

  create() {
    hd(this);
    const save = loadSave();
    if (!save) {
      this.scene.start('Title');
      return;
    }
    this.save = save;
    const town = townOf(save);

    const pic = [bgKey(PLACE_KEY[town.place] ?? ''), bgKey('bg'), bgKey('zhuoxian')].find((k) => this.textures.exists(k));
    if (pic) {
      const bg = this.add.image(W / 2, H / 2, pic);
      bg.setScale(Math.max(W / bg.width, H / bg.height));
      // the pictures end in a plain strip at the bottom: fade it into the party bar
      this.add.graphics().fillGradientStyle(0x14110e, 0x14110e, 0x14110e, 0x14110e, 0, 0, 1, 1).fillRect(0, H - 150, W, 60);
      this.add.rectangle(W / 2, H - 90, W, 40, 0x14110e).setOrigin(0.5, 0);
    } else {
      this.drawVillage(town.place);
    }

    // header
    this.add.rectangle(W / 2, 0, W, 66, 0x14110e, 0.82).setOrigin(0.5, 0);
    text(this, 14, 10, `${town.place} 진영`, 20, COLOR.gold);
    text(this, 14, 40, town.next ? `다음 전투 · ${town.next.label}` : '1장 완결', 12, COLOR.dim);
    button(this, W - 46, 24, 76, 30, '타이틀', () => this.scene.start('Title'));

    // Liu Bei's line
    this.add.rectangle(W / 2, 74, W - 16, 34, 0x14110e, 0.7).setOrigin(0.5, 0).setStrokeStyle(1, COLOR.panelLine);
    text(this, 22, 82, `유비: ${town.mood}`, 11).setWordWrapWidth(W - 40, true);

    // spots
    const spots = pic ? PICTURE_SPOTS : SPOTS;
    this.spot(spots.camp, () => this.scene.start('Camp', { back: { key: 'Town' } }));
    this.spot(spots.smithy, () => this.scene.start('Camp', { back: { key: 'Town' }, mode: 'smithy' }));
    const fresh = newTalks(save).length;
    this.spot({ ...spots.tavern, sub: fresh ? `새 이야기 ${fresh}` : spots.tavern.sub }, () => this.scene.start('Tavern'), true, false, fresh > 0);
    this.spot(spots.store, () => this.openStore());
    const gate = town.next
      ? { ...spots.gate, sub: town.next.label }
      : { ...spots.gate, label: '2장 준비 중', sub: '반동탁 연합' };
    this.spot(gate, () => town.next && startScenario(this, this.save), !!town.next, true);

    this.drawParty();
  }

  // ---------------------------------------------------------------------------

  /** A labelled, tappable place with a bobbing marker above it. */
  private spot(s: { x: number; y: number; label: string; sub: string }, on: () => void, enabled = true, main = false, alert = false) {
    const zone = this.add.zone(s.x, s.y - 10, 120, 110).setInteractive({ useHandCursor: enabled });
    const plateY = s.y + 40;
    const w = main ? 150 : 128;
    const plate = this.add
      .rectangle(s.x, plateY, w, s.sub ? 40 : 26, main ? 0x5a2418 : 0x2a2119, 1)
      .setStrokeStyle(2, main ? 0xffd23b : COLOR.panelLine);
    text(this, s.x, plateY - (s.sub ? 9 : 0), main && enabled ? `${s.label} ▶` : s.label, 15, COLOR.gold).setOrigin(0.5);
    if (s.sub) text(this, s.x, plateY + 10, s.sub, 10, alert ? '#ff9a7a' : COLOR.dim).setOrigin(0.5);
    if (enabled) {
      const mark = this.add.triangle(s.x, s.y - 62, 0, 0, 14, 0, 7, 10, alert ? 0xff6b5b : 0xffd23b).setStrokeStyle(1, 0x000000);
      this.tweens.add({ targets: mark, y: s.y - 54, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      zone.on('pointerdown', () => plate.setScale(0.96));
      zone.on('pointerout', () => plate.setScale(1));
      zone.on('pointerup', () => {
        plate.setScale(1);
        on();
      });
    } else {
      plate.setAlpha(0.6);
    }
  }

  /** The three generals at the bottom; tap one to open 군영 with them selected. */
  private drawParty() {
    const ids = Object.keys(GENERALS).filter((id) => this.save.roster[id]?.alive);
    this.add.rectangle(W / 2, H - 58, W, 58, 0x14110e, 0.82).setOrigin(0.5, 0);
    ids.forEach((id, i) => {
      const x = W / 2 + (i - (ids.length - 1) / 2) * 116;
      const y = H - 30;
      this.add.circle(x - 30, y, 20, COLOR.player).setStrokeStyle(2, 0xf3e9d2, 0.8);
      if (hasArt(this, id) && hasPose(id, 'portrait')) {
        const p = this.add.image(x - 30, y + 19, artKey(id, 'portrait')).setOrigin(0.5, 1);
        p.setScale(40 / p.height);
      } else {
        this.add.text(x - 30, y, GENERALS[id].token, { fontFamily: FONT, fontSize: '17px', color: '#fff', fontStyle: 'bold', resolution: RES }).setOrigin(0.5);
      }
      text(this, x - 4, y - 9, GENERALS[id].name, 13).setOrigin(0, 0.5);
      text(this, x - 4, y + 9, `Lv ${this.save.roster[id].level}`, 11, COLOR.dim).setOrigin(0, 0.5);
      this.add
        .zone(x, y, 110, 50)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () => this.scene.start('Camp', { back: { key: 'Town' }, select: id }));
    });
  }

  /** 창고: every tool with what it does, and soldiers nobody leads yet. */
  private openStore() {
    const layer = this.add.container(0, 0).setDepth(50);
    const close = () => layer.destroy();
    const shade = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setInteractive();
    shade.on('pointerup', close);
    const top = 96;
    const h = 470;
    const panel = this.add.rectangle(W / 2, top, W - 24, h, COLOR.panel).setOrigin(0.5, 0).setStrokeStyle(2, COLOR.panelLine);
    panel.setInteractive(); // taps on the panel don't close it
    layer.add([shade, panel, text(this, 26, top + 12, '창고', 18, COLOR.gold)]);
    layer.add(text(this, W - 26, top + 16, '도구는 군영에서 장비 강화에 써요', 11, COLOR.dim).setOrigin(1, 0));

    const free = unassigned(this.save);
    const items = this.save.items ?? {};
    const rows = [
      { k: 'inf' as const, name: '보병', n: free.inf, desc: `아직 아무도 거느리지 않은 보병. 100명당 체력 +${INF_HP * 100}% · 방어 +${INF_DEF * 100}%` },
      { k: 'cav' as const, name: '기병', n: free.cav, desc: `아직 아무도 거느리지 않은 기병. 100명당 공격 +${CAV_ATK * 100}% · 속도 +${CAV_SPD}` },
      ...ITEM_ORDER.map((k) => ({ k, name: `${ITEMS[k].name} ${ITEMS[k].hanja}`, n: items[k] ?? 0, desc: ITEMS[k].desc })),
    ];
    rows.forEach((r, i) => {
      const y = top + 62 + i * 54;
      const ic = icon(this, r.k, 46, y, 34);
      if (!r.n) ic.setAlpha(0.35);
      layer.add(ic);
      layer.add(text(this, 72, y - 18, r.name, 13, r.n ? COLOR.text : COLOR.dim));
      layer.add(text(this, W - 26, y - 18, `×${r.n}`, 14, r.n ? COLOR.gold : COLOR.dim).setOrigin(1, 0));
      layer.add(text(this, 72, y - 1, r.desc, 10, COLOR.dim).setWordWrapWidth(W - 104, true));
    });
    const b = button(this, W / 2, top + h - 26, 140, 34, '닫기', close);
    layer.add(b.container);
  }

  /** Placeholder village drawn with shapes (replaced by a town picture when one exists). */
  private drawVillage(place: string) {
    const look = LOOK[place] ?? LOOK['탁현'];
    const g = this.add.graphics();
    // sky and hills
    g.fillGradientStyle(look.sky[0], look.sky[0], look.sky[1], look.sky[1], 1).fillRect(0, 0, W, 170);
    g.fillStyle(look.hill, 1).fillEllipse(70, 172, 260, 110).fillEllipse(290, 168, 300, 100);
    if (look.extra === 'wall') {
      // 청주성 walls on the horizon
      g.fillStyle(0x8a8070, 1).fillRect(150, 118, 210, 34);
      for (let x = 150; x < W; x += 16) g.fillRect(x, 110, 9, 10);
    }
    // ground
    g.fillStyle(look.ground, 1).fillRect(0, 162, W, H - 162);
    for (let i = 0; i < 60; i++) {
      const x = Phaser.Math.Between(0, W);
      const y = Phaser.Math.Between(170, H);
      g.fillStyle(look.extra === 'burnt' && i % 3 === 0 ? 0x2a2420 : i % 2 ? 0x000000 : 0xffffff, look.extra === 'burnt' && i % 3 === 0 ? 0.6 : 0.06);
      g.fillEllipse(x, y, Phaser.Math.Between(10, 30), 5);
    }
    // the road from the village square to the gate at the edge of town
    const road = (w: number, c: number) =>
      g.lineStyle(w, c, 1).beginPath().moveTo(-10, 300).lineTo(180, 300).lineTo(190, 450).lineTo(268, 500).lineTo(380, 500).strokePath();
    road(34, 0xa98a5c);
    road(22, 0xbfa070);
    // trees
    const tree = (x: number, y: number, pink = false) => {
      g.fillStyle(0x5a4030, 1).fillRect(x - 3, y, 6, 14);
      g.fillStyle(pink ? 0xf0a6b8 : 0x3f6a34, 1).fillCircle(x, y - 4, 13).fillCircle(x - 9, y + 2, 9).fillCircle(x + 9, y + 2, 9);
    };
    tree(180, 190, true);
    tree(26, 300 - 40);
    tree(340, 300, true);
    tree(30, 560);
    tree(180, 560, true);
    if (look.extra === 'tents') {
      // 노식's government camp: rows of small tents
      for (const [x, y] of [[170, 250], [200, 236], [330, 432], [30, 470]])
        g.fillStyle(0xd8ccb0, 1).fillTriangle(x - 16, y + 10, x + 16, y + 10, x, y - 12);
    }
    // 군막: a big tent with a banner
    const c = SPOTS.camp;
    g.fillStyle(0xe8dcc0, 1).fillTriangle(c.x - 50, c.y + 20, c.x + 50, c.y + 20, c.x, c.y - 34);
    g.fillStyle(0xb9a98a, 1).fillTriangle(c.x - 8, c.y + 20, c.x + 8, c.y + 20, c.x, c.y - 10);
    g.lineStyle(2, 0x6b5a40, 1).strokeTriangle(c.x - 50, c.y + 20, c.x + 50, c.y + 20, c.x, c.y - 34);
    g.lineStyle(3, 0x5a4030, 1).lineBetween(c.x + 38, c.y + 20, c.x + 38, c.y - 50);
    g.fillStyle(0x2f6fd6, 1).fillRect(c.x + 39, c.y - 50, 22, 14);
    // 대장간: stone forge with a chimney, glowing door and an anvil
    const m = SPOTS.smithy;
    g.fillStyle(0x7a7468, 1).fillRect(m.x - 38, m.y - 18, 76, 38);
    g.fillStyle(0x3a3030, 1).fillTriangle(m.x - 46, m.y - 16, m.x + 46, m.y - 16, m.x, m.y - 40);
    g.fillStyle(0x5a5450, 1).fillRect(m.x + 18, m.y - 52, 12, 30);
    g.fillStyle(0xff8a3a, 1).fillRect(m.x - 12, m.y - 2, 24, 22);
    g.fillStyle(0x2a2a2a, 1).fillRect(m.x + 42, m.y + 8, 18, 6).fillRect(m.x + 47, m.y + 14, 8, 8);
    const smoke = this.add.circle(m.x + 24, m.y - 56, 7, 0xdddddd, 0.6);
    this.tweens.add({ targets: smoke, y: m.y - 86, alpha: 0, scale: 2, duration: 2200, repeat: -1 });
    // 주막: a house with red lanterns and a wine flag
    const t = SPOTS.tavern;
    g.fillStyle(0xd8c8a4, 1).fillRect(t.x - 36, t.y - 16, 72, 36);
    g.fillStyle(0x6b3b2a, 1).fillTriangle(t.x - 46, t.y - 14, t.x + 46, t.y - 14, t.x, t.y - 40);
    g.fillStyle(0x3a2a1e, 1).fillRect(t.x - 9, t.y, 18, 20);
    g.fillStyle(0xd23a2a, 1).fillCircle(t.x - 26, t.y - 6, 5).fillCircle(t.x + 26, t.y - 6, 5);
    g.lineStyle(2, 0x5a4030, 1).lineBetween(t.x + 44, t.y + 20, t.x + 44, t.y - 34);
    g.fillStyle(0xf3e9d2, 1).fillRect(t.x + 30, t.y - 34, 13, 20);
    this.add.text(t.x + 36, t.y - 24, '酒', { fontFamily: FONT, fontSize: '11px', color: '#b02a1a', resolution: RES }).setOrigin(0.5);
    // 창고: a wooden storehouse with crates
    const s = SPOTS.store;
    g.fillStyle(0x8a6a44, 1).fillRect(s.x - 40, s.y - 22, 80, 42);
    g.fillStyle(0x4a3424, 1).fillTriangle(s.x - 50, s.y - 20, s.x + 50, s.y - 20, s.x, s.y - 48);
    g.fillStyle(0x3a2a1e, 1).fillRect(s.x - 12, s.y - 4, 24, 24);
    g.fillStyle(0xa8844e, 1).fillRect(s.x + 44, s.y + 6, 16, 14).fillRect(s.x + 48, s.y - 6, 12, 12);
    // 출진: the town gate at the end of the road
    const gt = SPOTS.gate;
    g.fillStyle(0x6b3b2a, 1).fillRect(gt.x - 36, gt.y - 44, 10, 64).fillRect(gt.x + 26, gt.y - 44, 10, 64);
    g.fillStyle(0x5a2418, 1).fillRect(gt.x - 46, gt.y - 54, 92, 12);
    g.fillStyle(0xffd23b, 1).fillRect(gt.x - 10, gt.y - 40, 20, 12);
    if (look.extra === 'gloom') g.fillStyle(0x1a1030, 0.25).fillRect(0, 0, W, H);
  }
}
