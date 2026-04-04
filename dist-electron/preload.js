"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const api = {
    saveDialog: (suggestedName) => electron_1.ipcRenderer.invoke('cench:saveDialog', suggestedName),
    writeFile: (args) => electron_1.ipcRenderer.invoke('cench:writeFile', args),
    saveRecording: (args) => electron_1.ipcRenderer.invoke('cench:saveRecording', args),
    concatMp4: (args) => electron_1.ipcRenderer.invoke('cench:concatMp4', args),
};
electron_1.contextBridge.exposeInMainWorld('electronAPI', api);
