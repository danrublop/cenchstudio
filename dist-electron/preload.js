"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// electron/preload.ts
var preload_exports = {};
module.exports = __toCommonJS(preload_exports);
var import_electron = require("electron");
var cenchApi = {
  settings: {
    listProviders: () => import_electron.ipcRenderer.invoke("cench:settings.listProviders")
  },
  conversations: {
    list: (projectId) => import_electron.ipcRenderer.invoke("cench:conversations.list", projectId),
    create: (args) => import_electron.ipcRenderer.invoke("cench:conversations.create", args),
    get: (id) => import_electron.ipcRenderer.invoke("cench:conversations.get", id),
    update: (args) => import_electron.ipcRenderer.invoke("cench:conversations.update", args),
    delete: (id) => import_electron.ipcRenderer.invoke("cench:conversations.delete", id),
    listMessages: (id) => import_electron.ipcRenderer.invoke("cench:conversations.listMessages", id),
    addMessage: (args) => import_electron.ipcRenderer.invoke("cench:conversations.addMessage", args),
    updateMessage: (args) => import_electron.ipcRenderer.invoke("cench:conversations.updateMessage", args),
    clearMessages: (id) => import_electron.ipcRenderer.invoke("cench:conversations.clearMessages", id)
  },
  usage: {
    getSummary: (projectId) => import_electron.ipcRenderer.invoke("cench:usage.getSummary", projectId)
  },
  generationLog: {
    update: (args) => import_electron.ipcRenderer.invoke("cench:generationLog.update", args),
    list: (args) => import_electron.ipcRenderer.invoke("cench:generationLog.list", args),
    listByDimension: (args) => import_electron.ipcRenderer.invoke("cench:generationLog.listByDimension", args)
  },
  permissions: {
    getSpend: () => import_electron.ipcRenderer.invoke("cench:permissions.getSpend"),
    perform: (args) => import_electron.ipcRenderer.invoke("cench:permissions.perform", args)
  },
  skills: {
    readFile: (args) => import_electron.ipcRenderer.invoke("cench:skills.readFile", args)
  },
  projects: {
    list: (args) => import_electron.ipcRenderer.invoke("cench:projects.list", args),
    create: (args) => import_electron.ipcRenderer.invoke("cench:projects.create", args),
    get: (projectId) => import_electron.ipcRenderer.invoke("cench:projects.get", projectId),
    update: (args) => import_electron.ipcRenderer.invoke("cench:projects.update", args),
    delete: (projectId) => import_electron.ipcRenderer.invoke("cench:projects.delete", projectId),
    listAssets: (args) => import_electron.ipcRenderer.invoke("cench:projects.listAssets", args),
    getBrandKit: (projectId) => import_electron.ipcRenderer.invoke("cench:projects.getBrandKit", projectId),
    updateBrandKit: (args) => import_electron.ipcRenderer.invoke("cench:projects.updateBrandKit", args)
  },
  workspaces: {
    list: () => import_electron.ipcRenderer.invoke("cench:workspaces.list"),
    get: (workspaceId) => import_electron.ipcRenderer.invoke("cench:workspaces.get", workspaceId),
    create: (args) => import_electron.ipcRenderer.invoke("cench:workspaces.create", args),
    update: (args) => import_electron.ipcRenderer.invoke("cench:workspaces.update", args),
    delete: (workspaceId) => import_electron.ipcRenderer.invoke("cench:workspaces.delete", workspaceId),
    assignProjects: (args) => import_electron.ipcRenderer.invoke("cench:workspaces.assignProjects", args),
    unassignProjects: (args) => import_electron.ipcRenderer.invoke("cench:workspaces.unassignProjects", args)
  },
  publish: {
    run: (args) => import_electron.ipcRenderer.invoke("cench:publish.run", args)
  },
  scene: {
    writeHtml: (args) => import_electron.ipcRenderer.invoke("cench:scene.writeHtml", args),
    get: (args) => import_electron.ipcRenderer.invoke("cench:scene.get", args),
    generateWorld: (args) => import_electron.ipcRenderer.invoke("cench:scene.generateWorld", args)
  },
  media: {
    upload: (args) => import_electron.ipcRenderer.invoke("cench:media.upload", args)
  },
  avatarConfigs: {
    list: (args) => import_electron.ipcRenderer.invoke("cench:avatarConfigs.list", args),
    create: (args) => import_electron.ipcRenderer.invoke("cench:avatarConfigs.create", args),
    update: (args) => import_electron.ipcRenderer.invoke("cench:avatarConfigs.update", args),
    delete: (args) => import_electron.ipcRenderer.invoke("cench:avatarConfigs.delete", args)
  },
  zdogLibrary: {
    list: (args) => import_electron.ipcRenderer.invoke("cench:zdogLibrary.list", args),
    save: (args) => import_electron.ipcRenderer.invoke("cench:zdogLibrary.save", args),
    delete: (args) => import_electron.ipcRenderer.invoke("cench:zdogLibrary.delete", args)
  },
  tts: {
    synthesize: (args) => import_electron.ipcRenderer.invoke("cench:tts.synthesize", args)
  },
  sfx: {
    search: (args) => import_electron.ipcRenderer.invoke("cench:sfx.search", args)
  },
  music: {
    search: (args) => import_electron.ipcRenderer.invoke("cench:music.search", args)
  }
};
import_electron.contextBridge.exposeInMainWorld("cenchApi", cenchApi);
var api = {
  saveDialog: (suggestedName) => import_electron.ipcRenderer.invoke("cench:saveDialog", suggestedName),
  writeFile: (args) => import_electron.ipcRenderer.invoke("cench:writeFile", args),
  saveRecording: (args) => import_electron.ipcRenderer.invoke("cench:saveRecording", args),
  concatMp4: (args) => import_electron.ipcRenderer.invoke("cench:concatMp4", args),
  getGitStatus: () => import_electron.ipcRenderer.invoke("cench:gitStatus"),
  webZoomIn: () => import_electron.ipcRenderer.invoke("cench:webZoomIn"),
  webZoomOut: () => import_electron.ipcRenderer.invoke("cench:webZoomOut"),
  webZoomReset: () => import_electron.ipcRenderer.invoke("cench:webZoomReset"),
  capturePage: (args) => import_electron.ipcRenderer.invoke("cench:capturePage", args),
  saveRecordingSession: (args) => import_electron.ipcRenderer.invoke("cench:saveRecordingSession", args),
  startCursorTelemetry: () => import_electron.ipcRenderer.invoke("cench:startCursorTelemetry"),
  stopCursorTelemetry: () => import_electron.ipcRenderer.invoke("cench:stopCursorTelemetry")
};
import_electron.contextBridge.exposeInMainWorld("electronAPI", api);
//# sourceMappingURL=preload.js.map
