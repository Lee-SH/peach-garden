import type { ItemId, Upgrade } from '../core/army';

/** Old-style smithing tools used to refine weapons and armour. */
export const ITEMS: Record<ItemId, { name: string; hanja: string; desc: string }> = {
  whetstone: { name: '숫돌', hanja: '礪石', desc: '무기의 날을 세운다. 무기 날 세우기 +1 (공격 +3%)' },
  lacquer: { name: '옻', hanja: '漆', desc: '갑옷에 옻칠을 한다. 한나라 칠갑의 비법. 옻칠 +1 (방어 +4%)' },
  rawhide: { name: '소가죽 끈', hanja: '韋', desc: '갑옷 비늘을 다시 엮는다. 엮기 +1 (체력 +3%)' },
  steel: { name: '백련강', hanja: '百煉鋼', desc: '백 번 두드려 단련한 강철. 무기 등급을 올린다. 적장을 쓰러뜨려 얻는다.' },
  manual: { name: '간장·막야의 비전', hanja: '干將莫邪', desc: '전설의 대장장이 부부가 남긴 비법. 무기를 명기로 만든다. 장(章)을 끝내면 얻는다.' },
};
export const ITEM_ORDER: ItemId[] = ['whetstone', 'lacquer', 'rawhide', 'steel', 'manual'];

export const UPGRADE_LABEL: Record<Upgrade, string> = {
  edge: '날 세우기',
  grade: '등급 올리기',
  lacquer: '옻칠',
  lacing: '비늘 엮기',
};
