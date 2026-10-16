// Arcade ending: a short epilogue per character, typed out like a storybook.
import { VIEW_W, VIEW_H } from "../game/constants.js";
import { text, FONT, COLOR, wrap, drawFighterAt, panel } from "../render/ui.js";
import { ANIM } from "../render/poses.js";
import { rgba, ease, clamp } from "../core/util.js";

export const ENDINGS = {
  socrates: "모든 상대를 질문으로 무너뜨린 소크라테스. 아테네 시민들은 그를 챔피언으로 추대하려 했지만 그가 먼저 물었다. \"챔피언이란 무엇인가?\" 사흘 밤낮의 토론 끝에 시민들은 투표를 포기했다. 그는 오늘도 광장에서 묻는다. 정의는, 승리는, 그리고 오늘 점심 메뉴는 무엇인가.",
  plato: "플라톤은 이번 우승을 '이데아 속 완벽한 우승'의 그림자에 불과하다고 선언했다. 그리고 트로피 대신 학교를 세웠다. 정문에는 이렇게 새겨졌다. \"기하학과 격투를 모르는 자, 이 문으로 들어오지 말라.\"",
  nietzsche: "모든 우상을 망치로 부순 니체는 마지막으로 우승 트로피마저 깨뜨렸다. \"승리조차 극복되어야 한다!\" 그는 그 길로 알프스로 떠났다. 산자락에는 메아리만 남았다. 다시 한 번, 그리고 영원히.",
  diogenes: "상금을 건네러 온 주최 측이 무엇을 원하느냐고 묻자, 디오게네스는 통 속에서 고개를 내밀었다. \"햇빛 가리지 말고 비키시오.\" 상금은 거리의 개들에게 돌아갔다. 그의 등불은 오늘도 정직한 인간을 찾고 있다.",
  huang: "젠슨 황은 우승 트로피를 녹여 새 GPU를 만들었다. 출시 행사에서 재킷을 고쳐 입은 그가 말했다. \"여러분, 많이 살수록 많이 아낍니다.\" 그날 밤, 철학자들도 줄을 서서 그래픽카드를 샀다.",
  musk: "우승 직후 머스크는 경기장을 통째로 스타십에 싣고 떠나며 발표했다. \"다음 대회는 화성에서 열립니다. 아마 내년에. 늦어도 그다음 해에.\" 철학자들은 아직도 출발 일정을 기다리는 중이다.",
  buffett: "버핏은 상금 전액으로 대회 주최사의 지분을 사들였다. 이듬해 대회 이름은 '버크셔 배틀'로 바뀌었다. 체리 콜라를 한 모금 마신 그가 웃었다. \"좋은 회사를 적당한 가격에 샀을 뿐이죠.\"",
  smith: "우승한 뒤에야 애덤 스미스는 깨달았다. 이 대회 자체가 거대한 시장이었다는 것을. 관중의 함성도, 선수들의 땀도, 매점의 콜라도 보이지 않는 손이 균형으로 이끌고 있었다. 그는 『국부론』 개정판에 새 장을 덧붙였다. '제6편: 주먹의 분업에 관하여.'",
};

export class EndingScene {
  constructor(app, char, score, done) {
    this.app = app;
    this.char = char;
    this.score = score;
    this.done = done;
    this.t = 0;
    this.body = ENDINGS[char.id] || "";
  }

  enter() {
    this.app.audio.playSong("title");
  }

  update() {
    this.t++;
    const input = this.app.input;
    const shown = Math.floor(this.t * 0.7);
    if (this.t > 30 && (input.anyPressed || input.pointer.released)) {
      if (shown < this.body.length) this.t = Math.ceil(this.body.length / 0.7) + 1;
      else this.done();
    }
  }

  draw(view) {
    const ctx = view.ctx;
    ctx.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy);
    const c = this.char;
    const g = ctx.createRadialGradient(330, 420, 40, 330, 420, 900);
    g.addColorStop(0, rgba(c.color, 0.55));
    g.addColorStop(1, "#07050c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    for (let i = 0; i < 40; i++) {
      const x = (i * 97 + this.t * (0.3 + (i % 5) * 0.1)) % VIEW_W;
      const y = (i * 151 - this.t * (0.4 + (i % 3) * 0.2)) % VIEW_H;
      ctx.fillStyle = rgba(c.color, 0.3);
      ctx.fillRect(x, (y + VIEW_H) % VIEW_H, 3, 3);
    }
    drawFighterAt(ctx, c, 330, 690, 2.2, 1, ANIM.win(this.t), "happy", this.t);
    text(ctx, "ENDING", 660, 110, { size: 28, font: FONT.arcade, weight: 400, color: c.color });
    text(ctx, `${c.name}의 결말`, 660, 168, { size: 50, font: FONT.title, weight: 400, color: "#fff", stroke: COLOR.ink, sw: 8 });
    panel(ctx, 640, 196, 590, 330, { fill: "rgba(7,5,12,0.6)", stroke: rgba(c.color, 0.6), r: 16 });
    const shown = this.body.slice(0, Math.floor(this.t * 0.7));
    wrap(ctx, shown, 666, 240, 540, 36, { size: 21, weight: 600, color: COLOR.paper });
    if (shown.length >= this.body.length) {
      text(ctx, "THE END", 660, 590, { size: 44, font: FONT.arcade, weight: 400, color: COLOR.gold, stroke: COLOR.ink, sw: 8 });
      text(ctx, `최종 점수 ${this.score.toLocaleString()} · 클리어 기록 저장됨`, 662, 628, { size: 18, weight: 800, color: COLOR.paper });
      if (Math.floor(this.t / 30) % 2) text(ctx, "아무 키나 눌러 타이틀로", 662, 672, { size: 16, weight: 700, color: COLOR.dim });
    }
  }
}
