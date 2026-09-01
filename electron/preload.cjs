const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopApp", {
    isElectron: true,
    getVersion: () => ipcRenderer.invoke("app:getVersion"),
});

contextBridge.exposeInMainWorld("offlineAPI", {
    // 🆕 كاش المنتجات المحلي (products_cache) — بديل SQLite لتخزين المنتجات بدل
    // localStorage، عشان لا نصطدم بحد الحجم (5-10MB) في الكتالوجات الكبيرة.
    getProductsCache: (pharmacyId) => ipcRenderer.invoke("offline:getProductsCache", pharmacyId),
    upsertProductsCache: (payload) => ipcRenderer.invoke("offline:upsertProductsCache", payload),
    applyProductStockDeltaCache: (payload) => ipcRenderer.invoke("offline:applyProductStockDeltaCache", payload),
    queueEvent: (evt) => ipcRenderer.invoke("offline:queueEvent", evt),
    persistEvent: (evt) => ipcRenderer.invoke("offline:queueEvent", evt),
    getPendingEvents: () => ipcRenderer.invoke("offline:getPendingEvents"),
    markSynced: (ids) => ipcRenderer.invoke("offline:markSynced", ids),
    // 🆕 تسجيل فشل مزامنة event (بيزوّد sync_attempts وبيعلّمه dead-letter لو عدّى الحد الأقصى)
    recordSyncFailure: (payload) => ipcRenderer.invoke("offline:recordSyncFailure", payload),
    getDeadLetterEvents: () => ipcRenderer.invoke("offline:getDeadLetterEvents"),
    cacheCredentials: (payload) => ipcRenderer.invoke("offline:cacheCredentials", payload),
    verifyOfflineLogin: (payload) => ipcRenderer.invoke("offline:verifyOfflineLogin", payload),
    // جديد
    cacheSession: (payload) => ipcRenderer.invoke("offline:cacheSession", payload),
    getCachedSession: (pharmacyId) => ipcRenderer.invoke("offline:getCachedSession", pharmacyId),
    clearCachedSession: (pharmacyId) => ipcRenderer.invoke("offline:clearCachedSession", pharmacyId),
    // 🆕 هوية الجهاز وتفعيله — ثابتة لكل تثبيت، مستقلة عن أي يوزر
    getDeviceFingerprint: () => ipcRenderer.invoke("device:getFingerprint"),
    cacheActivationStatus: (payload) => ipcRenderer.invoke("device:cacheActivationStatus", payload),
    // 🆕 كاش المبيعات المحلي (sales_cache) — لقراءة/فتح الفواتير أوفلاين
    insertSaleCache: (invoice) => ipcRenderer.invoke("offline:insertSaleCache", invoice),
    getSalesCache: (params) => ipcRenderer.invoke("offline:getSalesCache", params),
    getSaleById: (saleId) => ipcRenderer.invoke("offline:getSaleById", saleId),
    // 🆕 كاش فواتير الشراء المحلي (purchase_invoices_cache)
    insertPurchaseInvoiceCache: (invoice) => ipcRenderer.invoke("offline:insertPurchaseInvoiceCache", invoice),
    getPurchaseInvoicesCache: (params) => ipcRenderer.invoke("offline:getPurchaseInvoicesCache", params),
    getPurchaseInvoiceById: (invoiceId) => ipcRenderer.invoke("offline:getPurchaseInvoiceById", invoiceId),
    // 🆕 كاش سجلات الجرد المحلي (inventory_logs_cache) — نفس نمط sales_cache/purchase_invoices_cache
    insertInventoryLogCache: (log) => ipcRenderer.invoke("offline:insertInventoryLogCache", log),
    getInventoryLogsCache: (params) => ipcRenderer.invoke("offline:getInventoryLogsCache", params),
    // 🆕 كاش الشفتات المحلي (shifts_cache)
    upsertShiftCache: (shift) => ipcRenderer.invoke("offline:upsertShiftCache", shift),
    getShiftsCache: (params) => ipcRenderer.invoke("offline:getShiftsCache", params),
    getCurrentOpenShift: (params) => ipcRenderer.invoke("offline:getCurrentOpenShift", params),
    getOpenShifts: (pharmacyId) => ipcRenderer.invoke("offline:getOpenShifts", pharmacyId),
    // 🆕 كاش الخزنة الموحّد (treasury_entries_cache) — يستخدمه كل موديول يكتب/يقرأ قيود خزنة
    upsertTreasuryEntryCache: (entry) => ipcRenderer.invoke("offline:upsertTreasuryEntryCache", entry),
    getTreasuryEntriesCache: (params) => ipcRenderer.invoke("offline:getTreasuryEntriesCache", params),
    // 🆕 كاش المرتجعات المحلي (returns_cache)
    insertReturnCache: (ret) => ipcRenderer.invoke("offline:insertReturnCache", ret),
    getReturnsCache: (params) => ipcRenderer.invoke("offline:getReturnsCache", params),
    upsertCustomerCache: (customer) => ipcRenderer.invoke("offline:upsertCustomerCache", customer),
    getCustomersCache: (pharmacyId) => ipcRenderer.invoke("offline:getCustomersCache", pharmacyId),
    deleteCustomerCache: (customerId) => ipcRenderer.invoke("offline:deleteCustomerCache", customerId),
    upsertCreditPaymentCache: (payment) => ipcRenderer.invoke("offline:upsertCreditPaymentCache", payment),
    getCreditPaymentsCache: (args) => ipcRenderer.invoke("offline:getCreditPaymentsCache", args),
    getPromotionsCache: (pharmacyId) => ipcRenderer.invoke("offline:getPromotionsCache", pharmacyId),
    upsertPromotionCache: (promotion) => ipcRenderer.invoke("offline:upsertPromotionCache", promotion),
    deletePromotionCache: (promotionId) => ipcRenderer.invoke("offline:deletePromotionCache", promotionId),
    refreshPromotionsCache: (payload) => ipcRenderer.invoke("offline:refreshPromotionsCache", payload),
    getPromoRulesCache: (pharmacyId) => ipcRenderer.invoke("offline:getPromoRulesCache", pharmacyId),
    replacePromoRulesCache: (payload) => ipcRenderer.invoke("offline:replacePromoRulesCache", payload),
    getPromoSettingsCache: (pharmacyId) => ipcRenderer.invoke("offline:getPromoSettingsCache", pharmacyId),
    upsertPromoSettingsCache: (payload) => ipcRenderer.invoke("offline:upsertPromoSettingsCache", payload),
    upsertMonthlyTargetCache: (payload) => ipcRenderer.invoke("offline:upsertMonthlyTargetCache", payload),
    getMonthlyTargetsCache: (pharmacyId) => ipcRenderer.invoke("offline:getMonthlyTargetsCache", pharmacyId),
    upsertIncentiveConfigCache: (payload) => ipcRenderer.invoke("offline:upsertIncentiveConfigCache", payload),
    getIncentiveConfigCache: (pharmacyId) => ipcRenderer.invoke("offline:getIncentiveConfigCache", pharmacyId),
    // 🆕 تاريخ الفئات المسموحة — عشان حماية عمولة الشهور القديمة من الأثر الرجعي
    insertIncentiveConfigHistoryCache: (payload) => ipcRenderer.invoke("offline:insertIncentiveConfigHistoryCache", payload),
    getIncentiveConfigHistoryCache: (pharmacyId) => ipcRenderer.invoke("offline:getIncentiveConfigHistoryCache", pharmacyId),
    upsertIncentiveTierCache: (payload) => ipcRenderer.invoke("offline:upsertIncentiveTierCache", payload),
    deleteIncentiveTierCache: (id) => ipcRenderer.invoke("offline:deleteIncentiveTierCache", id),
    getIncentiveTiersCache: (pharmacyId) => ipcRenderer.invoke("offline:getIncentiveTiersCache", pharmacyId),
    insertTierThresholdHistoryCache: (payload) => ipcRenderer.invoke("offline:insertTierThresholdHistoryCache", payload),
    getTierThresholdHistoryCache: (pharmacyId) => ipcRenderer.invoke("offline:getTierThresholdHistoryCache", pharmacyId),
    upsertIncentiveOverrideCache: (row) => ipcRenderer.invoke("offline:upsertIncentiveOverrideCache", row),
    deleteIncentiveOverrideCache: (id) => ipcRenderer.invoke("offline:deleteIncentiveOverrideCache", id),
    // 🆕 تاريخ الاستثناءات/الإضافات اليدوية — نفس السبب
    insertIncentiveOverrideHistoryCache: (payload) => ipcRenderer.invoke("offline:insertIncentiveOverrideHistoryCache", payload),
    getIncentiveOverrideHistoryCache: (pharmacyId) => ipcRenderer.invoke("offline:getIncentiveOverrideHistoryCache", pharmacyId),
    getIncentiveOverridesCache: (pharmacyId) => ipcRenderer.invoke("offline:getIncentiveOverridesCache", pharmacyId),
    refreshIncentiveProductsCache: (payload) => ipcRenderer.invoke("offline:refreshIncentiveProductsCache", payload),
    getIncentiveProductsCache: (pharmacyId) => ipcRenderer.invoke("offline:getIncentiveProductsCache", pharmacyId),
    refreshManufacturersCache: (payload) => ipcRenderer.invoke("offline:refreshManufacturersCache", payload),
    getManufacturersCache: (pharmacyId) => ipcRenderer.invoke("offline:getManufacturersCache", pharmacyId),
    getLoyaltyPointsCache: (pharmacyId) => ipcRenderer.invoke("offline:getLoyaltyPointsCache", pharmacyId),
    upsertLoyaltyPointsCache: (data) => ipcRenderer.invoke("offline:upsertLoyaltyPointsCache", data),
    applyLoyaltyDeltaCache: (data) => ipcRenderer.invoke("offline:applyLoyaltyDeltaCache", data),
    insertLoyaltyTransactionCache: (row) => ipcRenderer.invoke("offline:insertLoyaltyTransactionCache", row),
    getLoyaltyTransactionsCache: (data) => ipcRenderer.invoke("offline:getLoyaltyTransactionsCache", data),
    // 🆕 كاش الحضور والانصراف المحلي (attendance_logs_cache)
    upsertAttendanceLogCache: (log) => ipcRenderer.invoke("offline:upsertAttendanceLogCache", log),
    getTodayAttendanceLogsCache: (params) => ipcRenderer.invoke("offline:getTodayAttendanceLogsCache", params),
    getAttendanceLogsRangeCache: (params) => ipcRenderer.invoke("offline:getAttendanceLogsRangeCache", params),
    // 🆕 كاش فترات بريك الصلاة المحلي (prayer_breaks_cache)
    upsertPrayerBreakCache: (brk) => ipcRenderer.invoke("offline:upsertPrayerBreakCache", brk),
    getPrayerBreaksCache: (params) => ipcRenderer.invoke("offline:getPrayerBreaksCache", params),
    getPrayerBreaksRangeCache: (params) => ipcRenderer.invoke("offline:getPrayerBreaksRangeCache", params),
    // 🆕 كاش جداول العمل المحلي (work_schedules_cache)
    upsertWorkScheduleCache: (row) => ipcRenderer.invoke("offline:upsertWorkScheduleCache", row),
    deleteWorkSchedulesCacheByPharmacist: (params) => ipcRenderer.invoke("offline:deleteWorkSchedulesCacheByPharmacist", params),
    deleteWorkScheduleCache: (id) => ipcRenderer.invoke("offline:deleteWorkScheduleCache", id),
    getWorkSchedulesCache: (pharmacyId) => ipcRenderer.invoke("offline:getWorkSchedulesCache", pharmacyId),
    // 🆕 كاش الإجازات الرسمية المحلي (holidays_cache)
    upsertHolidayCache: (holiday) => ipcRenderer.invoke("offline:upsertHolidayCache", holiday),
    deleteHolidayCache: (id) => ipcRenderer.invoke("offline:deleteHolidayCache", id),
    getHolidaysCache: (pharmacyId) => ipcRenderer.invoke("offline:getHolidaysCache", pharmacyId),
    // 🆕 كاش جداول التناوب المحلي (rotation_schedules_cache)
    upsertRotationScheduleCache: (rotation) => ipcRenderer.invoke("offline:upsertRotationScheduleCache", rotation),
    deleteRotationScheduleCache: (id) => ipcRenderer.invoke("offline:deleteRotationScheduleCache", id),
    getRotationSchedulesCache: (pharmacyId) => ipcRenderer.invoke("offline:getRotationSchedulesCache", pharmacyId),
    // 🆕 كاش إعدادات مواقيت الصلاة المحلي (prayer_settings_cache)
    upsertPrayerSettingCache: (setting) => ipcRenderer.invoke("offline:upsertPrayerSettingCache", setting),
    getPrayerSettingsCache: (pharmacyId) => ipcRenderer.invoke("offline:getPrayerSettingsCache", pharmacyId),
    // 🆕 كاش فجوات الحضور غير المراجعة المحلي (attendance_gaps_cache)
    upsertAttendanceGapCache: (gap) => ipcRenderer.invoke("offline:upsertAttendanceGapCache", gap),
    getUnreviewedAttendanceGapsCache: (pharmacyId) => ipcRenderer.invoke("offline:getUnreviewedAttendanceGapsCache", pharmacyId),
    // 🆕 كاش المبيعات الفائتة المحلي (missed_sales_cache)
    upsertMissedSalesCache: (payload) => ipcRenderer.invoke("offline:upsertMissedSalesCache", payload),
    getTodayMissedSalesCache: (params) => ipcRenderer.invoke("offline:getTodayMissedSalesCache", params),
    getMissedSalesMonthCache: (params) => ipcRenderer.invoke("offline:getMissedSalesMonthCache", params),
    getPharmacySettingsCache: (pharmacyId) => ipcRenderer.invoke("offline:getPharmacySettingsCache", pharmacyId),
    upsertPharmacySettingsCache: (payload) => ipcRenderer.invoke("offline:upsertPharmacySettingsCache", payload),
    replaceVarianceLogCache: (args) => ipcRenderer.invoke("offline:replaceVarianceLogCache", args),
    getVarianceLogCache: (pharmacyId) => ipcRenderer.invoke("offline:getVarianceLogCache", pharmacyId),
    addVarianceLogCacheEntry: (row) => ipcRenderer.invoke("offline:addVarianceLogCacheEntry", row),
    removeVarianceLogCacheByProduct: (args) => ipcRenderer.invoke("offline:removeVarianceLogCacheByProduct", args),
    upsertItemTypeCache: (row) => ipcRenderer.invoke("offline:upsertItemTypeCache", row),
    getItemTypesCache: (pharmacyId) => ipcRenderer.invoke("offline:getItemTypesCache", pharmacyId),
    refreshItemTypesCache: (payload) => ipcRenderer.invoke("offline:refreshItemTypesCache", payload),
    getSubCategories2Cache: (pharmacyId) => ipcRenderer.invoke("offline:getSubCategories2Cache", pharmacyId),
    upsertSubCategory2Cache: (payload) => ipcRenderer.invoke("offline:upsertSubCategory2Cache", payload),
    refreshSubCategories2Cache: (payload) => ipcRenderer.invoke("offline:refreshSubCategories2Cache", payload),
    deleteItemTypeCache: (payload) => ipcRenderer.invoke("offline:deleteItemTypeCache", payload),
    deleteSubCategory2Cache: (payload) => ipcRenderer.invoke("offline:deleteSubCategory2Cache", payload),
});
contextBridge.exposeInMainWorld("printAPI", {
    printHTML: (html, options) => ipcRenderer.invoke("print:html", { html, options }),
    listPrinters: () => ipcRenderer.invoke("printer:list"), // 🆕
});