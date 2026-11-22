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

  const hideHomeAssistantShell = () => {
    const homeAssistant = document.querySelector("home-assistant");
    const main = homeAssistant?.shadowRoot?.querySelector("home-assistant-main");
    const drawer = main?.shadowRoot?.querySelector("ha-drawer");
    const sidebar = drawer?.querySelector("ha-sidebar");
    const resolver = drawer?.querySelector("partial-panel-resolver");
    const panel = resolver?.querySelector("ha-panel-app");
    const appContent = drawer?.shadowRoot?.querySelector(".app-content");

    if (!sidebar || !panel) return false;

    setImportant(sidebar, "display", "none");
    setImportant(appContent, "padding-inline-start", "0");
    setImportant(appContent, "padding-left", "0");
    setImportant(appContent, "width", "100%");
    setImportant(resolver, "width", "100%");
    setImportant(panel, "width", "100%");
    setImportant(panel, "margin-left", "0");
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
