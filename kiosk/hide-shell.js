(() => {
  "use strict";

  // The app is loaded inside Home Assistant's iframe. Do not install a
  // document-wide observer in that iframe: every card update would wake it
  // up and compete with the touch UI for the small kiosk machine's CPU.
  if (window.top !== window.self) return;

  const setImportant = (element, property, value) => {
    if (!element || element.style.getPropertyValue(property) === value) return;
    element.style.setProperty(property, value, "important");
  };

  const clearBottomSpacing = (element) => {
    if (!element) return;
    setImportant(element, "box-sizing", "border-box");
    setImportant(element, "margin-bottom", "0");
    setImportant(element, "padding-bottom", "0");
  };

  const fillViewport = (element) => {
    if (!element) return;
    clearBottomSpacing(element);
    setImportant(element, "width", "100vw");
    setImportant(element, "max-width", "100vw");
    setImportant(element, "height", "100vh");
    setImportant(element, "min-height", "100vh");
    setImportant(element, "margin-top", "0");
    setImportant(element, "margin-left", "0");
    setImportant(element, "margin-right", "0");
  };

  // Chromium is already running fullscreen at the panel's native 1366x768
  // viewport. Normalize the document and Home Assistant's shell as well so
  // the frontend cannot leave its default bottom safe-area/padding strip on
  // any route (Today, rooms, categories, cameras, or settings).
  const normalizeGlobalViewport = (homeAssistant, main) => {
    fillViewport(document.documentElement);
    fillViewport(document.body);
    setImportant(document.documentElement, "overflow", "hidden");
    setImportant(document.body, "overflow", "hidden");
    fillViewport(homeAssistant);
    fillViewport(main);
  };

  // Home Assistant moves the sidebar and app panel between light DOM and
  // nested open shadow roots as its frontend evolves. Keep this traversal
  // deliberately scoped to the top-level shell; the Tecnohead iframe is not
  // inspected.
  const findDeep = (root, selector) => {
    if (!root) return null;
    const direct = root.querySelector?.(selector);
    if (direct) return direct;
    for (const element of root.querySelectorAll?.("*") || []) {
      const lightDomMatch = element.querySelector?.(selector);
      if (lightDomMatch) return lightDomMatch;
      if (!element.shadowRoot) continue;
      const found = findDeep(element.shadowRoot, selector);
      if (found) return found;
    }
    return null;
  };

  const hideHomeAssistantShell = () => {
    const homeAssistant = document.querySelector("home-assistant");
    const main = homeAssistant?.shadowRoot?.querySelector("home-assistant-main");
    normalizeGlobalViewport(homeAssistant, main);
    const drawer = main?.shadowRoot?.querySelector("ha-drawer") || findDeep(document, "ha-drawer");
    const sidebar = drawer?.shadowRoot?.querySelector("ha-sidebar")
      || drawer?.querySelector("ha-sidebar")
      || findDeep(document, "ha-sidebar");
    const resolver = drawer?.shadowRoot?.querySelector("partial-panel-resolver")
      || drawer?.querySelector("partial-panel-resolver")
      || findDeep(document, "partial-panel-resolver");
    const panel = resolver?.shadowRoot?.querySelector("ha-panel-app")
      || resolver?.querySelector("ha-panel-app")
      || drawer?.querySelector("ha-panel-app")
      || findDeep(document, "ha-panel-app");
    const appContent = drawer?.shadowRoot?.querySelector(".app-content")
      || main?.shadowRoot?.querySelector(".app-content")
      || findDeep(document, ".app-content");
    const panelRoot = panel?.shadowRoot;

    if (!sidebar || !panel || !appContent) return false;

    setImportant(sidebar, "display", "none");
    fillViewport(drawer);
    setImportant(drawer, "width", "100%");
    setImportant(drawer, "margin-left", "0");
    clearBottomSpacing(drawer);
    setImportant(appContent, "padding-inline-start", "0");
    setImportant(appContent, "padding-left", "0");
    setImportant(appContent, "width", "100%");
    setImportant(appContent, "height", "100%");
    setImportant(appContent, "min-height", "100%");
    clearBottomSpacing(appContent);
    setImportant(resolver, "width", "100%");
    setImportant(resolver, "margin-left", "0");
    fillViewport(resolver);
    setImportant(panel, "width", "100%");
    setImportant(panel, "margin-left", "0");
    fillViewport(panel);
    const appLayout = findDeep(panelRoot, "ha-app-layout");
    const panelMain = findDeep(panelRoot, "main");
    fillViewport(appLayout);
    setImportant(appLayout, "width", "100%");
    fillViewport(panelMain);
    setImportant(panelMain, "width", "100%");
    setImportant(panelMain, "margin-left", "0");
    return true;
  };

  let ready = false;
  let attempts = 0;
  const observer = new MutationObserver(() => {
    if (!ready) ready = hideHomeAssistantShell();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  const retryUntilReady = () => {
    if (ready || attempts >= 100) {
      observer.disconnect();
      return;
    }
    attempts += 1;
    ready = hideHomeAssistantShell();
    if (!ready) window.setTimeout(retryUntilReady, 100);
  };
  retryUntilReady();

  // Keep route changes safe without watching the whole Home Assistant tree.
  window.setInterval(hideHomeAssistantShell, 10000);
})();
