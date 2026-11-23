/** What Liu Bei says before each group of enemies (shown while the battle waits for "전투 시작"). */

/** Korean particle after a word: 이/가, 은/는, 을/를 … by whether the last syllable has a final consonant. */
export function josa(word: string, withFinal: string, withoutFinal: string) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  const hasFinal = code >= 0 && code <= 11171 && code % 28 !== 0;
  return word + (hasFinal ? withFinal : withoutFinal);
}

const MIDDLE = [
  '적이 또 몰려온다! 숨을 고르고 맞서자.',
  '아직 끝나지 않았다. 다음 무리를 막아라!',
  '백성들이 우리를 지켜보고 있다. 조금만 더 힘을 내자!',
];

/**
 * @param wave 0-based group index
 * @param total number of groups in the battle
 * @param bossName the officer in this group, if any
 * @param custom a line written for this group in the scenario (wins over the defaults)
 */
export function briefingLine(wave: number, total: number, bossName?: string, custom?: string): string {
  if (custom) return custom;
  if (bossName) return `${josa(bossName, '이', '가')} 나타났다! 저자만 쓰러뜨리면 이 싸움은 우리 것이다!`;
  if (wave === 0) return '모두 진형을 갖춰라! 황건적을 몰아내자!';
  if (wave === total - 1) return '이것이 마지막 무리다! 끝까지 힘을 내라!';
  return MIDDLE[(wave - 1) % MIDDLE.length];
}
