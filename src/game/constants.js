export const FPS = 60;
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const GROUND_Y = 640; // screen y of the floor at zoom 1
export const STAGE_W = 1900;
export const WALL = 56;
export const MAX_SEP = 1000;
export const GRAVITY = 0.95;
export const BUFFER = 8;
export const DASH_WINDOW = 12;
export const PUSH_HALF = 30;
export const BODY_W = 74;
export const BODY_H = 228;
export const CROUCH_H = 142;
export const SUPER_COST = 100;
export const MAX_METER = 100;
export const DEFAULT_HEALTH = 1000;

export const MODES = {
  arcade: "아케이드",
  cpu: "VS CPU",
  versus: "2P 대전",
  training: "트레이닝",
  demo: "데모",
};

export const DIFFICULTY = {
  easy: { label: "쉬움", reaction: 26, block: 0.18, antiAir: 0.15, combo: 0.25, punish: 0.2, aggression: 0.45, mistakes: 0.3 },
  normal: { label: "보통", reaction: 17, block: 0.48, antiAir: 0.45, combo: 0.6, punish: 0.55, aggression: 0.6, mistakes: 0.12 },
  hard: { label: "어려움", reaction: 10, block: 0.75, antiAir: 0.75, combo: 0.9, punish: 0.85, aggression: 0.7, mistakes: 0.04 },
  insane: { label: "철인", reaction: 6, block: 0.9, antiAir: 0.92, combo: 1, punish: 0.97, aggression: 0.75, mistakes: 0 },
};
