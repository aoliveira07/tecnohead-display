(() => {
  "use strict";

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

    if (!sidebar || !panel) return;

    setImportant(sidebar, "display", "none");
    setImportant(resolver, "width", "100%");
    setImportant(panel, "width", "100%");
    setImportant(panel, "margin-left", "0");
  };

  hideHomeAssistantShell();

  const observer = new MutationObserver(hideHomeAssistantShell);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.setInterval(hideHomeAssistantShell, 2000);
})();
