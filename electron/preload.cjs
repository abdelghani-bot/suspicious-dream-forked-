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
    // 🆕 كاش المبيعات المحلي (sales_cache) — لقراءة/فتح الفواتير أوفلاين
    insertSaleCache: (invoice) => ipcRenderer.invoke("offline:insertSaleCache", invoice),
    getSalesCache: (params) => ipcRenderer.invoke("offline:getSalesCache", params),
    getSaleById: (saleId) => ipcRenderer.invoke("offline:getSaleById", saleId),
    // 🆕 كاش فواتير الشراء المحلي (purchase_invoices_cache)
    insertPurchaseInvoiceCache: (invoice) => ipcRenderer.invoke("offline:insertPurchaseInvoiceCache", invoice),
    getPurchaseInvoicesCache: (params) => ipcRenderer.invoke("offline:getPurchaseInvoicesCache", params),
    getPurchaseInvoiceById: (invoiceId) => ipcRenderer.invoke("offline:getPurchaseInvoiceById", invoiceId),
});
