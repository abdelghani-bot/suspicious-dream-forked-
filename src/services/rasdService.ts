import { toString } from "../function toString() { [native code] }/undefined";

// ==================== RASSD SERVICE ====================

// نظام رصد (DTTS) شغال SOAP 1.2 مش REST ومش SOAP 1.1 — كل عملية عندها Service منفصلة
// (مؤكد من "Integration Guide for Drug Track & Trace System" الرسمي — قسم 6: DTTS Web Services use SOAP Version 1.2)
// الفرق مش شكلي: الـ envelope namespace مختلف (soap12 مش soap11)، والـ Content-Type بيبقى
// application/soap+xml مش text/xml، وSOAPAction بيتبعت جوه الـ Content-Type مش كـ header منفصل
//
// أسماء الـ Request/Response elements تحت دي متأخوذة حرفيًا من ملفات الـ ISD الرسمية (DTTS-ISD_*.docx)
// اللي SFDA وزّعتها لكل عملية — مش تخمين. لاحظ إن الأسماء مش موحّدة زي ما كنا متوقعين:
//   - Accept  → عنصره "AcceptRequest" (مش AcceptServiceRequest) ومفيهوش Cancel أصلاً (استخدم Return بدلها)
//   - Return  → عنصره فعلاً "ReturnServiceRequest" (الاستثناء الوحيد اللي فيه "Service" في اسم الـ request)
//   - Deactivate → اسم العملية في الـ ISD نفسه "Deactivation" مش "Deactivate"، وعندها حقل DR (كود سبب من قائمة قيم ثابتة) + EXPLANATION
//   - Transfer/Return → حقل رقم الإشعار في الرد اسمه "NOTIFICATION_ID" بـ underscore، بعكس باقي الخدمات اللي بتستخدم "NOTIFICATIONID"
// الـ baseUrl الحقيقي + مسارات كل Service الفعلية لازم تتأكد من ملف الـ WSDL (ANNEX-A) اللي بييجي مع كل ISD بعد التسجيل
export const RasdService = {
  baseUrl: "", // مثال متوقع: https://rsd.sfda.gov.sa/ws — يتحدد من الإعدادات
  username: "",
  password: "",

  // قائمة قيم DR (سبب الإخراج من النظام) زي ما جات حرفيًا في DTTS-DEF (قسم 4.2)
  DR_REASONS: {
    "10": "سحب بسبب Recall",
    "20": "سحب بسبب انتهاء الصلاحية",
    "30": "منتج تالف",
    "40": "عيب في الجودة",
    "50": "تخزين غير مناسب",
    "60": "مرتجع من عميل",
    "70": "أخرى",
  },

  configure(cfg) {
    this.baseUrl = (cfg.apiUrl || "").replace(/\/$/, "");
    this.username = cfg.username || "";
    this.password = cfg.password || "";
  },

  _serviceUrl(serviceName) {
    return `${this.baseUrl}/${serviceName}/${serviceName}`;
  },

  // WS-Security UsernameToken — الطريقة الأشهر لخدمات SOAP الحكومية
  // (الـ WSDL بيستورد wsu namespace؛ لو SFDA قالوا طريقة auth تانية غيّر هنا بس)
  _wsSecurityHeader() {
    const created = new Date().toISOString();
    return `<wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" soapenv:mustUnderstand="1">
      <wsse:UsernameToken>
        <wsse:Username>${this.username}</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-username-token-profile-1.0#PasswordText">${this.password}</wsse:Password>
        <wsu:Created xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">${created}</wsu:Created>
      </wsse:UsernameToken>
    </wsse:Security>`;
  },

  // PRODUCT فيها GTIN/SN/BN/XD بس — RC بيرجع في الرد بس (مش بيتبعت في الطلب) حسب DTTS-DEF
  _productListXml(items) {
    return `<PRODUCTLIST>${items
      .map(
        (i) => `
      <PRODUCT>
        <GTIN>${i.gtin}</GTIN>
        ${i.serial ? `<SN>${i.serial}</SN>` : ""}
        ${i.quantity ? `<QTY>${i.quantity}</QTY>` : ""}
        ${i.batch ? `<BN>${i.batch}</BN>` : ""}
        ${i.expiry ? `<XD>${i.expiry}</XD>` : ""}
      </PRODUCT>`
      )
      .join("")}</PRODUCTLIST>`;
  },

  async _call(serviceName, requestElementName, innerXml) {
    if (!this.baseUrl) return { success: false, error: "لم يتم ضبط رابط رصد (apiUrl) بعد" };
    const url = this._serviceUrl(serviceName);
    const soapAction = `http://dtts.sfda.gov.sa/${serviceName}/${requestElementName}`;
    // ✅ اتأكد بالاختبار المباشر عبر Fiddler (طلب ErrorCodeListService اللي رجع 200 OK فعلي)
    // إن سيرفر رصد: (1) بيقبل SOAP 1.1 بس مش 1.2، (2) مفيهوش soapenv:Header خالص —
    // الـ auth كله عن طريق HTTP Basic Auth header بس، من غير WS-Security UsernameToken جوه الـ Body.
    // إضافة Header زيادة كانت بتخلي السيرفر يرفض الطلب بـ 400 Bad Request.
    const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <${requestElementName} xmlns="http://dtts.sfda.gov.sa/${serviceName}">${innerXml}</${requestElementName}>
  </soapenv:Body>
</soapenv:Envelope>`;

    try {
      // الـ auth بيتبعت بـ HTTP Basic Auth بس (مؤكد إنه شغال من الاختبار المباشر) —
      // WS-Security جوه الـ SOAP Header اتشال لأنه كان بيسبب 400 Bad Request.
      const basicAuth = (this.username || this.password)
        ? "Basic " + btoa(`${this.username}:${this.password}`)
        : null;
      const res = await fetch(url, {
        method: "POST",
        // SOAP 1.1: Content-Type ثابت text/xml + SOAPAction هيدر منفصل (مش جوه Content-Type)
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          "SOAPAction": `"${soapAction}"`,
          ...(basicAuth ? { Authorization: basicAuth } : {}),
        },
        body: envelope,
      });
      const text = await res.text();
      const parsed = this._parseResponse(text);
      // isRealSoapResponse: true بس لو فعلاً وصل رد SOAP حقيقي من رصد (حتى لو Fault)،
      // مش مجرد خطأ من طبقة البروكسي نفسها (زي 405 Method Not Allowed أو صفحة HTML بدل XML)
      const isRealSoapResponse = parsed.isXml === true;
      if (!res.ok || parsed.error) {
        return {
          success: false,
          error: parsed.error || `HTTP ${res.status}`,
          raw: text,
          httpStatus: res.status,
          isRealSoapResponse,
        };
      }
      return { success: true, data: parsed, httpStatus: res.status, isRealSoapResponse };
    } catch (e) {
      return { success: false, error: e.message, isRealSoapResponse: false };
    }
  },

  _parseResponse(xmlText) {
    const doc = new DOMParser().parseFromString(xmlText, "text/xml");
    const parserErr = doc.getElementsByTagName("parsererror")[0];
    // لو مش XML سليم (مثلاً صفحة HTML/نص عادي راجع من طبقة البروكسي بسبب 405 أو 404)
    // معناه إننا مش وصلنا لسيرفر رصد فعليًا، حتى لو الطلب "اتبعت" من غير Failed to fetch
    if (parserErr) return { error: "استجابة غير صالحة من رصد (مش XML — على الأغلب خطأ في البروكسي مش في رصد نفسه)", isXml: false };
    const faultString = doc.getElementsByTagName("faultstring")[0];
    if (faultString) return { error: faultString.textContent, isXml: true };
    const fc = doc.getElementsByTagName("FC")[0];
    if (fc) return { error: "كود خطأ رصد: " + fc.textContent, isXml: true };

    // Return/Transfer/TransferCancel بيرجعوا NOTIFICATION_ID بـ underscore، الباقي NOTIFICATIONID من غيره
    const notifId =
      doc.getElementsByTagName("NOTIFICATIONID")[0]?.textContent ||
      doc.getElementsByTagName("NOTIFICATION_ID")[0]?.textContent ||
      null;
    const products = Array.from(doc.getElementsByTagName("PRODUCT")).map((p) => ({
      gtin: p.getElementsByTagName("GTIN")[0]?.textContent,
      sn: p.getElementsByTagName("SN")[0]?.textContent,
      bn: p.getElementsByTagName("BN")[0]?.textContent,
      xd: p.getElementsByTagName("XD")[0]?.textContent,
      rc: p.getElementsByTagName("RC")[0]?.textContent, // كود نتيجة كل منتج
    }));
    // بترجع بس في رد CheckStatus (GLN1/GLN2 = المالك الحالي/السابق)
    const gln1 = doc.getElementsByTagName("GLN1")[0]?.textContent || null;
    const gln2 = doc.getElementsByTagName("GLN2")[0]?.textContent || null;
    // بترجعوا بس في رد Dispatch Detail
    const fromGln = doc.getElementsByTagName("FROMGLN")[0]?.textContent || null;
    const notificationDate = doc.getElementsByTagName("NOTIFICATIONDATE")[0]?.textContent || null;
    return { notificationId: notifId, products, gln1, gln2, fromGln, notificationDate, isXml: true };
  },

  // ---- عمليات الصيدلية ----

  // بيع (مباشر للمريض أو عن طريق جهة تسديد)
  // ✅ اسم الـ Service الصح "PharmacySaleService" وعنصر الطلب "PharmacySaleServiceRequest"
  // مؤكد من WSDL الرسمي (DTTS-ISD_PHARMACY_SALE-1_0_1): soap:address .../PharmacySaleService/PharmacySaleService
  async notifyPharmacySale({ toGln, prescriptionId, prescriptionDate, doctorId, patientNationalId, items }) {
    const body = `
      <TOGLN>${toGln || "0000000000000"}</TOGLN>
      ${doctorId ? `<DOCTORID>${doctorId}</DOCTORID>` : ""}
      ${patientNationalId ? `<PATIENTNATIONALID>${patientNationalId}</PATIENTNATIONALID>` : ""}
      <PRESCRIPTIONID>${prescriptionId}</PRESCRIPTIONID>
      <PRESCRIPTIONDATE>${prescriptionDate}</PRESCRIPTIONDATE>
      ${this._productListXml(items)}`;
    return this._call("PharmacySaleService", "PharmacySaleServiceRequest", body);
  },

  // ✅ اسم الـ Service الصح "PharmacySaleCancelService" وعنصر الطلب "PharmacySaleCancelServiceRequest"
  async notifyPharmacySaleCancel({ toGln, prescriptionId, items }) {
    const body = `
      <TOGLN>${toGln || "0000000000000"}</TOGLN>
      <PRESCRIPTIONID>${prescriptionId}</PRESCRIPTIONID>
      ${this._productListXml(items)}`;
    return this._call("PharmacySaleCancelService", "PharmacySaleCancelServiceRequest", body);
  },

  // إرجاع (مرتجعات المشتريات للمورد أو مرتجعات المبيعات حسب toGln)
  // ملحوظة من الدليل: الصيدلية تقدر ترجّع بس للجهة اللي استلمت المنتج منها أصلًا
  // ✅ اسم الـ Service الصح "ReturnService" وعنصر الطلب "ReturnServiceRequest"
  // مؤكد من WSDL الرسمي (DTTS-ISD_RETURN-1_0_1): soap:address .../ReturnService/ReturnService
  // ومفيهوش Return Cancel — لإلغاء إرجاع غلط لازم تستخدم Accept Notification بدلها
  // ✅ items ممكن تيجي بشكلين: عنصر فيه serial (إرجاع وحدة واحدة بالسيريال الحقيقي)،
  // أو عنصر فيه quantity بدل serial (إرجاع دفعة كاملة بالـ GTIN+BN+XD+QTY من غير سيريال —
  // مؤكد من لقطات شاشة رصد الفعلية إن العملية بتقبل الشكل ده، والـ PRODUCT object نفسه
  // بنفس البنية الثابتة في كل خدمات رصد حسب DTTS-DEF).
  async notifyReturn({ toGln, items }) {
    const body = `
      <TOGLN>${toGln}</TOGLN>
      ${this._productListXml(items)}`;
    return this._call("ReturnService", "ReturnServiceRequest", body);
  },

  // إخراج منتج من النظام (تالف / منتهي الصلاحية / مسحوب من السوق)
  // dr: كود من RasdService.DR_REASONS (زي "30" لمنتج تالف)، explanation: نص حر توضيحي
  // ✅ اسم الـ Service الصح "DeactivationService" وعنصر الطلب "DeactivationServiceRequest"
  // مؤكد من WSDL الرسمي (DTTS-ISD_DEACTIVATE-1_0_2): soap:address .../DeactivationService/DeactivationService
  async notifyDeactivate({ dr, explanation, items }) {
    const body = `
      <DR>${dr}</DR>
      ${explanation ? `<EXPLANATION>${explanation}</EXPLANATION>` : ""}
      ${this._productListXml(items)}`;
    return this._call("DeactivationService", "DeactivationServiceRequest", body);
  },

  // ✅ اسم الـ Service الصح "DeactivationCancelService" وعنصر الطلب "DeactivationCancelServiceRequest"
  async notifyDeactivateCancel({ items }) {
    const body = this._productListXml(items);
    return this._call("DeactivationCancelService", "DeactivationCancelServiceRequest", body);
  },

  // ملحوظة: عمليات النقل (Transfer/TransferCancel) بتتعمل يدوي من موقع رصد نفسه مش من
  // البرنامج، فمفيش داعي نبني/نبعت SOAP request ليها هنا.

  // استعلام عن حالة منتج (خدمة مساعدة، مفيدة كاختبار اتصال حقيقي)
  // الرد بيرجع كمان GLN1 (المالك الحالي) و GLN2 (المالك السابق) لكل منتج
  // ✅ اسم الـ Service الصح "CheckStatusService" مش "CheckStatus" — مؤكد من الـ WSDL الرسمي
  // (DTTS-ISD_CHECKSTATUS-1_0_1): soap:address location=".../CheckStatusService/CheckStatusService"
  // وعنصر الطلب اسمه "CheckStatusServiceRequest" مش "CheckStatusRequest"
  async checkStatus({ items }) {
    const body = this._productListXml(items);
    return this._call("CheckStatusService", "CheckStatusServiceRequest", body);
  },

  // ---- PTS (Package Transfer Service) — نقل ملفات zip مجمّعة بدل إرسال كل GTIN/SN لوحده ----
  // PTS مختلفة تمامًا عن باقي عمليات رصد: مفيهوش PRODUCTLIST خالص، وبتتعامل مع ملف zip واحد
  // مبعوت كـ Base64 Stream. رصد نفسه "ناقل ملفات" بس — مش بيتحقق من محتوى الملف، فالتحقق الفعلي
  // من المنتجات جوّه الملف (ومطابقتها بإشعارات Supply/Import الأصلية) مسؤولية الطرفين برضه.
  // (مؤكد من DTTS-ISD_PACKAGETRANSFER + الـ WSDL الفعلي المستخرج من نفس ملف الـ ISD — مش تخمين)
  //
  // لاحظ الفرق عن باقي خدمات رصد فوق:
  //  - كل خدمة من التلاتة ليها اسم Service منفصل بالكامل (PackageUploadService/PackageDownloadService/PackageQueryService)
  //  - اسم الـ operation في الـ WSDL نفسه مختلف عن اسم عنصر الطلب (uploadFile/downloadFile/packageQuery
  //    مقابل PackageUploadServiceRequest/PackageDownloadServiceRequest/PackageQueryServiceRequest كعناصر body)
  //  - الـ soapAction بيكرر اسم الـ service مرتين فعلاً: .../PackageUploadService/PackageUploadService/uploadFileRequest
  PTS_OPERATIONS: {
    upload: { service: "PackageUploadService", operation: "uploadFile", requestElement: "PackageUploadServiceRequest" },
    download: { service: "PackageDownloadService", operation: "downloadFile", requestElement: "PackageDownloadServiceRequest" },
    query: { service: "PackageQueryService", operation: "packageQuery", requestElement: "PackageQueryServiceRequest" },
  },

  async _callPts(kind, innerXml) {
    const op = this.PTS_OPERATIONS[kind];
    if (!this.baseUrl) return { success: false, error: "لم يتم ضبط رابط رصد (apiUrl) بعد" };
    const url = `${this.baseUrl}/${op.service}/${op.service}`;
    const soapAction = `http://dtts.sfda.gov.sa/${op.service}/${op.service}/${op.operation}Request`;
    // ✅ نفس تصحيح _call(): SOAP 1.1 من غير soapenv:Header، الـ auth بالـ Basic Auth بس
    const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <${op.requestElement} xmlns="http://dtts.sfda.gov.sa/${op.service}">${innerXml}</${op.requestElement}>
  </soapenv:Body>
</soapenv:Envelope>`;

    try {
      const basicAuth = (this.username || this.password)
        ? "Basic " + btoa(`${this.username}:${this.password}`)
        : null;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          "SOAPAction": `"${soapAction}"`,
          ...(basicAuth ? { Authorization: basicAuth } : {}),
        },
        body: envelope,
      });
      const text = await res.text();
      const parsed = this._parsePtsResponse(kind, text);
      if (!res.ok || parsed.error) {
        return { success: false, error: parsed.error || `HTTP ${res.status}`, raw: text };
      }
      return { success: true, data: parsed };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  _parsePtsResponse(kind, xmlText) {
    const doc = new DOMParser().parseFromString(xmlText, "text/xml");
    const parserErr = doc.getElementsByTagName("parsererror")[0];
    if (parserErr) return { error: "استجابة غير صالحة من رصد (PTS)" };
    const faultString = doc.getElementsByTagName("faultstring")[0];
    if (faultString) return { error: faultString.textContent };

    if (kind === "upload") {
      return {
        transferId: doc.getElementsByTagName("TRANSFERID")[0]?.textContent || null,
        md5Checksum: doc.getElementsByTagName("MD5CHECKSUM")[0]?.textContent || null,
      };
    }
    if (kind === "download") {
      return {
        fileBase64: doc.getElementsByTagName("FILE")[0]?.textContent || null,
        md5Checksum: doc.getElementsByTagName("MD5CHECKSUM")[0]?.textContent || null,
      };
    }
    // query: TRANSFERDETAILLIST جوّاها مصفوفة TRANSFERDETAIL — كل عنصر بيمثل ملف واحد مرسل ليك
    const transfers = Array.from(doc.getElementsByTagName("TRANSFERDETAIL")).map((t) => ({
      transferId: t.getElementsByTagName("TRANSFERID")[0]?.textContent,
      sender: t.getElementsByTagName("SENDER")[0]?.textContent, // GLN المرسل (13 خانة)
      receiver: t.getElementsByTagName("RECEIVER")[0]?.textContent, // GLN المستقبل (13 خانة)
      sendDate: t.getElementsByTagName("SENDDATE")[0]?.textContent,
      md5Checksum: t.getElementsByTagName("MD5CHECKSUM")[0]?.textContent,
    }));
    return { transfers };
  },

  // رفع ملف zip (Base64، من غير data: prefix) فيه دفعة كبيرة من بيانات المنتجات (GTIN-SN-BN-XD)
  async ptsUpload({ toGln, fileBase64 }) {
    const body = `
      <TOGLN>${toGln}</TOGLN>
      <FILE>${fileBase64}</FILE>`;
    return this._callPts("upload", body);
  },

  // تنزيل ملف اتبعت لك — بياخد transferId من نتيجة ptsQuery
  // مينفعش تنزل ملف مش متبعت ليك أصلاً (حسب الدليل)
  async ptsDownload({ transferId }) {
    const body = `<TRANSFERID>${transferId}</TRANSFERID>`;
    return this._callPts("download", body);
  },

  // استعلام عن الملفات المرسلة لك ولسه ما اتنزلتش (أو كل الملفات لو getAll=true، شاملة اللي اتنزلت قبل كده)
  // fromGln/toGln اختياريين كفلتر إضافي، startDate/endDate لفلترة بالتاريخ
  async ptsQuery({ fromGln, toGln, getAll = false, startDate, endDate } = {}) {
    const body = `
      ${fromGln ? `<FROMGLN>${fromGln}</FROMGLN>` : ""}
      ${toGln ? `<TOGLN>${toGln}</TOGLN>` : ""}
      <GETALL>${getAll ? "true" : "false"}</GETALL>
      ${startDate ? `<STARTDATE>${startDate}</STARTDATE>` : ""}
      ${endDate ? `<ENDDATE>${endDate}</ENDDATE>` : ""}`;
    return this._callPts("query", body);
  },
};



// ==================== RASSD QUEUE (رفع دوري بدل الإرسال الفوري) ====================
// بدل ما نبعت كل عملية لرصد فورًا ونستنى الرد (وممكن يفشل البيع لو النت بطيء أو رصد واقع)
// بنسجل العملية في طابور محلي، وبنرفع كل اللي اتراكم كل فترة (زي أنظمة رصد الحقيقية اللي بترفع كل 10 دقايق)
export const RasdQueue = {
  STORAGE_KEY: "rasd_queue",
  MAX_ATTEMPTS: 30, // بعدها نعتبرها "فشل نهائي" ونسيبها للمراجعة اليدوية بدل ما نحاول للأبد
  timer: null,

  _load() {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  },

  _save(queue) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(queue));
  },

  // type: "sale" | "saleCancel" | "return" | "accept" | "acceptByBatch" | "returnByBatch" | "transferByBatch" | "transferCancelByBatch" | "deactivate"
  enqueue(type, payload) {
    const queue = this._load();
    queue.push({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type,
      payload,
      attempts: 0,
      createdAt: new Date().toISOString(),
      lastError: null,
    });
    this._save(queue);
  },

  pendingCount() {
    return this._load().filter((i) => i.attempts < this.MAX_ATTEMPTS).length;
  },

  failedCount() {
    return this._load().filter((i) => i.attempts >= this.MAX_ATTEMPTS).length;
  },

  clearFailed() {
    const queue = this._load().filter((i) => i.attempts < this.MAX_ATTEMPTS);
    this._save(queue);
  },

  async _sendOne(item) {
    switch (item.type) {
      case "sale":
        return RasdService.notifyPharmacySale(item.payload);
      case "saleCancel":
        return RasdService.notifyPharmacySaleCancel(item.payload);
      case "return":
        return RasdService.notifyReturn(item.payload);
      case "deactivate":
        return RasdService.notifyDeactivate(item.payload);
      default:
        return { success: false, error: "نوع عملية غير معروف: " + item.type };
    }
  },

  async flush(showToast) {
    const rasdConfig = JSON.parse(localStorage.getItem("rasd_config") || "{}");
    if (!rasdConfig.enabled || !rasdConfig.apiUrl) return;
    RasdService.configure(rasdConfig);

    const queue = this._load();
    if (queue.length === 0) return;

    const stillPending = [];
    let successCount = 0;
    let failCount = 0;

    for (const item of queue) {
      if (item.attempts >= this.MAX_ATTEMPTS) {
        stillPending.push(item); // سايبينها كـ "فشل نهائي" بدل حذفها، للمراجعة اليدوية
        continue;
      }
      const result = await this._sendOne(item);
      if (result.success) {
        successCount++;
      } else {
        failCount++;
        item.attempts += 1;
        item.lastError = result.error;
        stillPending.push(item);
      }
    }

    this._save(stillPending);

    if (showToast) {
      if (successCount > 0) showToast(`تم رفع ${successCount} عملية لرصد ✓`);
      if (failCount > 0)
        showToast(`تعذر رفع ${failCount} عملية لرصد — هيتم إعادة المحاولة تلقائيًا`, "error");
    }
  },

  start(showToast) {
    if (this.timer) return; // منع تشغيل أكتر من مؤقت واحد لو الـ effect اتنفذ أكتر من مرة
    const rasdConfig = JSON.parse(localStorage.getItem("rasd_config") || "{}");
    const intervalMin = Number(rasdConfig.uploadIntervalMinutes) || 10;
    this.flush(showToast); // أول تشغيل فورًا عشان ماينتظرش أول فترة كاملة
    this.timer = setInterval(() => this.flush(showToast), intervalMin * 60 * 1000);
  },

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },
};
