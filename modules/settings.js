import constants from "./constants.mjs";

export default function registerSettings() {
  game.settings.register(constants.moduleName, "playersWelcomeScreen", {
    name: "WorkshopWelcomeScreen.Settings.playersWelcomeScreen.name",
    hint: "WorkshopWelcomeScreen.Settings.playersWelcomeScreen.hint",
    scope: "world",
    config: true,
    default: true,
    type: Boolean
  });

  game.settings.register(constants.moduleName, "showOnVersion", {
    name: "WorkshopWelcomeScreen.Settings.showOnVersion.name",
    hint: "WorkshopWelcomeScreen.Settings.showOnVersion.hint",
    scope: "world",
    config: true,
    default: 'all',
    type: String,
    choices: {
      "all": "WorkshopWelcomeScreen.Settings.showOnVersion.all",
      "minor": "WorkshopWelcomeScreen.Settings.showOnVersion.minor",
      "major": "WorkshopWelcomeScreen.Settings.showOnVersion.major"
    }
  });
}