(() => {
  const atlasURL = new URL("loader-atlas.webp", document.currentScript.src).href;
  let atlasPromise;
  function preload() {
    if (!atlasPromise) {
      const image = new Image();
      image.src = atlasURL;
      atlasPromise = image.decode().then(() => image).catch(error => {
        atlasPromise = undefined;
        throw error;
      });
    }
    return atlasPromise;
  }
  window.activateDoorstepLoader = element => {
    let disposed = false, visible = false;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    function update() {
      if (disposed) return;
      element.classList.toggle("is-running", visible && !document.hidden && !preference.matches);
      if (visible && !preference.matches && !element.classList.contains("is-ready")) {
        preload().then(() => {
          if (!disposed) element.classList.add("is-ready");
        }).catch(() => { /* Keep the static emblem visible on asset failure. */ });
      }
    }
    const observer = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      update();
    });
    observer.observe(element);
    document.addEventListener("visibilitychange", update);
    preference.addEventListener("change", update);
    return () => {
      disposed = true;
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
      preference.removeEventListener("change", update);
      element.classList.remove("is-running");
    };
  };
  const startup = document.querySelector("[data-doorstep-startup]");
  if (startup) {
    const dispose = window.activateDoorstepLoader(startup);
    const observer = new MutationObserver(() => {
      if (!startup.isConnected) { dispose(); observer.disconnect(); }
    });
    observer.observe(startup.parentNode, {childList: true});
  }
})();
