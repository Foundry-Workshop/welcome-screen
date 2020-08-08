import {
  addNotificationToButton,
  addNotificationToTab,
  addWelcomeScreenButton,
  renderWelcomeScreen,
  WelcomeScreen
} from "./WelcomeScreen.mjs";
import constants from "./constants.mjs";
import registerSettings from "./settings.js";

let dataLoadedPromise;

Hooks.once('init', () => {
  // fetch module data, sooner the better
  dataLoadedPromise = WelcomeScreen.instance.loadData().then(WelcomeScreen.instance.checkUnread);
  registerSettings();

  Hooks.callAll(`${constants.moduleName}:afterInit`);
});

Hooks.once('setup', () => {
  Hooks.callAll(`${constants.moduleName}:afterSetup`);
});

Hooks.once("ready", () => {
  // render Welcome Screen only when .loadData() has resolved
  dataLoadedPromise.then(renderWelcomeScreen);

  Hooks.callAll(`${constants.moduleName}:afterReady`);
});


Hooks.on("renderSidebar", (app, html) => {
  dataLoadedPromise.then(addNotificationToTab.bind(html));
});

Hooks.on("renderSettings", (app, html) => {
  const button = addWelcomeScreenButton(html);
  dataLoadedPromise.then(addNotificationToButton.bind(button));
});