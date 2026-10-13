// ═══════════════════════════════════════════════════════════════════════
// NUENIME — LIQUID GLASS LOADING CONTROLLER (APPLE iOS 18 AESTHETIC)
// ═══════════════════════════════════════════════════════════════════════

(function () {
  const PRELOADER_ID = "liquid-glass-preloader";
  const STATUS_STEPS = [
    { threshold: 0, text: "Memuat shader Liquid Glass iOS..." },
    { threshold: 28, text: "Menginisialisasi sistem visual Nuenime..." },
    { threshold: 58, text: "Menyiapkan tata letak & visual audio..." },
    { threshold: 86, text: "Menghubungkan jaringan streaming..." },
    { threshold: 98, text: "Selamat datang di Nuenime ✨" },
  ];

  let currentPercent = 0;
  let progressInterval = null;
  let isDone = false;

  function initLiquidGlassLoader() {
    const preloader = document.getElementById(PRELOADER_ID);
    if (!preloader) return;

    const fillBar = document.getElementById("lg-progress-bar");
    const percentEl = document.getElementById("lg-percentage-text");
    const statusEl = document.getElementById("lg-status-message");
    const phoneFrame = document.querySelector(".lg-phone-frame");
    const skipBtn = document.getElementById("lg-btn-skip");
    const floatingTrigger = document.getElementById("lg-floating-trigger");

    // ─── 3D PERSPECTIVE TILT ON MOUSE MOVE ───
    if (phoneFrame) {
      window.addEventListener("mousemove", (e) => {
        if (isDone) return;
        const { innerWidth, innerHeight } = window;
        const x = (e.clientX / innerWidth - 0.5) * 2; // -1 to 1
        const y = (e.clientY / innerHeight - 0.5) * 2; // -1 to 1
        phoneFrame.style.transform = `rotateY(${x * 12}deg) rotateX(${-y * 12}deg) translateZ(10px)`;
      });

      window.addEventListener("mouseleave", () => {
        phoneFrame.style.transform = "rotateY(0deg) rotateX(0deg) translateZ(0px)";
      });
    }

    // ─── PROGRESS SIMULATION ───
    function startProgress() {
      currentPercent = 0;
      isDone = false;
      preloader.classList.remove("fade-out");

      if (fillBar) fillBar.style.width = "0%";
      if (percentEl) percentEl.textContent = "0%";

      clearInterval(progressInterval);

      progressInterval = setInterval(() => {
        // Natural ease progression
        const increment = currentPercent < 40 ? 2.5 : currentPercent < 80 ? 1.8 : 3.0;
        currentPercent = Math.min(100, Math.round((currentPercent + increment) * 10) / 10);

        if (fillBar) fillBar.style.width = `${currentPercent}%`;
        if (percentEl) percentEl.textContent = `${Math.floor(currentPercent)}%`;

        // Update status message
        for (let i = STATUS_STEPS.length - 1; i >= 0; i--) {
          if (currentPercent >= STATUS_STEPS[i].threshold) {
            if (statusEl && statusEl.textContent !== STATUS_STEPS[i].text) {
              statusEl.textContent = STATUS_STEPS[i].text;
            }
            break;
          }
        }

        if (currentPercent >= 100) {
          clearInterval(progressInterval);
          finishLoading();
        }
      }, 40);
    }

    function finishLoading() {
      isDone = true;
      setTimeout(() => {
        preloader.classList.add("fade-out");
      }, 450);
    }

    // ─── SKIP BUTTON ───
    if (skipBtn) {
      skipBtn.addEventListener("click", () => {
        clearInterval(progressInterval);
        if (fillBar) fillBar.style.width = "100%";
        if (percentEl) percentEl.textContent = "100%";
        finishLoading();
      });
    }

    // ─── FLOATING REPLAY BUTTON ───
    if (floatingTrigger) {
      floatingTrigger.addEventListener("click", () => {
        startProgress();
      });
    }

    // Public functions
    window.replayLiquidGlassLoader = startProgress;
    window.skipLiquidGlassLoader = finishLoading;

    // Start on initial page load
    startProgress();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initLiquidGlassLoader);
  } else {
    initLiquidGlassLoader();
  }
})();
