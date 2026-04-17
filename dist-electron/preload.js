"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const cenchApi = {
    settings: {
        listProviders: () => electron_1.ipcRenderer.invoke('cench:settings.listProviders'),
    },
};
electron_1.contextBridge.exposeInMainWorld('cenchApi', cenchApi);
const api = {
    saveDialog: (suggestedName) => electron_1.ipcRenderer.invoke('cench:saveDialog', suggestedName),
    writeFile: (args) => electron_1.ipcRenderer.invoke('cench:writeFile', args),
    saveRecording: (args) => electron_1.ipcRenderer.invoke('cench:saveRecording', args),
    concatMp4: (args) => electron_1.ipcRenderer.invoke('cench:concatMp4', args),
    getGitStatus: () => electron_1.ipcRenderer.invoke('cench:gitStatus'),
    webZoomIn: () => electron_1.ipcRenderer.invoke('cench:webZoomIn'),
    webZoomOut: () => electron_1.ipcRenderer.invoke('cench:webZoomOut'),
    webZoomReset: () => electron_1.ipcRenderer.invoke('cench:webZoomReset'),
    capturePage: (args) => electron_1.ipcRenderer.invoke('cench:capturePage', args),
    saveRecordingSession: (args) => electron_1.ipcRenderer.invoke('cench:saveRecordingSession', args),
    startCursorTelemetry: () => electron_1.ipcRenderer.invoke('cench:startCursorTelemetry'),
    stopCursorTelemetry: () => electron_1.ipcRenderer.invoke('cench:stopCursorTelemetry'),
};
electron_1.contextBridge.exposeInMainWorld('electronAPI', api);
