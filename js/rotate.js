/* ===== Hero rotator — nine real installation photographs =====
   Fail-open by construction: slide 1 is authored in index.html and is the
   page's LCP. This file only ADDS the other eight after window load, so a
   missing, blocked or crashed script still leaves a complete hero.
   Vault rules carried: M2 (opacity-only crossfade — the transition lives in
   css/home.css on .home-hero__photo), M1/M4 (pauses off-screen and in hidden
   tabs; never runs on reduced-motion or weak devices), P2 (the eight extra
   slides start loading only after the load event, 960w on phones via srcset).
   The ?v= token is read off slide 1's src so this file can never pin a stale
   cache token of its own. ===== */
(function () {
  var sec = document.querySelector("[data-rotator]");
  if (!sec) return;
  var media = sec.querySelector(".home-hero__media");
  var first = sec.querySelector(".home-hero__photo");
  if (!media || !first) return;

  var reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var weak = (navigator.deviceMemory && navigator.deviceMemory <= 2) ||
             (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
  if (reduced || weak) return; // one sharp photo is the correct hero here

  var token = (first.getAttribute("src") || "").split("?v=")[1] || "";
  var q = token ? "?v=" + token : "";
  // Slide 1 (inst-04) is authored in the HTML; these are the other eight,
  // in the order they rotate.
  var REST = ["inst-03", "inst-02", "inst-08", "inst-05", "inst-06", "inst-09", "inst-07", "inst-01"];
  var HOLD = 5000;

  var slides = [first];
  var idx = 0;
  var onScreen = true;

  function makeSlide(name) {
    var img = document.createElement("img");
    img.className = "home-hero__photo";
    img.alt = "";
    img.decoding = "async";
    img.loading = "lazy";
    img.setAttribute("aria-hidden", "true");
    img.src = "assets/hero/rotator/" + name + "-1920.webp" + q;
    img.srcset = "assets/hero/rotator/" + name + "-960.webp" + q + " 960w, " +
                 "assets/hero/rotator/" + name + "-1920.webp" + q + " 1920w";
    img.sizes = "100vw";
    media.appendChild(img);
    return img;
  }

  function show(n) {
    slides[idx].classList.remove("is-on");
    idx = n % slides.length;
    slides[idx].classList.add("is-on");
  }

  function build() {
    for (var i = 0; i < REST.length; i++) slides.push(makeSlide(REST[i]));
    setInterval(function () {
      if (document.hidden || !onScreen) return; // paused, not stopped
      show(idx + 1);
    }, HOLD);
  }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) {
      onScreen = !!(es[0] && es[0].isIntersecting);
    }, { threshold: 0.05 }).observe(sec);
  }

  // Build only after load so the extra slides never compete with the LCP.
  if (document.readyState === "complete") setTimeout(build, 600);
  else addEventListener("load", function () { setTimeout(build, 600); });
})();
