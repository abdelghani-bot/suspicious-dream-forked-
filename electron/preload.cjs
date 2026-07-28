const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopApp", {
    isElectron: true,
    getVersion: () => ipcRenderer.invoke("app:getVersion"),
});

contextBridge.exposeInMainWorld("offlineAPI", {
    getProducts: (pharmacyId) => ipcRenderer.invoke("offline:getProducts", pharmacyId),
    upsertProduct: (product) => ipcRenderer.invoke("offline:upsertProduct", product),
    queueEvent: (evt) => ipcRenderer.invoke("offline:queueEvent", evt),
    persistEvent: (evt) => ipcRenderer.invoke("offline:queueEvent", evt),
    getPendingEvents: () => ipcRenderer.invoke("offline:getPendingEvents"),
    markSynced: (ids) => ipcRenderer.invoke("offline:markSynced", ids),
    cacheCredentials: (payload) => ipcRenderer.invoke("offline:cacheCredentials", payload),
    verifyOfflineLogin: (payload) => ipcRenderer.invoke("offline:verifyOfflineLogin", payload),
    // جديد
    cacheSession: (payload) => ipcRenderer.invoke("offline:cacheSession", payload),
    getCachedSession: (pharmacyId) => ipcRenderer.invoke("offline:getCachedSession", pharmacyId),
    clearCachedSession: (pharmacyId) => ipcRenderer.invoke("offline:clearCachedSession", pharmacyId),
});
