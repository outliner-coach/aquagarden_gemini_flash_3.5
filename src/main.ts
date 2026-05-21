import './styles.css';

// 진입점 스캐폴드. 씬(src/scene)·HUD(src/hud)·usage 구독 부트스트랩은 후속 step에서 연결한다.
// 이 step은 창/트레이/클릭통과/설정 기반만 세운다.
const app = document.querySelector<HTMLDivElement>('#app');

if (app) {
  app.innerHTML = `
    <div class="flex h-full w-full items-center justify-center text-slate-300">
      <span class="text-xs tracking-widest uppercase">Aquagarden</span>
    </div>
  `;
}
