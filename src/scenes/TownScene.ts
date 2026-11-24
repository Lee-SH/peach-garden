import Phaser from 'phaser';
import { CAV_ATK, CAV_SPD, INF_DEF, INF_HP } from '../core/army';
import { unassigned } from '../core/campaign';
import { loadSave, type CampaignSave } from '../core/save';
import { artKey, hasArt, hasPose } from '../data/art';
import { TOWN_FILES } from '../data/artManifest';
import { ITEM_ORDER, ITEMS } from '../data/items';
import { SPOTS, townOf } from '../data/town';
import { GENERALS } from '../data/units';
import { icon } from '../ui/icons';
import { button, COLOR, FONT, H, hd, RES, text, W } from '../ui/theme';
import { startScenario } from './TitleScene';

const BG_KEY = 'town-bg';

export function preloadTown(scene: Phaser.Scene) {
  // one picture for every camp for now: public/art/town/bg.png (360×640 layout, see SPOTS)
  if (TOWN_FILES.includes('bg')) scene.load.image(BG_KEY, `${import.meta.env.BASE_URL}art/town/bg.png`);
}

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

    if (this.textures.exists(BG_KEY)) {
      const bg = this.add.image(W / 2, H / 2, BG_KEY);
      bg.setScale(Math.max(W / bg.width, H / bg.height));
    } else {
      this.drawVillage();
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
    this.spot(SPOTS.camp, () => this.scene.start('Camp', { back: { key: 'Town' } }));
    this.spot(SPOTS.store, () => this.openStore());
    const gate = town.next
      ? { ...SPOTS.gate, sub: town.next.label }
      : { ...SPOTS.gate, label: '2장 준비 중', sub: '반동탁 연합' };
    this.spot(gate, () => town.next && startScenario(this, this.save), !!town.next, true);

    this.drawParty();
  }

  // ---------------------------------------------------------------------------

  /** A labelled, tappable place with a bobbing marker above it. */
  private spot(s: { x: number; y: number; label: string; sub: string }, on: () => void, enabled = true, main = false) {
    const zone = this.add.zone(s.x, s.y - 10, 120, 110).setInteractive({ useHandCursor: enabled });
    const plateY = s.y + 40;
    const w = main ? 150 : 128;
    const plate = this.add
      .rectangle(s.x, plateY, w, s.sub ? 40 : 26, main ? 0x5a2418 : 0x2a2119, 0.92)
      .setStrokeStyle(2, main ? 0xffd23b : COLOR.panelLine);
    text(this, s.x, plateY - (s.sub ? 9 : 0), main && enabled ? `${s.label} ▶` : s.label, 15, COLOR.gold).setOrigin(0.5);
    if (s.sub) text(this, s.x, plateY + 10, s.sub, 10, COLOR.dim).setOrigin(0.5);
    if (enabled) {
      const mark = this.add.triangle(s.x, s.y - 62, 0, 0, 14, 0, 7, 10, 0xffd23b).setStrokeStyle(1, 0x000000);
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

  /** Placeholder village drawn with shapes (replaced by public/art/town/bg.png when it exists). */
  private drawVillage() {
    const g = this.add.graphics();
    // sky and hills
    g.fillGradientStyle(0x3b5a86, 0x3b5a86, 0xc9b48a, 0xc9b48a, 1).fillRect(0, 0, W, 200);
    g.fillStyle(0x51653f, 1).fillEllipse(70, 200, 260, 120).fillEllipse(290, 196, 300, 110);
    // ground
    g.fillStyle(0x6f7f45, 1).fillRect(0, 190, W, H - 190);
    for (let i = 0; i < 60; i++) {
      g.fillStyle(i % 2 ? 0x66763f : 0x7a8a4c, 0.8).fillEllipse(Phaser.Math.Between(0, W), Phaser.Math.Between(200, H), Phaser.Math.Between(10, 26), 4);
    }
    // the road: from the village square down to the gate at the edge of town
    g.lineStyle(34, 0xa98a5c, 1).beginPath().moveTo(-10, 300).lineTo(120, 330).lineTo(190, 420).lineTo(300, 470).lineTo(380, 470).strokePath();
    g.lineStyle(22, 0xbfa070, 1).beginPath().moveTo(-10, 300).lineTo(120, 330).lineTo(190, 420).lineTo(300, 470).lineTo(380, 470).strokePath();
    // houses
    const house = (x: number, y: number, s = 1, roof = 0x5a3a2a) => {
      g.fillStyle(0xd8c8a4, 1).fillRect(x - 22 * s, y - 16 * s, 44 * s, 26 * s);
      g.fillStyle(roof, 1).fillTriangle(x - 30 * s, y - 14 * s, x + 30 * s, y - 14 * s, x, y - 36 * s);
      g.fillStyle(0x3a2a1e, 1).fillRect(x - 5 * s, y - 2 * s, 10 * s, 12 * s);
    };
    house(40, 410, 0.9);
    house(200, 270, 0.8, 0x6b3b2a);
    house(318, 236, 0.85);
    house(80, 560, 1, 0x6b3b2a);
    house(190, 590, 0.8);
    // 군막: a big tent with a banner
    const c = SPOTS.camp;
    g.fillStyle(0xe8dcc0, 1).fillTriangle(c.x - 50, c.y + 20, c.x + 50, c.y + 20, c.x, c.y - 34);
    g.fillStyle(0xb9a98a, 1).fillTriangle(c.x - 8, c.y + 20, c.x + 8, c.y + 20, c.x, c.y - 10);
    g.lineStyle(2, 0x6b5a40, 1).strokeTriangle(c.x - 50, c.y + 20, c.x + 50, c.y + 20, c.x, c.y - 34);
    g.lineStyle(3, 0x5a4030, 1).lineBetween(c.x + 34, c.y + 20, c.x + 34, c.y - 50);
    g.fillStyle(0x2f6fd6, 1).fillRect(c.x + 35, c.y - 50, 22, 14);
    // 창고: a wooden storehouse with crates
    const s = SPOTS.store;
    g.fillStyle(0x8a6a44, 1).fillRect(s.x - 40, s.y - 22, 80, 42);
    g.fillStyle(0x4a3424, 1).fillTriangle(s.x - 50, s.y - 20, s.x + 50, s.y - 20, s.x, s.y - 48);
    g.fillStyle(0x3a2a1e, 1).fillRect(s.x - 12, s.y - 4, 24, 24);
    g.fillStyle(0xa8844e, 1).fillRect(s.x + 44, s.y + 6, 16, 14).fillRect(s.x + 48, s.y - 6, 12, 12);
    // 출진: the town gate at the end of the road
    const t = SPOTS.gate;
    g.fillStyle(0x6b3b2a, 1).fillRect(t.x - 36, t.y - 44, 10, 64).fillRect(t.x + 26, t.y - 44, 10, 64);
    g.fillStyle(0x5a2418, 1).fillRect(t.x - 46, t.y - 54, 92, 12);
    g.fillStyle(0xffd23b, 1).fillRect(t.x - 10, t.y - 40, 20, 12);
  }
}
