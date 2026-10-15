// PARADIGM SHIFT — mid-round law cards. Once revealed, a law rewrites the
// physics or economy of the fight for both players until the round ends.
export const PARADIGMS = [
  {
    id: "recurrence",
    name: "영원회귀",
    en: "ETERNAL RECURRENCE",
    by: "니체",
    desc: "6초마다 모두가 3초 전의 자리로 되돌아간다. 체력은 돌아오지 않는다.",
    color: "#c48bff",
    recurrence: { every: 360, back: 180 },
  },
  {
    id: "cave",
    name: "동굴의 비유",
    en: "ALLEGORY OF THE CAVE",
    by: "플라톤",
    desc: "실체는 어둠에 잠기고 벽에 비친 그림자만 보인다.",
    color: "#ff9c4a",
    cave: true,
  },
  {
    id: "hand",
    name: "보이지 않는 손",
    en: "THE INVISIBLE HAND",
    by: "애덤 스미스",
    desc: "시장이 개입한다. 모든 투사체가 상대를 향해 휘어진다.",
    color: "#ffd45a",
    homing: 0.05,
  },
  {
    id: "antigravity",
    name: "반중력 이론",
    en: "ZERO-G ECONOMY",
    by: "일론 머스크",
    desc: "중력이 60%로 줄어든다. 높이 뜨고, 공중 콤보가 길어진다.",
    color: "#8fd0ff",
    gravity: 0.6,
  },
  {
    id: "inflation",
    name: "인플레이션",
    en: "HYPERINFLATION",
    by: "시장",
    desc: "모든 공격의 데미지가 35% 오른다. 한 방의 가치가 커진다.",
    color: "#ff6b6b",
    dmg: 1.35,
  },
  {
    id: "boom",
    name: "AI 호황",
    en: "AI BOOM",
    by: "젠슨 황",
    desc: "필살기 게이지가 3배로 빨리 찬다. 많이 살수록 많이 아낀다.",
    color: "#7af08f",
    meter: 3,
  },
  {
    id: "zerosum",
    name: "제로섬 게임",
    en: "ZERO-SUM GAME",
    by: "워런 버핏",
    desc: "준 데미지의 35%만큼 체력을 회복한다. 누군가의 손실은 누군가의 이익.",
    color: "#ffe28a",
    lifesteal: 0.35,
  },
  {
    id: "bigidea",
    name: "빅 아이디어",
    en: "BIG IDEAS",
    by: "소크라테스",
    desc: "생각이 커지면 머리도 커진다. 모든 공격 판정이 25% 커진다.",
    color: "#9ef0e0",
    bigHead: 1.55,
    reach: 1.25,
  },
];

export function paradigmById(id) {
  return PARADIGMS.find((p) => p.id === id);
}
