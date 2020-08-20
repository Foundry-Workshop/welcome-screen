import constants from "./constants.mjs";


export class WelcomeScreen extends Application {
  static _instance;
  modules = {};

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "welcome-screen",
      template: `modules/${constants.moduleName}/templates/welcome-screen.html`,
      resizable: false,
      width: 1040,
      height: 720,
      title: `Module Updates - Welcome Screen`,
      tabs: [{navSelector: ".items", contentSelector: ".tabs"}]
    });
  }

  getData(options = {}) {
    options = super.getData(options);
    options.isGM = game.user.isGM;

    let modules = duplicate(this.modules);
    options.modules = modules.map(m => {
      if (m.version === '0.0.0') m.version = `<i>not installed</i>`;
      return m;
    });

    return options;
  }

  async loadData() {
    return new Promise(async (resolve) => {
      let modules = constants.moduleList;
      modules = Object.entries(modules).map(e => {
        const d = mergeObject(e[1], {
          id: e[0],
          installed: false,
          enabled: false,
          description: "",
          version: "0.0.0",
          newerAvailable: false,
          changelogContent: "<em>Changelog doesn't exist for this module yet</em>",
          unread: true
        });
        const module = game.data.modules.find(m => m.id === d.id);
        if (module) {
          d.installed = true;
          d.enabled = module.active;
          d.version = module.data.version;
          d.wiki = module.data.wiki;
          d.bugs = module.data.bugs;
          d.readme = module.data.readme;
        }

        return d;
      });

      modules = modules.sort((a, b) => {
        let tA = a.name.toLowerCase();
        let tB = b.name.toLowerCase();
        return (tA < tB) ? -1 : (tA > tB) ? 1 : 0;
      });

      const rx = /<h1 id="changelog">Changelog<\/h1>/gi;
      for (let m of modules) {
        try {
          let res = await fetch(m.manifest);
          let content = await res.json();
          m.description = content.description ? content.description : m.description;
          m.remoteVersion = content.version;
          m.wiki = content.wiki ? content.wiki : m.wiki;
          m.bugs = content.bugs ? content.bugs : m.bugs;
          m.readme = content.readme ? content.readme : m.readme;
          m.newerAvailable = isNewerVersion(m.remoteVersion, m.version);
        } catch (e) {
        }
        if (m.installed) {
          try {
            let res = await fetch(`/modules/${m.id}/changelog.md`);
            let changelog = await res.text();
            if (showdown) {
              let converter = new showdown.Converter();
              m.changelogContent = converter.makeHtml(changelog).replace(rx, '');
            }
          } catch (e) {
          }
        }
      }
      this.modules = modules;
      resolve();
    });
  }

  async checkUnread() {
    return new Promise(resolve => {
      let userModules = game.user.getFlag(constants.moduleName, 'readVersions') || {};
      WelcomeScreen.instance.modules = WelcomeScreen.instance.modules.map(m => {
        let readVersion = [0, 0, 0];
        if (userModules[m.id]) {
          m.unread = isNewerVersion(m.version, userModules[m.id]);
          readVersion = userModules[m.id].split('.');
        }
        let version = m.version.split('.');
        let remoteVersion = m.remoteVersion.split('.');
        m.versionParts = {
          current: {
            major: version[0],
            minor: version[1],
            patch: version[2]
          },
          read: {
            major: readVersion[0],
            minor: readVersion[1],
            patch: readVersion[2]
          },
          remote: {
            major: remoteVersion[0],
            minor: remoteVersion[1],
            patch: remoteVersion[2]
          }
        };

        return m;
      });

      resolve();
    });
  }

  _tooltip(event) {
    event.preventDefault();
    const li = event.currentTarget;

    const tooltip = li.querySelector(".tooltip");
    if (tooltip) li.removeChild(tooltip);

    if (event.type === "mouseenter") {
      const tooltip = document.createElement("SPAN");
      tooltip.classList.add("tooltip");
      tooltip.textContent = li.dataset.tooltip;
      li.appendChild(tooltip);
    }
  }

  async _render(force = false, options = {}) {
    await super._render(force, options);
    await game.user.unsetFlag(constants.moduleName, 'readVersions');
    await game.user.setFlag(constants.moduleName, 'readVersions', Object.fromEntries(this.modules.map(m => [m.id, m.version])));
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find(".hinted").hover(this._tooltip.bind(this));
    html.find(".enable").click((event) => {
      event.preventDefault();
      const id = event.currentTarget.dataset.id;
      const settings = game.settings.get("core", ModuleManagement.CONFIG_SETTING);
      const setting = mergeObject(settings, {[id]: true});
      game.settings.set("core", ModuleManagement.CONFIG_SETTING, setting);
    });
    html.find(".install").click((event) => {
      event.preventDefault();
      const id = event.currentTarget.dataset.id;
      const name = constants.moduleList[id].name;
      const manifest = constants.moduleList[id].manifest;

      new Dialog({
        title: `Install ${name}`,
        content: `<p>Install <b>${name}</b> module? This will automatically return you to setup and you will need to re-launch the world.</p>`,
        buttons: {
          no: {
            label: "Cancel"
          },
          yes: {
            label: "Install",
            callback: async () => {
              if (await this.testSetup()) {
                ui.notifications.active = [];
                ui.notifications.info("Preparing to download module…", {permanent: true});
                const notif = ui.notifications.active[0];
                game.socket.on("progress", data => {
                  notif.html(data.msg);
                });
                await SetupConfiguration.installPackage({type: "module", manifest: manifest});
                await game.shutDown();
              } else {
                ui.notifications.warn("Your Foundry VTT instance's setup is password protected. You need to 'back to setup' and install modules manually.", {permanent: true});
              }
            }
          }
        },
        default: 'yes'
      }).render(true);
    });
  }

  async testSetup() {
    let response = {};
    try {
      response = await fetch(SetupConfiguration.setupURL, {
        method: "POST",
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({})
      });
    } catch (e) {
      return false;
    }

    return response.status !== 403;
  }

  static get instance() {
    if (this._instance === undefined) this._instance = new WelcomeScreen();
    return this._instance;
  }

  static render() {
    if (!this.instance.rendered) this.instance.render(true);
  }

  hasNewerVersion() {
    let showOnVersion = game.settings.get(constants.moduleName, 'showOnVersion');
    return !!this.modules.find(m => {
      let def = m.enabled && m.newerAvailable;
      let minor = m.versionParts.current.minor < m.versionParts.remote.minor;
      let major = m.versionParts.current.major < m.versionParts.remote.major;
      switch (showOnVersion) {
        case 'all':
          return def;
        case 'minor':
          return def && (minor || major);
        case 'major':
          return def && major;
      }
    });
  }

  shouldShow() {
    let showOnVersion = game.settings.get(constants.moduleName, 'showOnVersion');
    return !!this.modules.find(m => {
      let minor = m.versionParts.current.minor > m.versionParts.read.minor;
      let major = m.versionParts.current.major > m.versionParts.read.major;
      switch (showOnVersion) {
        case 'all':
          return m.unread;
        case 'minor':
          return m.unread && (minor || major);
        case 'major':
          return m.unread && major;
      }
    });
  }
}

export function renderWelcomeScreen() {
  let showWelcome = WelcomeScreen.instance.shouldShow();
  let showPlayers = game.settings.get(constants.moduleName, 'playersWelcomeScreen');
  if (showWelcome && (game.user.isGM || showPlayers)) {
    WelcomeScreen.render();
  }
}

export function addWelcomeScreenButton(html) {
  const button = $(
    `<button id="workshop-welcome-screen">
        <i class="fas fa-journal-whills"></i> Foundry Workshop Modules
     </button>`
  );

  const helpHeader = html.find('h2:contains("Help Documentation")');
  helpHeader.after(button);
  button.on('click', () => WelcomeScreen.render())

  return button;
}

export function addNotificationToButton() {
  if (!WelcomeScreen.instance.hasNewerVersion()) return;

  let notification = $(`<i class="notification-pip fas fa-exclamation-circle workshop"></i>`);
  this.append(notification);
}

export function addNotificationToTab() {
  if (!WelcomeScreen.instance.hasNewerVersion()) return;

  let notification = $(`<i class="notification-pip fas fa-exclamation-circle workshop" title="There are updates available to Foundry Workshop modules!"></i>`);
  let a = this.find('a[data-tab="settings"]');
  if (!a.find('.notification-pip').length) {
    a.append(notification);
  }
}