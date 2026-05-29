"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
exports.__esModule = true;
var jsx_runtime_1 = require("react/jsx-runtime");
var qrcode_react_1 = require("qrcode.react");
var supabase_js_1 = require("@supabase/supabase-js");
var supabase = (0, supabase_js_1.createClient)("https://glcdvwpwxbhutfecljdj.supabase.co", "sb_publishable_wvhAd7F7h9pwfWRd9g0Xmg_NlNYnNHt");
var react_1 = require("react");
// ==================== STORAGE ====================
var useStorage = function (key, initial) {
    var _a = (0, react_1.useState)(function () {
        try {
            var v = localStorage.getItem(key);
            return v ? JSON.parse(v) : initial;
        }
        catch (_a) {
            return initial;
        }
    }), state = _a[0], setState = _a[1];
    var set = (0, react_1.useCallback)(function (val) {
        setState(function (prev) {
            var next = typeof val === "function" ? val(prev) : val;
            try {
                localStorage.setItem(key, JSON.stringify(next));
            }
            catch (_a) { }
            return next;
        });
    }, [key]);
    return [state, set];
};
// ==================== INITIAL DATA ====================
var INIT_PRODUCTS = [
    {
        id: "P001",
        name: "باراسيتامول 500mg",
        barcode: "6281234567001",
        category: "مسكنات",
        unit: "قرص",
        price: 12,
        cost: 7,
        taxable: false,
        stock: 150,
        minStock: 20,
        supplier: "S001",
        expiry: "2027-06-01",
        activeIngredient: "Paracetamol",
        concentration: "500mg"
    },
    {
        id: "P002",
        name: "أموكسيسيلين 250mg",
        barcode: "6281234567002",
        category: "مضادات حيوية",
        unit: "كبسولة",
        price: 45,
        cost: 28,
        taxable: true,
        stock: 80,
        minStock: 15,
        supplier: "S001",
        expiry: "2026-12-01",
        activeIngredient: "Amoxicillin",
        concentration: "250mg"
    },
    {
        id: "P003",
        name: "أومبيرازول 20mg",
        barcode: "6281234567003",
        category: "جهاز هضمي",
        unit: "كبسولة",
        price: 35,
        cost: 20,
        taxable: true,
        stock: 60,
        minStock: 10,
        supplier: "S002",
        expiry: "2027-03-01",
        activeIngredient: "Omeprazole",
        concentration: "20mg"
    },
    {
        id: "P004",
        name: "ميتفورمين 500mg",
        barcode: "6281234567004",
        category: "سكري",
        unit: "قرص",
        price: 28,
        cost: 16,
        taxable: true,
        stock: 5,
        minStock: 20,
        supplier: "S002",
        expiry: "2027-01-01",
        activeIngredient: "Metformin",
        concentration: "500mg"
    },
    {
        id: "P005",
        name: "فيتامين C 1000mg",
        barcode: "6281234567005",
        category: "فيتامينات",
        unit: "قرص فوار",
        price: 55,
        cost: 32,
        taxable: true,
        stock: 200,
        minStock: 30,
        supplier: "S003",
        expiry: "2027-08-01",
        activeIngredient: "Ascorbic Acid",
        concentration: "1000mg"
    },
];
var INIT_SUPPLIERS = [
    {
        id: "S001",
        name: "شركة الدواء العربية",
        taxId: "300123456700003",
        phone: "0112345678",
        email: "info@arabmed.sa",
        address: "الرياض، حي الملز",
        contact: "أحمد الشمري"
    },
    {
        id: "S002",
        name: "فارما مصر للتوزيع",
        taxId: "300987654300003",
        phone: "0223456789",
        email: "orders@pharmaegy.sa",
        address: "جدة، المنطقة الصناعية",
        contact: "محمد العتيبي"
    },
    {
        id: "S003",
        name: "ناتيورال كير",
        taxId: "311234567890003",
        phone: "0143456789",
        email: "sales@naturalcare.sa",
        address: "الدمام، حي الفيصلية",
        contact: "سارة الزهراني"
    },
];
var INIT_CUSTOMERS = [
    {
        id: "C001",
        name: "أحمد محمد علي",
        phone: "0501234567",
        taxId: "",
        totalSpent: 450,
        visits: 5,
        lastVisit: "2026-05-20"
    },
    {
        id: "C002",
        name: "شركة الرعاية الصحية",
        phone: "0112223344",
        taxId: "310234567890003",
        totalSpent: 8500,
        visits: 25,
        lastVisit: "2026-05-22"
    },
];
var INIT_SALES = [
    {
        id: "INV-0001",
        date: "2026-05-20",
        customer: "C001",
        customerName: "أحمد محمد علي",
        items: [
            {
                id: "P001",
                name: "باراسيتامول 500mg",
                qty: 2,
                price: 12,
                taxable: false,
                dose: "قرص واحد 3 مرات يومياً بعد الأكل"
            },
            {
                id: "P005",
                name: "فيتامين C 1000mg",
                qty: 1,
                price: 55,
                taxable: true,
                dose: "قرص يومياً مع الطعام"
            },
        ],
        subtotal: 79,
        taxAmount: 2.75,
        total: 81.75,
        payment: "نقدي",
        shift: "S-001",
        prescriptionImg: null,
        returned: false
    },
];
var INIT_PURCHASES = [
    {
        id: "PO-0001",
        date: "2026-05-15",
        supplier: "S001",
        supplierName: "شركة الدواء العربية",
        items: [
            {
                id: "P001",
                name: "باراسيتامول 500mg",
                qty: 100,
                cost: 7,
                taxable: false
            },
            {
                id: "P002",
                name: "أموكسيسيلين 250mg",
                qty: 50,
                cost: 28,
                taxable: true
            },
        ],
        subtotal: 2100,
        taxAmount: 210,
        total: 2310,
        status: "مستلمة"
    },
];
var INIT_INVENTORY = [
    {
        id: "INV-ADJ-001",
        date: "2026-05-10",
        type: "جرد",
        items: [
            { id: "P001", systemQty: 150, actualQty: 148, diff: -2 },
            { id: "P002", systemQty: 80, actualQty: 80, diff: 0 },
        ],
        notes: "جرد شهر مايو",
        by: "أحمد الصيدلاني"
    },
];
var INIT_SHIFTS = [
    {
        id: "SH-001",
        user: "أحمد الصيدلاني",
        start: "2026-05-22 08:00",
        end: null,
        openCash: 500,
        closeCash: null,
        sales: 0,
        notes: ""
    },
];
var INIT_USERS = [
    {
        id: "U001",
        name: "مدير النظام",
        role: "admin",
        username: "admin",
        password: "admin123"
    },
    {
        id: "U002",
        name: "أحمد الصيدلاني",
        role: "pharmacist",
        username: "ahmed",
        password: "123456"
    },
];
var CATEGORIES = [
    "مسكنات",
    "مضادات حيوية",
    "جهاز هضمي",
    "سكري",
    "قلب وأوعية",
    "فيتامينات",
    "حساسية",
    "جلدية",
    "عيون",
    "أذن وأنف",
    "تغذية",
    "أخرى",
];
var TAX_RATE = 0.15;
// ==================== ICONS ====================
var IC = function (_a) {
    var n = _a.n, _b = _a.s, s = _b === void 0 ? 18 : _b;
    var m = {
        dashboard: (0, jsx_runtime_1.jsx)("path", { d: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" }, void 0),
        pos: ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("rect", { x: "2", y: "3", width: "20", height: "14", rx: "2" }, void 0), (0, jsx_runtime_1.jsx)("path", { d: "M8 21h8M12 17v4" }, void 0)] }, void 0)),
        inventory: ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("path", { d: "M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" }, void 0), (0, jsx_runtime_1.jsx)("path", { d: "M16 3H8L6 7h12l-2-4z" }, void 0)] }, void 0)),
        purchase: ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("path", { d: "M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" }, void 0), (0, jsx_runtime_1.jsx)("line", { x1: "3", y1: "6", x2: "21", y2: "6" }, void 0), (0, jsx_runtime_1.jsx)("path", { d: "M16 10a4 4 0 01-8 0" }, void 0)] }, void 0)),
        returns: ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("polyline", { points: "1 4 1 10 7 10" }, void 0), (0, jsx_runtime_1.jsx)("path", { d: "M3.51 15a9 9 0 102.13-9.36L1 10" }, void 0)] }, void 0)),
        customers: ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("path", { d: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" }, void 0), (0, jsx_runtime_1.jsx)("circle", { cx: "9", cy: "7", r: "4" }, void 0), (0, jsx_runtime_1.jsx)("path", { d: "M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" }, void 0)] }, void 0)),
        suppliers: ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("rect", { x: "2", y: "7", width: "20", height: "14", rx: "2", ry: "2" }, void 0), (0, jsx_runtime_1.jsx)("path", { d: "M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" }, void 0)] }, void 0)),
        reports: ((0, jsx_runtime_1.jsx)(jsx_runtime_1.Fragment, { children: (0, jsx_runtime_1.jsx)("path", { d: "M18 20V10M12 20V4M6 20v-6" }, void 0) }, void 0)),
        tax: ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("path", { d: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" }, void 0), (0, jsx_runtime_1.jsx)("polyline", { points: "14 2 14 8 20 8" }, void 0), (0, jsx_runtime_1.jsx)("line", { x1: "9", y1: "15", x2: "15", y2: "15" }, void 0)] }, void 0)),
        shift: ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("circle", { cx: "12", cy: "12", r: "10" }, void 0), (0, jsx_runtime_1.jsx)("polyline", { points: "12 6 12 12 16 14" }, void 0)] }, void 0)),
        count: ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("path", { d: "M9 11l3 3L22 4" }, void 0), (0, jsx_runtime_1.jsx)("path", { d: "M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" }, void 0)] }, void 0)),
        logout: ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("path", { d: "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" }, void 0), (0, jsx_runtime_1.jsx)("polyline", { points: "16 17 21 12 16 7" }, void 0), (0, jsx_runtime_1.jsx)("line", { x1: "21", y1: "12", x2: "9", y2: "12" }, void 0)] }, void 0)),
        cart: ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("circle", { cx: "9", cy: "21", r: "1" }, void 0), (0, jsx_runtime_1.jsx)("circle", { cx: "20", cy: "21", r: "1" }, void 0), (0, jsx_runtime_1.jsx)("path", { d: "M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" }, void 0)] }, void 0)),
        trash: ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("polyline", { points: "3 6 5 6 21 6" }, void 0), (0, jsx_runtime_1.jsx)("path", { d: "M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2" }, void 0)] }, void 0)),
        plus: ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("line", { x1: "12", y1: "5", x2: "12", y2: "19" }, void 0), (0, jsx_runtime_1.jsx)("line", { x1: "5", y1: "12", x2: "19", y2: "12" }, void 0)] }, void 0)),
        minus: (0, jsx_runtime_1.jsx)("line", { x1: "5", y1: "12", x2: "19", y2: "12" }, void 0),
        search: ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("circle", { cx: "11", cy: "11", r: "8" }, void 0), (0, jsx_runtime_1.jsx)("line", { x1: "21", y1: "21", x2: "16.65", y2: "16.65" }, void 0)] }, void 0)),
        check: (0, jsx_runtime_1.jsx)("polyline", { points: "20 6 9 17 4 12" }, void 0),
        x: ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("line", { x1: "18", y1: "6", x2: "6", y2: "18" }, void 0), (0, jsx_runtime_1.jsx)("line", { x1: "6", y1: "6", x2: "18", y2: "18" }, void 0)] }, void 0)),
        edit: ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("path", { d: "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" }, void 0), (0, jsx_runtime_1.jsx)("path", { d: "M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" }, void 0)] }, void 0)),
        barcode: ((0, jsx_runtime_1.jsx)(jsx_runtime_1.Fragment, { children: (0, jsx_runtime_1.jsx)("path", { d: "M3 5v14M8 5v14M16 5v14M21 5v14M12 5v5M12 14v5" }, void 0) }, void 0)),
        print: ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("polyline", { points: "6 9 6 2 18 2 18 9" }, void 0), (0, jsx_runtime_1.jsx)("path", { d: "M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" }, void 0), (0, jsx_runtime_1.jsx)("rect", { x: "6", y: "14", width: "12", height: "8" }, void 0)] }, void 0)),
        img: ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2", ry: "2" }, void 0), (0, jsx_runtime_1.jsx)("circle", { cx: "8.5", cy: "8.5", r: "1.5" }, void 0), (0, jsx_runtime_1.jsx)("polyline", { points: "21 15 16 10 5 21" }, void 0)] }, void 0)),
        pill: ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("rect", { x: "2", y: "9", width: "20", height: "6", rx: "3" }, void 0), (0, jsx_runtime_1.jsx)("path", { d: "M12 9v6" }, void 0)] }, void 0)),
        alert: ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("path", { d: "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" }, void 0), (0, jsx_runtime_1.jsx)("line", { x1: "12", y1: "9", x2: "12", y2: "13" }, void 0), (0, jsx_runtime_1.jsx)("line", { x1: "12", y1: "17", x2: "12.01", y2: "17" }, void 0)] }, void 0)),
        money: ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("rect", { x: "2", y: "5", width: "20", height: "14", rx: "2" }, void 0), (0, jsx_runtime_1.jsx)("line", { x1: "2", y1: "10", x2: "22", y2: "10" }, void 0)] }, void 0)),
        user: ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("path", { d: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" }, void 0), (0, jsx_runtime_1.jsx)("circle", { cx: "12", cy: "7", r: "4" }, void 0)] }, void 0)),
        eye: ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("path", { d: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" }, void 0), (0, jsx_runtime_1.jsx)("circle", { cx: "12", cy: "12", r: "3" }, void 0)] }, void 0)),
        download: ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("path", { d: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" }, void 0), (0, jsx_runtime_1.jsx)("polyline", { points: "7 10 12 15 17 10" }, void 0), (0, jsx_runtime_1.jsx)("line", { x1: "12", y1: "15", x2: "12", y2: "3" }, void 0)] }, void 0))
    };
    return ((0, jsx_runtime_1.jsx)("svg", __assign({ width: s, height: s, fill: "none", stroke: "currentColor", strokeWidth: "1.8", viewBox: "0 0 24 24", strokeLinecap: "round", strokeLinejoin: "round" }, { children: m[n] }), void 0));
};
// ==================== UI COMPONENTS ====================
var Modal = function (_a) {
    var open = _a.open, onClose = _a.onClose, title = _a.title, children = _a.children, wide = _a.wide;
    if (!open)
        return null;
    return ((0, jsx_runtime_1.jsx)("div", __assign({ style: {
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(5,10,20,0.8)",
            backdropFilter: "blur(6px)"
        }, onClick: function (e) {
            if (e.target === e.currentTarget)
                onClose();
        } }, { children: (0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                background: "#0f1623",
                border: "1px solid #1d2d4a",
                borderRadius: 18,
                width: wide ? "92vw" : "580px",
                maxWidth: "95vw",
                maxHeight: "90vh",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 30px 80px rgba(0,0,0,0.6)"
            } }, { children: [(0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "18px 24px",
                        borderBottom: "1px solid #1d2d4a",
                        flexShrink: 0
                    } }, { children: [(0, jsx_runtime_1.jsx)("h3", __assign({ style: {
                                margin: 0,
                                color: "#dde8ff",
                                fontSize: 17,
                                fontWeight: 700
                            } }, { children: title }), void 0), (0, jsx_runtime_1.jsx)("button", __assign({ onClick: onClose, style: {
                                background: "#1d2d4a",
                                border: "none",
                                color: "#6a8aaa",
                                cursor: "pointer",
                                padding: 6,
                                borderRadius: 8,
                                display: "flex",
                                alignItems: "center"
                            } }, { children: (0, jsx_runtime_1.jsx)(IC, { n: "x", s: 16 }, void 0) }), void 0)] }), void 0), (0, jsx_runtime_1.jsx)("div", __assign({ style: { overflowY: "auto", padding: 24, flex: 1 } }, { children: children }), void 0)] }), void 0) }), void 0));
};
var Toast = function (_a) {
    var msg = _a.msg, type = _a.type;
    return ((0, jsx_runtime_1.jsx)("div", __assign({ style: {
            position: "fixed",
            top: 20,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            background: type === "error" ? "#3a0a0a" : type === "warn" ? "#3a2a00" : "#0a2a18",
            border: "1px solid " + (type === "error" ? "#7a2020" : type === "warn" ? "#7a5a00" : "#1a6a46"),
            borderRadius: 12,
            padding: "13px 28px",
            color: type === "error" ? "#ff8888" : type === "warn" ? "#ffcc44" : "#44dd88",
            fontSize: 15,
            fontWeight: 700,
            boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
            whiteSpace: "nowrap",
            pointerEvents: "none"
        } }, { children: msg }), void 0));
};
var Btn = function (_a) {
    var children = _a.children, onClick = _a.onClick, _b = _a.variant, variant = _b === void 0 ? "primary" : _b, _c = _a.size, size = _c === void 0 ? "md" : _c, _d = _a.style, style = _d === void 0 ? {} : _d, _e = _a.disabled, disabled = _e === void 0 ? false : _e, icon = _a.icon;
    var bg = {
        primary: "linear-gradient(135deg,#1e4fbf,#1a3d9f)",
        danger: "#3a1010",
        success: "#0a2a18",
        ghost: "transparent",
        secondary: "#1a2540"
    };
    var cl = {
        primary: "#8ab0ff",
        danger: "#ff7777",
        success: "#44dd88",
        ghost: "#6a8aaa",
        secondary: "#8aa0cc"
    };
    var pd = size === "sm" ? "6px 14px" : size === "lg" ? "14px 32px" : "10px 20px";
    return ((0, jsx_runtime_1.jsxs)("button", __assign({ onClick: onClick, disabled: disabled, style: __assign({ display: "inline-flex", alignItems: "center", gap: 7, padding: pd, background: bg[variant], border: "1px solid " + (variant === "ghost"
                ? "#1d2d4a"
                : variant === "danger"
                    ? "#5a2020"
                    : variant === "success"
                        ? "#1a5a30"
                        : "#2a4a8a"), borderRadius: 9, color: cl[variant], fontSize: size === "sm" ? 12 : 14, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, transition: "all 0.15s" }, style) }, { children: [icon && (0, jsx_runtime_1.jsx)(IC, { n: icon, s: size === "sm" ? 13 : 16 }, void 0), children] }), void 0));
};
var Input = function (_a) {
    var label = _a.label, value = _a.value, onChange = _a.onChange, _b = _a.type, type = _b === void 0 ? "text" : _b, placeholder = _a.placeholder, required = _a.required, _c = _a.style, style = _c === void 0 ? {} : _c;
    return ((0, jsx_runtime_1.jsxs)("div", __assign({ style: __assign({ display: "flex", flexDirection: "column", gap: 5 }, style) }, { children: [label && ((0, jsx_runtime_1.jsxs)("label", __assign({ style: { color: "#5a7aaa", fontSize: 12, fontWeight: 600 } }, { children: [label, required && (0, jsx_runtime_1.jsx)("span", __assign({ style: { color: "#ff6666" } }, { children: " *" }), void 0)] }), void 0)), (0, jsx_runtime_1.jsx)("input", { type: type, value: value || "", onChange: function (e) { return onChange(e.target.value); }, placeholder: placeholder, style: {
                    background: "#080e1a",
                    border: "1px solid #1d2d4a",
                    borderRadius: 8,
                    padding: "9px 12px",
                    color: "#dde8ff",
                    fontSize: 14,
                    outline: "none",
                    width: "100%",
                    boxSizing: "border-box"
                } }, void 0)] }), void 0));
};
var Select = function (_a) {
    var label = _a.label, value = _a.value, onChange = _a.onChange, options = _a.options, _b = _a.style, style = _b === void 0 ? {} : _b;
    return ((0, jsx_runtime_1.jsxs)("div", __assign({ style: __assign({ display: "flex", flexDirection: "column", gap: 5 }, style) }, { children: [label && ((0, jsx_runtime_1.jsx)("label", __assign({ style: { color: "#5a7aaa", fontSize: 12, fontWeight: 600 } }, { children: label }), void 0)), (0, jsx_runtime_1.jsx)("select", __assign({ value: value || "", onChange: function (e) { return onChange(e.target.value); }, style: {
                    background: "#080e1a",
                    border: "1px solid #1d2d4a",
                    borderRadius: 8,
                    padding: "9px 12px",
                    color: "#dde8ff",
                    fontSize: 14,
                    outline: "none",
                    width: "100%",
                    boxSizing: "border-box"
                } }, { children: options.map(function (o) { return ((0, jsx_runtime_1.jsx)("option", __assign({ value: o.v || o }, { children: o.l || o }), o.v || o)); }) }), void 0)] }), void 0));
};
var Badge = function (_a) {
    var children = _a.children, _b = _a.color, color = _b === void 0 ? "#1a3a6a" : _b, _c = _a.text, text = _c === void 0 ? "#5a9aff" : _c;
    return ((0, jsx_runtime_1.jsx)("span", __assign({ style: {
            background: color,
            color: text,
            padding: "2px 10px",
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 700,
            whiteSpace: "nowrap"
        } }, { children: children }), void 0));
};
var StatCard = function (_a) {
    var label = _a.label, value = _a.value, icon = _a.icon, color = _a.color, sub = _a.sub;
    return ((0, jsx_runtime_1.jsxs)("div", __assign({ style: {
            background: "#0f1623",
            border: "1px solid #1d2d4a",
            borderRadius: 14,
            padding: "18px 20px",
            display: "flex",
            alignItems: "center",
            gap: 14
        } }, { children: [(0, jsx_runtime_1.jsx)("div", __assign({ style: {
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: color + "22",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: color,
                    flexShrink: 0
                } }, { children: (0, jsx_runtime_1.jsx)(IC, { n: icon, s: 22 }, void 0) }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: { minWidth: 0 } }, { children: [(0, jsx_runtime_1.jsx)("div", __assign({ style: {
                            fontSize: 22,
                            fontWeight: 800,
                            color: "#dde8ff",
                            lineHeight: 1
                        } }, { children: value }), void 0), (0, jsx_runtime_1.jsx)("div", __assign({ style: { color: "#4a6a9a", fontSize: 12, marginTop: 4 } }, { children: label }), void 0), sub && ((0, jsx_runtime_1.jsx)("div", __assign({ style: { color: "#2a8a5a", fontSize: 11, marginTop: 2 } }, { children: sub }), void 0))] }), void 0)] }), void 0));
};
var Table = function (_a) {
    var headers = _a.headers, rows = _a.rows, _b = _a.emptyMsg, emptyMsg = _b === void 0 ? "لا توجد بيانات" : _b;
    return ((0, jsx_runtime_1.jsx)("div", __assign({ style: {
            background: "#0f1623",
            border: "1px solid #1d2d4a",
            borderRadius: 14,
            overflow: "hidden"
        } }, { children: (0, jsx_runtime_1.jsx)("div", __assign({ style: { overflowX: "auto" } }, { children: (0, jsx_runtime_1.jsxs)("table", __assign({ style: { width: "100%", borderCollapse: "collapse", minWidth: 600 } }, { children: [(0, jsx_runtime_1.jsx)("thead", { children: (0, jsx_runtime_1.jsx)("tr", __assign({ style: { background: "#080e1a", borderBottom: "1px solid #1d2d4a" } }, { children: headers.map(function (h, i) { return ((0, jsx_runtime_1.jsx)("th", __assign({ style: {
                                    padding: "11px 16px",
                                    textAlign: "right",
                                    color: "#4a6a9a",
                                    fontSize: 12,
                                    fontWeight: 700,
                                    whiteSpace: "nowrap"
                                } }, { children: h }), i)); }) }), void 0) }, void 0), (0, jsx_runtime_1.jsx)("tbody", { children: rows.length === 0 ? ((0, jsx_runtime_1.jsx)("tr", { children: (0, jsx_runtime_1.jsx)("td", __assign({ colSpan: headers.length, style: {
                                    padding: 40,
                                    textAlign: "center",
                                    color: "#2a3a5a",
                                    fontSize: 14
                                } }, { children: emptyMsg }), void 0) }, void 0)) : (rows.map(function (row, i) { return ((0, jsx_runtime_1.jsx)("tr", __assign({ style: {
                                borderBottom: "1px solid #0a1020",
                                background: i % 2 === 0 ? "transparent" : "#080e16",
                                transition: "background 0.1s"
                            } }, { children: row.map(function (cell, j) { return ((0, jsx_runtime_1.jsx)("td", __assign({ style: {
                                    padding: "11px 16px",
                                    fontSize: 13,
                                    color: "#c0d0f0"
                                } }, { children: cell }), j)); }) }), i)); })) }, void 0)] }), void 0) }), void 0) }), void 0));
};
// ==================== BARCODE SCANNER ====================
var BarcodeScanner = function (_a) {
    var onScan = _a.onScan, _b = _a.placeholder, placeholder = _b === void 0 ? "امسح أو اكتب الباركود..." : _b;
    var _c = (0, react_1.useState)(""), val = _c[0], setVal = _c[1];
    var ref = (0, react_1.useRef)();
    var handleKey = function (e) {
        if (e.key === "Enter" && val.trim()) {
            onScan(val.trim());
            setVal("");
        }
    };
    return ((0, jsx_runtime_1.jsxs)("div", __assign({ style: {
            position: "relative",
            display: "flex",
            gap: 8,
            alignItems: "center"
        } }, { children: [(0, jsx_runtime_1.jsx)(IC, { n: "barcode", s: 18, style: { position: "absolute", right: 10, color: "#3a5aaa" } }, void 0), (0, jsx_runtime_1.jsx)("input", { ref: ref, value: val, onChange: function (e) { return setVal(e.target.value); }, onKeyDown: handleKey, placeholder: placeholder, style: {
                    background: "#080e1a",
                    border: "1px solid #2a5a9a",
                    borderRadius: 8,
                    padding: "9px 12px 9px 40px",
                    color: "#dde8ff",
                    fontSize: 14,
                    outline: "none",
                    width: "100%",
                    boxSizing: "border-box"
                } }, void 0), (0, jsx_runtime_1.jsx)(Btn, __assign({ size: "sm", onClick: function () {
                    if (val.trim()) {
                        onScan(val.trim());
                        setVal("");
                    }
                }, icon: "search" }, { children: "\u0628\u062D\u062B" }), void 0)] }), void 0));
};
// ==================== LOGIN ====================
var Login = function (_a) {
    var users = _a.users, onLogin = _a.onLogin;
    var _b = (0, react_1.useState)(""), u = _b[0], setU = _b[1];
    var _c = (0, react_1.useState)(""), p = _c[0], setP = _c[1];
    var _d = (0, react_1.useState)(""), err = _d[0], setErr = _d[1];
    var go = function () {
        var usr = users.find(function (x) { return x.username === u && x.password === p; });
        if (usr)
            onLogin(usr);
        else
            setErr("اسم المستخدم أو كلمة المرور غير صحيحة");
    };
    return ((0, jsx_runtime_1.jsxs)("div", __assign({ style: {
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#060c16",
            fontFamily: "'Tajawal',sans-serif"
        }, dir: "rtl" }, { children: [(0, jsx_runtime_1.jsx)("link", { href: "https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap", rel: "stylesheet" }, void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                    background: "#0f1623",
                    border: "1px solid #1d2d4a",
                    borderRadius: 20,
                    padding: 40,
                    width: 380,
                    boxShadow: "0 30px 80px rgba(0,0,0,0.6)"
                } }, { children: [(0, jsx_runtime_1.jsxs)("div", __assign({ style: { textAlign: "center", marginBottom: 32 } }, { children: [(0, jsx_runtime_1.jsx)("div", __assign({ style: {
                                    width: 64,
                                    height: 64,
                                    borderRadius: 16,
                                    background: "linear-gradient(135deg,#1e4fbf,#0a2a7f)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    margin: "0 auto 16px",
                                    color: "#8ab0ff"
                                } }, { children: (0, jsx_runtime_1.jsx)(IC, { n: "pill", s: 32 }, void 0) }), void 0), (0, jsx_runtime_1.jsx)("h1", __assign({ style: {
                                    margin: 0,
                                    fontSize: 24,
                                    fontWeight: 900,
                                    color: "#dde8ff"
                                } }, { children: "\u0635\u064A\u062F\u0644\u064A\u0629 \u0628\u0631\u0648" }), void 0), (0, jsx_runtime_1.jsx)("p", __assign({ style: { margin: "6px 0 0", color: "#3a5a8a", fontSize: 13 } }, { children: "\u0646\u0638\u0627\u0645 \u0625\u062F\u0627\u0631\u0629 \u0635\u064A\u062F\u0644\u064A\u0629 \u0645\u062A\u0643\u0627\u0645\u0644" }), void 0)] }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: { display: "flex", flexDirection: "column", gap: 14 } }, { children: [(0, jsx_runtime_1.jsx)(Input, { label: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645", value: u, onChange: setU, placeholder: "\u0623\u062F\u062E\u0644 \u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645" }, void 0), (0, jsx_runtime_1.jsx)(Input, { label: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631", value: p, onChange: setP, type: "password", placeholder: "\u0623\u062F\u062E\u0644 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631" }, void 0), err && ((0, jsx_runtime_1.jsx)("div", __assign({ style: { color: "#ff7777", fontSize: 13, textAlign: "center" } }, { children: err }), void 0)), (0, jsx_runtime_1.jsx)(Btn, __assign({ size: "lg", onClick: go, style: { marginTop: 4, justifyContent: "center" } }, { children: "\u062F\u062E\u0648\u0644 \u0627\u0644\u0646\u0638\u0627\u0645" }), void 0)] }), void 0), (0, jsx_runtime_1.jsx)("p", __assign({ style: {
                            textAlign: "center",
                            color: "#2a4a6a",
                            fontSize: 11,
                            marginTop: 20
                        } }, { children: "admin/admin123 \u2014 ahmed/123456" }), void 0)] }), void 0)] }), void 0));
};
// ==================== MAIN APP ====================
function PharmacyPro() {
    var _this = this;
    var _a = useStorage("ph_products", INIT_PRODUCTS), products = _a[0], setProducts = _a[1];
    var _b = useStorage("ph_suppliers", INIT_SUPPLIERS), suppliers = _b[0], setSuppliers = _b[1];
    var _c = useStorage("ph_customers", INIT_CUSTOMERS), customers = _c[0], setCustomers = _c[1];
    var _d = useStorage("ph_sales", INIT_SALES), sales = _d[0], setSales = _d[1];
    var _e = useStorage("ph_purchases", INIT_PURCHASES), purchases = _e[0], setPurchases = _e[1];
    var _f = useStorage("ph_inventory", INIT_INVENTORY), inventoryLogs = _f[0], setInventoryLogs = _f[1];
    var _g = useStorage("ph_shifts", INIT_SHIFTS), shifts = _g[0], setShifts = _g[1];
    var users = useStorage("ph_users", INIT_USERS)[0];
    var _h = (0, react_1.useState)(null), currentUser = _h[0], setCurrentUser = _h[1];
    var _j = (0, react_1.useState)("dashboard"), tab = _j[0], setTab = _j[1];
    var _k = (0, react_1.useState)(null), toast = _k[0], setToast = _k[1];
    var showToast = (0, react_1.useCallback)(function (msg, type) {
        if (type === void 0) { type = "success"; }
        setToast({ msg: msg, type: type });
        setTimeout(function () { return setToast(null); }, 3000);
    }, []);
    var currentShift = shifts.find(function (s) { return !s.end && s.user === (currentUser === null || currentUser === void 0 ? void 0 : currentUser.name); });
    (0, react_1.useEffect)(function () {
        var loadData = function () { return __awaiter(_this, void 0, void 0, function () {
            var _a, p, s, c, sa, pu;
            var _b, _c, _d, _e, _f;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0: return [4 /*yield*/, Promise.all([
                            supabase.from("products").select("*"),
                            supabase.from("suppliers").select("*"),
                            supabase.from("customers").select("*"),
                            supabase.from("sales").select("*"),
                            supabase.from("purchases").select("*"),
                        ])];
                    case 1:
                        _a = _g.sent(), p = _a[0], s = _a[1], c = _a[2], sa = _a[3], pu = _a[4];
                        if ((_b = p.data) === null || _b === void 0 ? void 0 : _b.length)
                            setProducts(p.data);
                        if ((_c = s.data) === null || _c === void 0 ? void 0 : _c.length)
                            setSuppliers(s.data);
                        if ((_d = c.data) === null || _d === void 0 ? void 0 : _d.length)
                            setCustomers(c.data);
                        if ((_e = sa.data) === null || _e === void 0 ? void 0 : _e.length)
                            setSales(sa.data);
                        if ((_f = pu.data) === null || _f === void 0 ? void 0 : _f.length)
                            setPurchases(pu.data);
                        return [2 /*return*/];
                }
            });
        }); };
        loadData();
    }, []);
    if (!currentUser)
        return ((0, jsx_runtime_1.jsx)(Login, { users: users, onLogin: function (u) {
                setCurrentUser(u);
                setTab("dashboard");
            } }, void 0));
    var TABS = [
        { id: "dashboard", label: "الرئيسية", icon: "dashboard" },
        { id: "pos", label: "نقطة البيع", icon: "pos" },
        { id: "purchase", label: "فواتير الشراء", icon: "purchase" },
        { id: "returns", label: "المرتجعات", icon: "returns" },
        { id: "inventory_count", label: "الجرد", icon: "count" },
        { id: "products", label: "الأصناف", icon: "inventory" },
        { id: "suppliers", label: "الموردون", icon: "suppliers" },
        { id: "customers", label: "العملاء", icon: "customers" },
        { id: "reports", label: "التقارير", icon: "reports" },
        { id: "tax_report", label: "تقرير ضريبي", icon: "tax" },
        { id: "shift", label: "الشفتات", icon: "shift" },
    ];
    return ((0, jsx_runtime_1.jsxs)("div", __assign({ dir: "rtl", style: {
            fontFamily: "'Tajawal',sans-serif",
            background: "#060c16",
            minHeight: "100vh",
            color: "#dde8ff",
            display: "flex"
        } }, { children: [(0, jsx_runtime_1.jsx)("link", { href: "https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap", rel: "stylesheet" }, void 0), toast && (0, jsx_runtime_1.jsx)(Toast, __assign({}, toast), void 0), (0, jsx_runtime_1.jsxs)("nav", __assign({ style: {
                    width: 210,
                    background: "#0a0f1c",
                    borderLeft: "1px solid #141e30",
                    flexShrink: 0,
                    display: "flex",
                    flexDirection: "column",
                    position: "sticky",
                    top: 0,
                    height: "100vh",
                    overflowY: "auto"
                } }, { children: [(0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                            padding: "20px 16px 16px",
                            borderBottom: "1px solid #141e30"
                        } }, { children: [(0, jsx_runtime_1.jsxs)("div", __assign({ style: { display: "flex", alignItems: "center", gap: 10 } }, { children: [(0, jsx_runtime_1.jsx)("div", __assign({ style: {
                                            width: 36,
                                            height: 36,
                                            borderRadius: 10,
                                            background: "linear-gradient(135deg,#1e4fbf,#0a2a7f)",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            color: "#8ab0ff",
                                            flexShrink: 0
                                        } }, { children: (0, jsx_runtime_1.jsx)(IC, { n: "pill", s: 18 }, void 0) }), void 0), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", __assign({ style: {
                                                    fontSize: 14,
                                                    fontWeight: 800,
                                                    color: "#dde8ff",
                                                    lineHeight: 1.2
                                                } }, { children: "\u0635\u064A\u062F\u0644\u064A\u0629 \u0628\u0631\u0648" }), void 0), (0, jsx_runtime_1.jsx)("div", __assign({ style: { fontSize: 10, color: "#2a5a8a" } }, { children: "\u0646\u0638\u0627\u0645 \u0645\u062A\u0643\u0627\u0645\u0644" }), void 0)] }, void 0)] }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                                    marginTop: 12,
                                    padding: "8px 10px",
                                    background: "#0d1520",
                                    borderRadius: 8,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8
                                } }, { children: [(0, jsx_runtime_1.jsx)(IC, { n: "user", s: 14 }, void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: { minWidth: 0 } }, { children: [(0, jsx_runtime_1.jsx)("div", __assign({ style: {
                                                    fontSize: 12,
                                                    fontWeight: 700,
                                                    color: "#8aa0cc",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap"
                                                } }, { children: currentUser.name }), void 0), (0, jsx_runtime_1.jsx)("div", __assign({ style: { fontSize: 10, color: "#2a4a6a" } }, { children: currentUser.role === "admin" ? "مدير" : "صيدلاني" }), void 0)] }), void 0)] }), void 0)] }), void 0), (0, jsx_runtime_1.jsx)("div", __assign({ style: { flex: 1, padding: "8px 0" } }, { children: TABS.map(function (t) { return ((0, jsx_runtime_1.jsxs)("button", __assign({ onClick: function () { return setTab(t.id); }, style: {
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                padding: "10px 16px",
                                width: "100%",
                                background: tab === t.id ? "#14233a" : "transparent",
                                borderRight: tab === t.id ? "3px solid #2a6aef" : "3px solid transparent",
                                border: "none",
                                color: tab === t.id ? "#6aaeff" : "#4a6a8a",
                                fontSize: 13,
                                fontWeight: tab === t.id ? 700 : 400,
                                cursor: "pointer",
                                textAlign: "right",
                                transition: "all 0.12s"
                            } }, { children: [(0, jsx_runtime_1.jsx)(IC, { n: t.icon, s: 16 }, void 0), t.label] }), t.id)); }) }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: { padding: "12px 16px", borderTop: "1px solid #141e30" } }, { children: [currentShift ? ((0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                                    background: "#0a2010",
                                    border: "1px solid #1a5020",
                                    borderRadius: 8,
                                    padding: "8px 10px",
                                    marginBottom: 10,
                                    color: "#44aa66",
                                    fontSize: 11
                                } }, { children: [(0, jsx_runtime_1.jsx)("div", __assign({ style: { fontWeight: 700 } }, { children: "\u0634\u0641\u062A \u0645\u0641\u062A\u0648\u062D" }), void 0), (0, jsx_runtime_1.jsx)("div", __assign({ style: { color: "#2a7a46" } }, { children: currentShift.start }), void 0)] }), void 0)) : ((0, jsx_runtime_1.jsx)("div", __assign({ style: {
                                    background: "#1a0a00",
                                    border: "1px solid #4a2a00",
                                    borderRadius: 8,
                                    padding: "8px 10px",
                                    marginBottom: 10,
                                    color: "#ffaa44",
                                    fontSize: 11
                                } }, { children: "\u0644\u0627 \u064A\u0648\u062C\u062F \u0634\u0641\u062A \u0645\u0641\u062A\u0648\u062D" }), void 0)), (0, jsx_runtime_1.jsxs)("button", __assign({ onClick: function () {
                                    setCurrentUser(null);
                                    setTab("dashboard");
                                }, style: {
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    width: "100%",
                                    padding: "9px 10px",
                                    background: "#1a0a0a",
                                    border: "1px solid #3a1010",
                                    borderRadius: 8,
                                    color: "#aa4444",
                                    fontSize: 13,
                                    fontWeight: 600,
                                    cursor: "pointer"
                                } }, { children: [(0, jsx_runtime_1.jsx)(IC, { n: "logout", s: 15 }, void 0), "\u062E\u0631\u0648\u062C"] }), void 0)] }), void 0)] }), void 0), (0, jsx_runtime_1.jsxs)("main", __assign({ style: { flex: 1, overflow: "auto", padding: 24, minHeight: "100vh" } }, { children: [tab === "dashboard" && ((0, jsx_runtime_1.jsx)(Dashboard, { products: products, sales: sales, purchases: purchases, customers: customers, shifts: shifts, currentUser: currentUser, setTab: setTab }, void 0)), tab === "pos" && ((0, jsx_runtime_1.jsx)(POS, { products: products, setProducts: setProducts, customers: customers, sales: sales, setSales: setSales, shifts: shifts, setShifts: setShifts, currentUser: currentUser, currentShift: currentShift, showToast: showToast }, void 0)), tab === "purchase" && ((0, jsx_runtime_1.jsx)(PurchaseModule, { products: products, setProducts: setProducts, suppliers: suppliers, purchases: purchases, setPurchases: setPurchases, showToast: showToast }, void 0)), tab === "returns" && ((0, jsx_runtime_1.jsx)(ReturnsModule, { products: products, setProducts: setProducts, sales: sales, setSales: setSales, purchases: purchases, setPurchases: setPurchases, showToast: showToast }, void 0)), tab === "inventory_count" && ((0, jsx_runtime_1.jsx)(InventoryCount, { products: products, setProducts: setProducts, inventoryLogs: inventoryLogs, setInventoryLogs: setInventoryLogs, currentUser: currentUser, showToast: showToast }, void 0)), tab === "products" && ((0, jsx_runtime_1.jsx)(ProductsModule, { products: products, setProducts: setProducts, suppliers: suppliers, showToast: showToast }, void 0)), tab === "suppliers" && ((0, jsx_runtime_1.jsx)(SuppliersModule, { suppliers: suppliers, setSuppliers: setSuppliers, showToast: showToast }, void 0)), tab === "customers" && ((0, jsx_runtime_1.jsx)(CustomersModule, { customers: customers, setCustomers: setCustomers, showToast: showToast }, void 0)), tab === "reports" && ((0, jsx_runtime_1.jsx)(Reports, { sales: sales, purchases: purchases, products: products, suppliers: suppliers, customers: customers }, void 0)), tab === "tax_report" && ((0, jsx_runtime_1.jsx)(TaxReport, { sales: sales, purchases: purchases }, void 0)), tab === "shift" && ((0, jsx_runtime_1.jsx)(ShiftModule, { shifts: shifts, setShifts: setShifts, sales: sales, currentUser: currentUser, showToast: showToast }, void 0))] }), void 0)] }), void 0));
}
exports["default"] = PharmacyPro;
// ==================== DASHBOARD ====================
function Dashboard(_a) {
    var products = _a.products, sales = _a.sales, purchases = _a.purchases, customers = _a.customers, shifts = _a.shifts, currentUser = _a.currentUser, setTab = _a.setTab;
    var today = new Date().toISOString().split("T")[0];
    var todaySales = sales.filter(function (s) { return s.date === today && !s.returned; });
    var todayRev = todaySales.reduce(function (a, s) { return a + s.total; }, 0);
    var lowStock = products.filter(function (p) { return p.stock <= p.minStock; });
    var expiringSoon = products.filter(function (p) {
        var d = new Date(p.expiry);
        var now = new Date();
        return (d - now) / (1000 * 60 * 60 * 24) < 90 && d > now;
    });
    var monthSales = sales.filter(function (s) { return s.date && s.date.startsWith(today.substring(0, 7)) && !s.returned; });
    var monthRev = monthSales.reduce(function (a, s) { return a + s.total; }, 0);
    return ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 22
                } }, { children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h1", __assign({ style: {
                                    margin: 0,
                                    fontSize: 22,
                                    fontWeight: 900,
                                    color: "#dde8ff"
                                } }, { children: "\u0644\u0648\u062D\u0629 \u0627\u0644\u062A\u062D\u0643\u0645" }), void 0), (0, jsx_runtime_1.jsx)("p", __assign({ style: { margin: "4px 0 0", color: "#3a5a8a", fontSize: 13 } }, { children: new Date().toLocaleDateString("ar-SA", {
                                    weekday: "long",
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric"
                                }) }), void 0)] }, void 0), (0, jsx_runtime_1.jsx)(Btn, __assign({ onClick: function () { return setTab("pos"); }, icon: "pos", size: "lg" }, { children: "\u0646\u0642\u0637\u0629 \u0627\u0644\u0628\u064A\u0639" }), void 0)] }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                    display: "grid",
                    gridTemplateColumns: "repeat(4,1fr)",
                    gap: 14,
                    marginBottom: 20
                } }, { children: [(0, jsx_runtime_1.jsx)(StatCard, { label: "\u0645\u0628\u064A\u0639\u0627\u062A \u0627\u0644\u064A\u0648\u0645", value: todayRev.toFixed(2) + " ر.س", icon: "money", color: "#3a9aff", sub: todaySales.length + " \u0641\u0627\u062A\u0648\u0631\u0629" }, void 0), (0, jsx_runtime_1.jsx)(StatCard, { label: "\u0645\u0628\u064A\u0639\u0627\u062A \u0627\u0644\u0634\u0647\u0631", value: monthRev.toFixed(2) + " ر.س", icon: "reports", color: "#44dd88", sub: monthSales.length + " \u0641\u0627\u062A\u0648\u0631\u0629" }, void 0), (0, jsx_runtime_1.jsx)(StatCard, { label: "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0623\u0635\u0646\u0627\u0641", value: products.length, icon: "inventory", color: "#a78bfa" }, void 0), (0, jsx_runtime_1.jsx)(StatCard, { label: "\u0627\u0644\u0639\u0645\u0644\u0627\u0621 \u0627\u0644\u0645\u0633\u062C\u0644\u0648\u0646", value: customers.length, icon: "customers", color: "#fb923c" }, void 0)] }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 } }, { children: [lowStock.length > 0 && ((0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                            background: "#0f1623",
                            border: "1px solid #3a2000",
                            borderRadius: 14,
                            padding: 18
                        } }, { children: [(0, jsx_runtime_1.jsxs)("h3", __assign({ style: {
                                    margin: "0 0 14px",
                                    fontSize: 14,
                                    fontWeight: 700,
                                    color: "#ffaa44",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8
                                } }, { children: [(0, jsx_runtime_1.jsx)(IC, { n: "alert", s: 16 }, void 0), "\u0645\u062E\u0632\u0648\u0646 \u0645\u0646\u062E\u0641\u0636 (", lowStock.length, " \u0635\u0646\u0641)"] }), void 0), lowStock.map(function (p) { return ((0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: "8px 0",
                                    borderBottom: "1px solid #111a20"
                                } }, { children: [(0, jsx_runtime_1.jsx)("span", __assign({ style: { fontSize: 13, color: "#c0d0f0" } }, { children: p.name }), void 0), (0, jsx_runtime_1.jsxs)(Badge, __assign({ color: "#3a1500", text: "#ffaa44" }, { children: [p.stock, " / ", p.minStock] }), void 0)] }), p.id)); })] }), void 0)), expiringSoon.length > 0 && ((0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                            background: "#0f1623",
                            border: "1px solid #3a1000",
                            borderRadius: 14,
                            padding: 18
                        } }, { children: [(0, jsx_runtime_1.jsxs)("h3", __assign({ style: {
                                    margin: "0 0 14px",
                                    fontSize: 14,
                                    fontWeight: 700,
                                    color: "#ff7744",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8
                                } }, { children: [(0, jsx_runtime_1.jsx)(IC, { n: "alert", s: 16 }, void 0), "\u062A\u0646\u062A\u0647\u064A \u0642\u0631\u064A\u0628\u0627\u064B (", expiringSoon.length, " \u0635\u0646\u0641)"] }), void 0), expiringSoon.map(function (p) { return ((0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: "8px 0",
                                    borderBottom: "1px solid #111a20"
                                } }, { children: [(0, jsx_runtime_1.jsx)("span", __assign({ style: { fontSize: 13, color: "#c0d0f0" } }, { children: p.name }), void 0), (0, jsx_runtime_1.jsx)(Badge, __assign({ color: "#3a1000", text: "#ff7744" }, { children: p.expiry }), void 0)] }), p.id)); })] }), void 0)), (0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                            background: "#0f1623",
                            border: "1px solid #1d2d4a",
                            borderRadius: 14,
                            padding: 18
                        } }, { children: [(0, jsx_runtime_1.jsx)("h3", __assign({ style: {
                                    margin: "0 0 14px",
                                    fontSize: 14,
                                    fontWeight: 700,
                                    color: "#dde8ff"
                                } }, { children: "\u0622\u062E\u0631 \u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A" }), void 0), sales
                                .slice(-5)
                                .reverse()
                                .map(function (s) { return ((0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: "8px 0",
                                    borderBottom: "1px solid #111a20"
                                } }, { children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", __assign({ style: { fontSize: 13, color: "#c0d0f0" } }, { children: s.id }), void 0), (0, jsx_runtime_1.jsx)("div", __assign({ style: { fontSize: 11, color: "#3a5a8a" } }, { children: s.customerName || "زبون عادي" }), void 0)] }, void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: { textAlign: "left" } }, { children: [(0, jsx_runtime_1.jsxs)("div", __assign({ style: { fontSize: 13, fontWeight: 700, color: "#3a9aff" } }, { children: [s.total.toFixed(2), " \u0631.\u0633"] }), void 0), (0, jsx_runtime_1.jsx)("div", __assign({ style: { fontSize: 11, color: "#3a5a8a" } }, { children: s.date }), void 0)] }), void 0)] }), s.id)); })] }), void 0)] }), void 0)] }, void 0));
}
// ==================== POS ====================
function POS(_a) {
    var _this = this;
    var products = _a.products, setProducts = _a.setProducts, customers = _a.customers, sales = _a.sales, setSales = _a.setSales, shifts = _a.shifts, setShifts = _a.setShifts, currentUser = _a.currentUser, currentShift = _a.currentShift, showToast = _a.showToast;
    var _b = (0, react_1.useState)([]), cart = _b[0], setCart = _b[1];
    var _c = (0, react_1.useState)(null), selCustomer = _c[0], setSelCustomer = _c[1];
    var _d = (0, react_1.useState)("نقدي"), payment = _d[0], setPayment = _d[1];
    var _e = (0, react_1.useState)(0), discount = _e[0], setDiscount = _e[1];
    var _f = (0, react_1.useState)(null), prescriptionImg = _f[0], setPrescriptionImg = _f[1];
    var _g = (0, react_1.useState)(""), search = _g[0], setSearch = _g[1];
    var _h = (0, react_1.useState)("الكل"), catFilter = _h[0], setCatFilter = _h[1];
    var _j = (0, react_1.useState)(false), success = _j[0], setSuccess = _j[1];
    var _k = (0, react_1.useState)(null), showPrint = _k[0], setShowPrint = _k[1];
    var fileRef = (0, react_1.useRef)();
    var filtered = products.filter(function (p) {
        return (catFilter === "الكل" || p.category === catFilter) &&
            (p.name.includes(search) ||
                p.barcode.includes(search) ||
                p.id.includes(search));
    });
    var addToCart = function (p) {
        if (p.stock <= 0) {
            showToast("المخزون نفد!", "error");
            return;
        }
        setCart(function (prev) {
            var ex = prev.find(function (i) { return i.id === p.id; });
            if (ex) {
                if (ex.qty >= p.stock) {
                    showToast("لا يوجد مخزون كافٍ", "error");
                    return prev;
                }
                return prev.map(function (i) { return (i.id === p.id ? __assign(__assign({}, i), { qty: i.qty + 1 }) : i); });
            }
            return __spreadArray(__spreadArray([], prev, true), [__assign(__assign({}, p), { qty: 1, dose: "" })], false);
        });
    };
    var scanBarcode = function (code) {
        var p = products.find(function (x) { return x.barcode === code || x.id === code; });
        if (p)
            addToCart(p);
        else
            showToast("الصنف غير موجود: " + code, "error");
    };
    var subtotal = cart.reduce(function (s, i) { return s + i.price * i.qty; }, 0);
    var taxAmount = cart.reduce(function (s, i) { return (i.taxable ? s + i.price * i.qty * TAX_RATE : s); }, 0);
    var discountAmt = Math.round((((subtotal + taxAmount) * discount) / 100) * 100) / 100;
    var total = subtotal + taxAmount - discountAmt;
    var completeSale = function () { return __awaiter(_this, void 0, void 0, function () {
        var id, inv, _loop_1, _i, cart_1, ci;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!currentShift) {
                        showToast("يرجى فتح شفت أولاً", "error");
                        return [2 /*return*/];
                    }
                    if (cart.length === 0) {
                        showToast("السلة فارغة!", "error");
                        return [2 /*return*/];
                    }
                    id = "INV-" + String(sales.length + 1).padStart(4, "0");
                    inv = {
                        id: id,
                        date: new Date().toISOString().split("T")[0],
                        customer: (selCustomer === null || selCustomer === void 0 ? void 0 : selCustomer.id) || null,
                        customer_name: (selCustomer === null || selCustomer === void 0 ? void 0 : selCustomer.name) || "زبون عادي",
                        items: cart.map(function (i) { return ({
                            id: i.id,
                            name: i.name,
                            qty: i.qty,
                            price: i.price,
                            taxable: i.taxable,
                            dose: i.dose
                        }); }),
                        subtotal: subtotal,
                        tax_amount: taxAmount,
                        discount_amt: discountAmt,
                        total: total,
                        payment: payment,
                        shift: currentShift === null || currentShift === void 0 ? void 0 : currentShift.id,
                        returned: false
                    };
                    return [4 /*yield*/, supabase.from("sales").insert(inv)];
                case 1:
                    _a.sent();
                    _loop_1 = function (ci) {
                        var prod;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    prod = products.find(function (x) { return x.id === ci.id; });
                                    if (!prod) return [3 /*break*/, 2];
                                    return [4 /*yield*/, supabase
                                            .from("products")
                                            .update({ stock: prod.stock - ci.qty })
                                            .eq("id", ci.id)];
                                case 1:
                                    _b.sent();
                                    _b.label = 2;
                                case 2: return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, cart_1 = cart;
                    _a.label = 2;
                case 2:
                    if (!(_i < cart_1.length)) return [3 /*break*/, 5];
                    ci = cart_1[_i];
                    return [5 /*yield**/, _loop_1(ci)];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5:
                    setSales(function (p) { return __spreadArray(__spreadArray([], p, true), [inv], false); });
                    setProducts(function (p) {
                        return p.map(function (x) {
                            var ci = cart.find(function (i) { return i.id === x.id; });
                            return ci ? __assign(__assign({}, x), { stock: x.stock - ci.qty }) : x;
                        });
                    });
                    setCart([]);
                    setDiscount(0);
                    setPrescriptionImg(null);
                    setSelCustomer(null);
                    setSuccess(true);
                    setTimeout(function () { return setSuccess(false); }, 2000);
                    setShowPrint(inv);
                    showToast("تمت عملية البيع ✓");
                    return [2 /*return*/];
            }
        });
    }); };
    var uploadPrescription = function (e) {
        var file = e.target.files[0];
        if (!file)
            return;
        var r = new FileReader();
        r.onload = function (ev) { return setPrescriptionImg(ev.target.result); };
        r.readAsDataURL(file);
    };
    var CATS = __spreadArray(["الكل"], new Set(products.map(function (p) { return p.category; })), true);
    return ((0, jsx_runtime_1.jsxs)("div", __assign({ style: {
            height: "calc(100vh - 100px)",
            display: "flex",
            flexDirection: "column",
            gap: 12
        } }, { children: [(0, jsx_runtime_1.jsx)("h2", __assign({ style: { margin: 0, fontSize: 20, fontWeight: 800 } }, { children: "\u0646\u0642\u0637\u0629 \u0627\u0644\u0628\u064A\u0639" }), void 0), !currentShift && ((0, jsx_runtime_1.jsx)("div", __assign({ style: {
                    background: "#3a1500",
                    border: "1px solid #7a3000",
                    borderRadius: 10,
                    padding: "12px 16px",
                    color: "#ffaa44",
                    fontSize: 14,
                    fontWeight: 600
                } }, { children: "\u26A0 \u064A\u0631\u062C\u0649 \u0641\u062A\u062D \u0634\u0641\u062A \u0645\u0646 \u0642\u0633\u0645 \u0627\u0644\u0634\u0641\u062A\u0627\u062A \u0642\u0628\u0644 \u0627\u0644\u0628\u064A\u0639" }), void 0)), (0, jsx_runtime_1.jsx)("div", __assign({ style: {
                    display: "grid",
                    gridTemplateColumns: "1fr",
                    gap: 16,
                    flex: 1,
                    overflow: "hidden"
                } }, { children: (0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                        background: "#0f1623",
                        border: "1px solid #1d2d4a",
                        borderRadius: 16,
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden"
                    } }, { children: [(0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                                padding: "12px 16px",
                                borderBottom: "1px solid #1d2d4a",
                                display: "flex",
                                flexDirection: "column",
                                gap: 8
                            } }, { children: [(0, jsx_runtime_1.jsx)(BarcodeScanner, { onScan: scanBarcode, placeholder: "\u0627\u0645\u0633\u062D \u0628\u0627\u0631\u0643\u0648\u062F \u0627\u0644\u0635\u0646\u0641 (Barcode/QR)..." }, void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: { position: "relative" } }, { children: [(0, jsx_runtime_1.jsx)("input", { value: search, onChange: function (e) { return setSearch(e.target.value); }, placeholder: "\uD83D\uDD0D \u0627\u0628\u062D\u062B \u0639\u0646 \u0635\u0646\u0641 \u0628\u0627\u0644\u0627\u0633\u0645 \u0623\u0648 \u0627\u0644\u0628\u0627\u0631\u0643\u0648\u062F...", style: {
                                                width: "100%",
                                                background: "#080e1a",
                                                border: "1px solid #1d2d4a",
                                                borderRadius: 8,
                                                padding: "9px 14px",
                                                color: "#dde8ff",
                                                fontSize: 14,
                                                outline: "none",
                                                boxSizing: "border-box"
                                            } }, void 0), search && ((0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                                                position: "absolute",
                                                top: "100%",
                                                right: 0,
                                                left: 0,
                                                background: "#0f1623",
                                                border: "1px solid #1d2d4a",
                                                borderRadius: 8,
                                                zIndex: 100,
                                                maxHeight: 200,
                                                overflowY: "auto",
                                                marginTop: 4
                                            } }, { children: [filtered.slice(0, 8).map(function (p) { return ((0, jsx_runtime_1.jsxs)("div", __assign({ onClick: function () {
                                                        addToCart(p);
                                                        setSearch("");
                                                    }, style: {
                                                        padding: "8px 14px",
                                                        cursor: p.stock === 0 ? "not-allowed" : "pointer",
                                                        opacity: p.stock === 0 ? 0.5 : 1,
                                                        borderBottom: "1px solid #1a2a3a",
                                                        display: "flex",
                                                        justifyContent: "space-between",
                                                        alignItems: "center"
                                                    }, onMouseEnter: function (e) {
                                                        return (e.currentTarget.style.background = "#1a2a3a");
                                                    }, onMouseLeave: function (e) {
                                                        return (e.currentTarget.style.background = "transparent");
                                                    } }, { children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", __assign({ style: {
                                                                        fontSize: 13,
                                                                        fontWeight: 700,
                                                                        color: "#dde8ff"
                                                                    } }, { children: p.name }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: { fontSize: 11, color: "#4a6a8a" } }, { children: [p.category, " | \u0645\u062E\u0632\u0648\u0646: ", p.stock] }), void 0)] }, void 0), (0, jsx_runtime_1.jsxs)("span", __assign({ style: { color: "#2a9aff", fontWeight: 700 } }, { children: [p.price, " \u0631.\u0633"] }), void 0)] }), p.id)); }), filtered.length === 0 && ((0, jsx_runtime_1.jsx)("div", __assign({ style: {
                                                        padding: 12,
                                                        color: "#4a6a8a",
                                                        textAlign: "center"
                                                    } }, { children: "\u0644\u0627 \u064A\u0648\u062C\u062F \u0646\u062A\u0627\u0626\u062C" }), void 0))] }), void 0))] }), void 0)] }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                                padding: "8px 16px",
                                borderBottom: "1px solid #1d2d4a",
                                display: "flex",
                                gap: 8
                            } }, { children: [(0, jsx_runtime_1.jsxs)("select", __assign({ value: (selCustomer === null || selCustomer === void 0 ? void 0 : selCustomer.id) || "", onChange: function (e) {
                                        return setSelCustomer(customers.find(function (c) { return c.id === e.target.value; }) || null);
                                    }, style: {
                                        flex: 1,
                                        background: "#080e1a",
                                        border: "1px solid #1d2d4a",
                                        borderRadius: 8,
                                        padding: "7px 10px",
                                        color: "#dde8ff",
                                        fontSize: 13,
                                        outline: "none"
                                    } }, { children: [(0, jsx_runtime_1.jsx)("option", __assign({ value: "" }, { children: "\u0632\u0628\u0648\u0646 \u0639\u0627\u062F\u064A" }), void 0), customers.map(function (c) { return ((0, jsx_runtime_1.jsxs)("option", __assign({ value: c.id }, { children: [c.name, c.taxId ? " \u2014 " + c.taxId : ""] }), c.id)); })] }), void 0), (0, jsx_runtime_1.jsx)("button", __assign({ onClick: function () { return fileRef.current.click(); }, style: {
                                        padding: "7px 12px",
                                        background: "#0a1a2a",
                                        border: "1px dashed #1d3a5a",
                                        borderRadius: 8,
                                        color: prescriptionImg ? "#44dd88" : "#4a6a8a",
                                        cursor: "pointer",
                                        fontSize: 12
                                    } }, { children: prescriptionImg ? "✓ وصفة" : "📎 وصفة" }), void 0), (0, jsx_runtime_1.jsx)("input", { ref: fileRef, type: "file", accept: "image/*", style: { display: "none" }, onChange: uploadPrescription }, void 0)] }), void 0), (0, jsx_runtime_1.jsx)("div", __assign({ style: { flex: 1, overflowY: "auto", padding: "6px 16px" } }, { children: cart.length === 0 ? ((0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                                    textAlign: "center",
                                    color: "#1a2a4a",
                                    padding: "60px 0",
                                    fontSize: 14
                                } }, { children: [(0, jsx_runtime_1.jsx)(IC, { n: "cart", s: 50 }, void 0), (0, jsx_runtime_1.jsx)("br", {}, void 0), (0, jsx_runtime_1.jsx)("br", {}, void 0), "\u0627\u0628\u062D\u062B \u0639\u0646 \u0635\u0646\u0641 \u0623\u0648 \u0627\u0645\u0633\u062D \u0627\u0644\u0628\u0627\u0631\u0643\u0648\u062F \u0644\u0625\u0636\u0627\u0641\u062A\u0647"] }), void 0)) : ((0, jsx_runtime_1.jsxs)("table", __assign({ style: { width: "100%", borderCollapse: "collapse" } }, { children: [(0, jsx_runtime_1.jsx)("thead", { children: (0, jsx_runtime_1.jsxs)("tr", __assign({ style: { borderBottom: "1px solid #1d2d4a" } }, { children: [(0, jsx_runtime_1.jsx)("th", __assign({ style: {
                                                        textAlign: "right",
                                                        padding: "8px 4px",
                                                        color: "#4a6a8a",
                                                        fontSize: 12,
                                                        fontWeight: 600
                                                    } }, { children: "\u0627\u0644\u0635\u0646\u0641" }), void 0), (0, jsx_runtime_1.jsx)("th", __assign({ style: {
                                                        textAlign: "center",
                                                        padding: "8px 4px",
                                                        color: "#4a6a8a",
                                                        fontSize: 12,
                                                        fontWeight: 600
                                                    } }, { children: "\u0627\u0644\u0643\u0645\u064A\u0629" }), void 0), (0, jsx_runtime_1.jsx)("th", __assign({ style: {
                                                        textAlign: "center",
                                                        padding: "8px 4px",
                                                        color: "#4a6a8a",
                                                        fontSize: 12,
                                                        fontWeight: 600
                                                    } }, { children: "\u0627\u0644\u0633\u0639\u0631" }), void 0), (0, jsx_runtime_1.jsx)("th", __assign({ style: {
                                                        textAlign: "center",
                                                        padding: "8px 4px",
                                                        color: "#4a6a8a",
                                                        fontSize: 12,
                                                        fontWeight: 600
                                                    } }, { children: "\u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A" }), void 0), (0, jsx_runtime_1.jsx)("th", { style: { width: 30 } }, void 0)] }), void 0) }, void 0), (0, jsx_runtime_1.jsx)("tbody", { children: cart.map(function (item) { return ((0, jsx_runtime_1.jsxs)("tr", __assign({ style: { borderBottom: "1px solid #0a101a" } }, { children: [(0, jsx_runtime_1.jsxs)("td", __assign({ style: { padding: "8px 4px" } }, { children: [(0, jsx_runtime_1.jsx)("div", __assign({ style: {
                                                                fontSize: 13,
                                                                fontWeight: 700,
                                                                color: "#dde8ff"
                                                            } }, { children: item.name }), void 0), (0, jsx_runtime_1.jsx)("input", { value: item.dose, onChange: function (e) {
                                                                return setCart(function (p) {
                                                                    return p.map(function (i) {
                                                                        return i.id === item.id
                                                                            ? __assign(__assign({}, i), { dose: e.target.value }) : i;
                                                                    });
                                                                });
                                                            }, placeholder: "\u0627\u0644\u062C\u0631\u0639\u0629...", style: {
                                                                width: "100%",
                                                                background: "transparent",
                                                                border: "none",
                                                                borderBottom: "1px solid #1a2a4a",
                                                                color: "#6a8aaa",
                                                                fontSize: 11,
                                                                outline: "none",
                                                                padding: "2px 0"
                                                            } }, void 0)] }), void 0), (0, jsx_runtime_1.jsx)("td", __assign({ style: { textAlign: "center", padding: "8px 4px" } }, { children: (0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "center",
                                                            gap: 4
                                                        } }, { children: [(0, jsx_runtime_1.jsx)("button", __assign({ onClick: function () {
                                                                    return setCart(function (p) {
                                                                        return p.map(function (i) {
                                                                            return i.id === item.id
                                                                                ? __assign(__assign({}, i), { qty: Math.max(1, i.qty - 1) }) : i;
                                                                        });
                                                                    });
                                                                }, style: {
                                                                    width: 20,
                                                                    height: 20,
                                                                    borderRadius: 4,
                                                                    background: "#1a2540",
                                                                    border: "none",
                                                                    color: "#5a9aff",
                                                                    cursor: "pointer"
                                                                } }, { children: "-" }), void 0), (0, jsx_runtime_1.jsx)("span", __assign({ style: {
                                                                    fontSize: 13,
                                                                    fontWeight: 700,
                                                                    color: "#dde8ff",
                                                                    minWidth: 20,
                                                                    textAlign: "center"
                                                                } }, { children: item.qty }), void 0), (0, jsx_runtime_1.jsx)("button", __assign({ onClick: function () {
                                                                    return setCart(function (p) {
                                                                        return p.map(function (i) {
                                                                            var _a;
                                                                            return i.id === item.id
                                                                                ? __assign(__assign({}, i), { qty: Math.min(i.qty + 1, ((_a = products.find(function (x) { return x.id === i.id; })) === null || _a === void 0 ? void 0 : _a.stock) || 99) }) : i;
                                                                        });
                                                                    });
                                                                }, style: {
                                                                    width: 20,
                                                                    height: 20,
                                                                    borderRadius: 4,
                                                                    background: "#1a2540",
                                                                    border: "none",
                                                                    color: "#5a9aff",
                                                                    cursor: "pointer"
                                                                } }, { children: "+" }), void 0)] }), void 0) }), void 0), (0, jsx_runtime_1.jsx)("td", __assign({ style: {
                                                        textAlign: "center",
                                                        padding: "8px 4px",
                                                        color: "#2a9aff",
                                                        fontSize: 13
                                                    } }, { children: item.price }), void 0), (0, jsx_runtime_1.jsx)("td", __assign({ style: {
                                                        textAlign: "center",
                                                        padding: "8px 4px",
                                                        color: "#dde8ff",
                                                        fontSize: 13,
                                                        fontWeight: 700
                                                    } }, { children: (item.price * item.qty).toFixed(2) }), void 0), (0, jsx_runtime_1.jsx)("td", __assign({ style: { textAlign: "center" } }, { children: (0, jsx_runtime_1.jsx)("button", __assign({ onClick: function () {
                                                            return setCart(function (p) { return p.filter(function (i) { return i.id !== item.id; }); });
                                                        }, style: {
                                                            background: "transparent",
                                                            border: "none",
                                                            color: "#5a2a2a",
                                                            cursor: "pointer"
                                                        } }, { children: "\u2715" }), void 0) }), void 0)] }), item.id)); }) }, void 0)] }), void 0)) }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                                padding: "12px 16px",
                                borderTop: "1px solid #1d2d4a",
                                background: "#080e1a"
                            } }, { children: [(0, jsx_runtime_1.jsx)("div", __assign({ style: { display: "flex", gap: 6, marginBottom: 10 } }, { children: ["نقدي", "بطاقة", "تحويل", "آجل"].map(function (m) { return ((0, jsx_runtime_1.jsx)("button", __assign({ onClick: function () { return setPayment(m); }, style: {
                                            flex: 1,
                                            padding: "7px 0",
                                            borderRadius: 7,
                                            border: "1px solid",
                                            borderColor: payment === m ? "#2a6aef" : "#1d2d4a",
                                            background: payment === m ? "#142a5a" : "transparent",
                                            color: payment === m ? "#6aaeff" : "#4a6a8a",
                                            fontSize: 12,
                                            fontWeight: 600,
                                            cursor: "pointer"
                                        } }, { children: m }), m)); }) }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 8,
                                        marginBottom: 10
                                    } }, { children: [(0, jsx_runtime_1.jsx)("label", __assign({ style: { color: "#4a6a8a", fontSize: 12 } }, { children: "\u062E\u0635\u0645 %" }), void 0), (0, jsx_runtime_1.jsx)("input", { type: "number", min: "0", max: "100", value: discount, onChange: function (e) { return setDiscount(+e.target.value); }, style: {
                                                background: "#080e1a",
                                                border: "1px solid #1d2d4a",
                                                borderRadius: 7,
                                                padding: "6px 10px",
                                                color: "#dde8ff",
                                                fontSize: 13,
                                                outline: "none",
                                                width: 70
                                            } }, void 0), cart.length > 0 && ((0, jsx_runtime_1.jsx)("button", __assign({ onClick: function () { return setCart([]); }, style: {
                                                marginRight: "auto",
                                                background: "transparent",
                                                border: "none",
                                                color: "#5a2a2a",
                                                cursor: "pointer",
                                                fontSize: 12
                                            } }, { children: "\uD83D\uDDD1 \u0645\u0633\u062D \u0627\u0644\u0643\u0644" }), void 0))] }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                                        background: "#0a1020",
                                        borderRadius: 10,
                                        padding: 10,
                                        marginBottom: 10
                                    } }, { children: [(0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                                                display: "flex",
                                                justifyContent: "space-between",
                                                color: "#4a6a8a",
                                                fontSize: 12,
                                                marginBottom: 4
                                            } }, { children: [(0, jsx_runtime_1.jsx)("span", { children: "\u0642\u0628\u0644 \u0627\u0644\u0636\u0631\u064A\u0628\u0629" }, void 0), (0, jsx_runtime_1.jsxs)("span", { children: [subtotal.toFixed(2), " \u0631.\u0633"] }, void 0)] }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                                                display: "flex",
                                                justifyContent: "space-between",
                                                color: "#88dd44",
                                                fontSize: 12,
                                                marginBottom: 4
                                            } }, { children: [(0, jsx_runtime_1.jsx)("span", { children: "\u0636\u0631\u064A\u0628\u0629 15%" }, void 0), (0, jsx_runtime_1.jsxs)("span", { children: [taxAmount.toFixed(2), " \u0631.\u0633"] }, void 0)] }), void 0), discount > 0 && ((0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                                                display: "flex",
                                                justifyContent: "space-between",
                                                color: "#ffaa44",
                                                fontSize: 12,
                                                marginBottom: 4
                                            } }, { children: [(0, jsx_runtime_1.jsxs)("span", { children: ["\u062E\u0635\u0645 ", discount, "%"] }, void 0), (0, jsx_runtime_1.jsxs)("span", { children: ["- ", discountAmt.toFixed(2), " \u0631.\u0633"] }, void 0)] }), void 0)), (0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                                                display: "flex",
                                                justifyContent: "space-between",
                                                color: "#dde8ff",
                                                fontSize: 18,
                                                fontWeight: 800,
                                                borderTop: "1px solid #1d2d4a",
                                                paddingTop: 8,
                                                marginTop: 4
                                            } }, { children: [(0, jsx_runtime_1.jsx)("span", { children: "\u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A" }, void 0), (0, jsx_runtime_1.jsxs)("span", { children: [total.toFixed(2), " \u0631.\u0633"] }, void 0)] }), void 0)] }), void 0), (0, jsx_runtime_1.jsx)(Btn, __assign({ size: "lg", onClick: completeSale, style: { width: "100%", justifyContent: "center" }, variant: success ? "success" : "primary", icon: success ? "check" : "money" }, { children: success ? "تمت العملية!" : "إتمام البيع" }), void 0)] }), void 0)] }), void 0) }), void 0), showPrint && ((0, jsx_runtime_1.jsx)(PrintReceipt, { invoice: showPrint, onClose: function () { return setShowPrint(null); } }, void 0))] }), void 0));
}
// ==================== PRINT RECEIPT ====================
function PrintReceipt(_a) {
    var invoice = _a.invoice, onClose = _a.onClose;
    var printArea = (0, react_1.useRef)();
    var doPrint = function () {
        var w = window.open("", "_blank", "width=400,height=700");
        w.document.write("<html dir=\"rtl\"><head><style>body{font-family:'Tajawal',Arial,sans-serif;margin:0;padding:16px;font-size:13px;color:#000;background:#fff}h2{margin:4px 0;font-size:16px}table{width:100%;border-collapse:collapse}td,th{padding:4px 6px;border-bottom:1px solid #ddd;font-size:12px}hr{border:1px dashed #999}.total{font-weight:700;font-size:15px}.dose{font-size:11px;color:#555;font-style:italic}.header{text-align:center;margin-bottom:12px}@media print{body{padding:0}}</style></head><body>" + printArea.current.innerHTML + "</body></html>");
        w.document.close();
        w.focus();
        w.print();
        w.close();
    };
    return ((0, jsx_runtime_1.jsxs)(Modal, __assign({ open: true, title: "\u0645\u0639\u0627\u064A\u0646\u0629 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629 / \u0648\u0635\u0641\u0629 \u0627\u0644\u062C\u0631\u0639\u0627\u062A", onClose: onClose }, { children: [(0, jsx_runtime_1.jsxs)("div", __assign({ ref: printArea, style: {
                    background: "#fff",
                    color: "#000",
                    padding: 16,
                    borderRadius: 8,
                    marginBottom: 16,
                    fontFamily: "Tajawal,Arial,sans-serif",
                    fontSize: 13
                } }, { children: [(0, jsx_runtime_1.jsxs)("div", __assign({ className: "header", style: { textAlign: "center", marginBottom: 12 } }, { children: [(0, jsx_runtime_1.jsx)("h2", __assign({ style: { margin: "4px 0", fontSize: 16 } }, { children: "\u0635\u064A\u062F\u0644\u064A\u0629 \u0628\u0631\u0648" }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: { fontSize: 11, color: "#555" } }, { children: ["\u0641\u0627\u062A\u0648\u0631\u0629 \u0645\u0628\u064A\u0639\u0627\u062A \u0631\u0642\u0645: ", invoice.id] }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: { fontSize: 11, color: "#555" } }, { children: ["\u0627\u0644\u062A\u0627\u0631\u064A\u062E: ", invoice.date, " | \u0627\u0644\u062F\u0641\u0639: ", invoice.payment] }), void 0), invoice.customerName && ((0, jsx_runtime_1.jsxs)("div", __assign({ style: { fontSize: 11 } }, { children: ["\u0627\u0644\u0639\u0645\u064A\u0644: ", invoice.customerName] }), void 0)), (0, jsx_runtime_1.jsx)("hr", {}, void 0)] }), void 0), (0, jsx_runtime_1.jsxs)("table", { children: [(0, jsx_runtime_1.jsx)("thead", { children: (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("th", __assign({ style: { textAlign: "right" } }, { children: "\u0627\u0644\u0635\u0646\u0641" }), void 0), (0, jsx_runtime_1.jsx)("th", { children: "\u0627\u0644\u0643\u0645\u064A\u0629" }, void 0), (0, jsx_runtime_1.jsx)("th", { children: "\u0627\u0644\u0633\u0639\u0631" }, void 0), (0, jsx_runtime_1.jsx)("th", { children: "\u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A" }, void 0)] }, void 0) }, void 0), (0, jsx_runtime_1.jsx)("tbody", { children: invoice.items.map(function (item, i) { return ((0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsxs)("td", { children: [(0, jsx_runtime_1.jsx)("div", { children: item.name }, void 0), item.dose && ((0, jsx_runtime_1.jsxs)("div", __assign({ className: "dose", style: {
                                                        fontSize: 11,
                                                        color: "#555",
                                                        fontStyle: "italic"
                                                    } }, { children: ["\u25B8 ", item.dose] }), void 0))] }, void 0), (0, jsx_runtime_1.jsx)("td", __assign({ style: { textAlign: "center" } }, { children: item.qty }), void 0), (0, jsx_runtime_1.jsx)("td", __assign({ style: { textAlign: "center" } }, { children: item.price }), void 0), (0, jsx_runtime_1.jsx)("td", __assign({ style: { textAlign: "center" } }, { children: (item.price * item.qty).toFixed(2) }), void 0)] }, i)); }) }, void 0)] }, void 0), (0, jsx_runtime_1.jsx)("hr", {}, void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                            display: "flex",
                            justifyContent: "space-between",
                            marginTop: 4
                        } }, { children: [(0, jsx_runtime_1.jsx)("span", { children: "\u0642\u0628\u0644 \u0627\u0644\u0636\u0631\u064A\u0628\u0629" }, void 0), (0, jsx_runtime_1.jsxs)("span", { children: [(invoice.subtotal || 0).toFixed(2), " \u0631.\u0633"] }, void 0)] }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: { display: "flex", justifyContent: "space-between" } }, { children: [(0, jsx_runtime_1.jsx)("span", { children: "\u0636\u0631\u064A\u0628\u0629 15%" }, void 0), (0, jsx_runtime_1.jsxs)("span", { children: [(invoice.taxAmount || invoice.tax_amount || 0).toFixed(2), " \u0631.\u0633"] }, void 0)] }), void 0), invoice.discountAmt > 0 && ((0, jsx_runtime_1.jsxs)("div", __assign({ style: { display: "flex", justifyContent: "space-between" } }, { children: [(0, jsx_runtime_1.jsx)("span", { children: "\u062E\u0635\u0645" }, void 0), (0, jsx_runtime_1.jsxs)("span", { children: ["- ", invoice.discountAmt || invoice.discount_amt || 0, " \u0631.\u0633"] }, void 0)] }), void 0)), (0, jsx_runtime_1.jsxs)("div", __assign({ className: "total", style: {
                            display: "flex",
                            justifyContent: "space-between",
                            fontWeight: 700,
                            fontSize: 15,
                            borderTop: "2px solid #000",
                            paddingTop: 6,
                            marginTop: 4
                        } }, { children: [(0, jsx_runtime_1.jsx)("span", { children: "\u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A" }, void 0), (0, jsx_runtime_1.jsxs)("span", { children: [invoice.total.toFixed(2), " \u0631.\u0633"] }, void 0)] }), void 0), invoice.prescriptionImg && ((0, jsx_runtime_1.jsxs)("div", __assign({ style: { marginTop: 12, textAlign: "center" } }, { children: [(0, jsx_runtime_1.jsx)("div", __assign({ style: { fontSize: 11, color: "#777", marginBottom: 4 } }, { children: "\u0635\u0648\u0631\u0629 \u0627\u0644\u0648\u0635\u0641\u0629 \u0627\u0644\u0637\u0628\u064A\u0629:" }), void 0), (0, jsx_runtime_1.jsx)("img", { src: invoice.prescriptionImg, style: {
                                    maxWidth: "100%",
                                    maxHeight: 150,
                                    borderRadius: 6,
                                    border: "1px solid #ddd"
                                }, alt: "\u0648\u0635\u0641\u0629" }, void 0)] }), void 0)), (0, jsx_runtime_1.jsxs)("div", __assign({ style: { textAlign: "center", marginTop: 12 } }, { children: [(0, jsx_runtime_1.jsx)(qrcode_react_1.QRCodeSVG, { value: invoice.date + "|" + (invoice.total || 0).toFixed(2) + "|" + (invoice.taxAmount ||
                                    invoice.tax_amount ||
                                    0).toFixed(2), size: 100 }, void 0), (0, jsx_runtime_1.jsx)("div", __assign({ style: { fontSize: 10, color: "#999", marginTop: 4 } }, { children: "\u0634\u0643\u0631\u0627\u064B \u0644\u0632\u064A\u0627\u0631\u062A\u0643\u0645 \u2022 \u0635\u064A\u062F\u0644\u064A\u0629 \u0628\u0631\u0648" }), void 0)] }), void 0)] }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: { display: "flex", gap: 10, justifyContent: "flex-end" } }, { children: [(0, jsx_runtime_1.jsx)(Btn, __assign({ variant: "ghost", onClick: onClose }, { children: "\u0625\u063A\u0644\u0627\u0642" }), void 0), (0, jsx_runtime_1.jsx)(Btn, __assign({ icon: "print", onClick: doPrint }, { children: "\u0637\u0628\u0627\u0639\u0629" }), void 0)] }), void 0)] }), void 0));
}
// ==================== PURCHASE MODULE ====================
function PurchaseModule(_a) {
    var products = _a.products, setProducts = _a.setProducts, suppliers = _a.suppliers, purchases = _a.purchases, setPurchases = _a.setPurchases, showToast = _a.showToast;
    var _b = (0, react_1.useState)(false), showNew = _b[0], setShowNew = _b[1];
    var _c = (0, react_1.useState)([]), items = _c[0], setItems = _c[1];
    var _d = (0, react_1.useState)(""), selSupplier = _d[0], setSelSupplier = _d[1];
    var _e = (0, react_1.useState)(""), barcodeInput = _e[0], setBarcodeInput = _e[1];
    var scanItem = function (code) {
        var p = products.find(function (x) { return x.barcode === code || x.id === code; });
        if (!p) {
            showToast("الصنف غير موجود", "error");
            return;
        }
        setItems(function (prev) {
            var ex = prev.find(function (i) { return i.id === p.id; });
            return ex
                ? prev.map(function (i) { return (i.id === p.id ? __assign(__assign({}, i), { qty: i.qty + 1 }) : i); })
                : __spreadArray(__spreadArray([], prev, true), [__assign(__assign({}, p), { qty: 1, receivedCost: p.cost })], false);
        });
    };
    var subtotal = items.reduce(function (s, i) { return s + i.receivedCost * i.qty; }, 0);
    var taxAmt = items.reduce(function (s, i) { return (i.taxable ? s + i.receivedCost * i.qty * TAX_RATE : s); }, 0);
    var total = subtotal + taxAmt;
    var savePurchase = function () {
        if (!selSupplier || items.length === 0) {
            showToast("يرجى اختيار المورد وإضافة أصناف", "error");
            return;
        }
        var sup = suppliers.find(function (s) { return s.id === selSupplier; });
        var po = {
            id: "PO-" + String(purchases.length + 1).padStart(4, "0"),
            date: new Date().toISOString().split("T")[0],
            supplier: selSupplier,
            supplierName: sup.name,
            items: items.map(function (i) { return ({
                id: i.id,
                name: i.name,
                qty: i.qty,
                cost: i.receivedCost,
                taxable: i.taxable
            }); }),
            subtotal: subtotal,
            taxAmount: taxAmt,
            total: total,
            status: "مستلمة"
        };
        setPurchases(function (p) { return __spreadArray(__spreadArray([], p, true), [po], false); });
        setProducts(function (p) {
            return p.map(function (x) {
                var ci = items.find(function (i) { return i.id === x.id; });
                return ci
                    ? __assign(__assign({}, x), { stock: x.stock + ci.qty, cost: ci.receivedCost }) : x;
            });
        });
        setItems([]);
        setSelSupplier("");
        setShowNew(false);
        showToast("تم حفظ فاتورة الشراء ✓");
    };
    return ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 18
                } }, { children: [(0, jsx_runtime_1.jsx)("h2", __assign({ style: { margin: 0, fontSize: 20, fontWeight: 800 } }, { children: "\u0641\u0648\u0627\u062A\u064A\u0631 \u0627\u0644\u0634\u0631\u0627\u0621" }), void 0), (0, jsx_runtime_1.jsx)(Btn, __assign({ icon: "plus", onClick: function () { return setShowNew(true); } }, { children: "\u0641\u0627\u062A\u0648\u0631\u0629 \u0634\u0631\u0627\u0621 \u062C\u062F\u064A\u062F\u0629" }), void 0)] }), void 0), (0, jsx_runtime_1.jsx)(Table, { headers: [
                    "رقم الفاتورة",
                    "التاريخ",
                    "المورد",
                    "المجموع قبل الضريبة",
                    "الضريبة",
                    "الإجمالي",
                    "الحالة",
                ], rows: purchases.map(function (p) { return [
                    (0, jsx_runtime_1.jsx)("span", __assign({ style: { color: "#6aaeff", fontWeight: 700 } }, { children: p.id }), void 0),
                    p.date,
                    p.supplierName,
                    p.subtotal.toFixed(2) + " ر.س",
                    p.taxAmount.toFixed(2) + " ر.س",
                    (0, jsx_runtime_1.jsxs)("span", __assign({ style: { color: "#44dd88", fontWeight: 700 } }, { children: [p.total.toFixed(2), " \u0631.\u0633"] }), void 0),
                    (0, jsx_runtime_1.jsx)(Badge, __assign({ color: "#0a2a10", text: "#44dd88" }, { children: p.status }), void 0),
                ]; }) }, void 0), (0, jsx_runtime_1.jsxs)(Modal, __assign({ open: showNew, onClose: function () {
                    setShowNew(false);
                    setItems([]);
                }, title: "\u0641\u0627\u062A\u0648\u0631\u0629 \u0634\u0631\u0627\u0621 \u062C\u062F\u064A\u062F\u0629", wide: true }, { children: [(0, jsx_runtime_1.jsx)("div", __assign({ style: {
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 12,
                            marginBottom: 16
                        } }, { children: (0, jsx_runtime_1.jsx)(Select, { label: "\u0627\u0644\u0645\u0648\u0631\u062F", value: selSupplier, onChange: setSelSupplier, options: __spreadArray([
                                { v: "", l: "اختر المورد" }
                            ], suppliers.map(function (s) { return ({
                                v: s.id,
                                l: s.name + " \u2014 " + s.taxId
                            }); }), true) }, void 0) }), void 0), (0, jsx_runtime_1.jsx)(BarcodeScanner, { onScan: scanItem, placeholder: "\u0627\u0645\u0633\u062D \u0628\u0627\u0631\u0643\u0648\u062F \u0627\u0644\u0635\u0646\u0641 \u0644\u0625\u0636\u0627\u0641\u062A\u0647..." }, void 0), (0, jsx_runtime_1.jsx)("div", __assign({ style: { marginTop: 14, overflowX: "auto" } }, { children: (0, jsx_runtime_1.jsxs)("table", __assign({ style: { width: "100%", borderCollapse: "collapse" } }, { children: [(0, jsx_runtime_1.jsx)("thead", { children: (0, jsx_runtime_1.jsx)("tr", __assign({ style: { background: "#080e1a" } }, { children: [
                                            "الصنف",
                                            "الكمية",
                                            "تكلفة الوحدة",
                                            "ضريبة",
                                            "الإجمالي",
                                            "",
                                        ].map(function (h) { return ((0, jsx_runtime_1.jsx)("th", __assign({ style: {
                                                padding: "9px 12px",
                                                textAlign: "right",
                                                color: "#4a6a9a",
                                                fontSize: 12
                                            } }, { children: h }), h)); }) }), void 0) }, void 0), (0, jsx_runtime_1.jsx)("tbody", { children: items.map(function (item) { return ((0, jsx_runtime_1.jsxs)("tr", __assign({ style: { borderBottom: "1px solid #0a101a" } }, { children: [(0, jsx_runtime_1.jsx)("td", __assign({ style: {
                                                    padding: "8px 12px",
                                                    fontSize: 13,
                                                    color: "#c0d0f0"
                                                } }, { children: item.name }), void 0), (0, jsx_runtime_1.jsx)("td", __assign({ style: { padding: "8px 12px" } }, { children: (0, jsx_runtime_1.jsx)("input", { type: "number", min: "1", value: item.qty, onChange: function (e) {
                                                        return setItems(function (p) {
                                                            return p.map(function (i) {
                                                                return i.id === item.id
                                                                    ? __assign(__assign({}, i), { qty: +e.target.value }) : i;
                                                            });
                                                        });
                                                    }, style: {
                                                        width: 60,
                                                        background: "#080e1a",
                                                        border: "1px solid #1d2d4a",
                                                        borderRadius: 6,
                                                        padding: "4px 8px",
                                                        color: "#dde8ff",
                                                        fontSize: 13,
                                                        outline: "none"
                                                    } }, void 0) }), void 0), (0, jsx_runtime_1.jsx)("td", __assign({ style: { padding: "8px 12px" } }, { children: (0, jsx_runtime_1.jsx)("input", { type: "number", min: "0", step: "0.01", value: item.receivedCost, onChange: function (e) {
                                                        return setItems(function (p) {
                                                            return p.map(function (i) {
                                                                return i.id === item.id
                                                                    ? __assign(__assign({}, i), { receivedCost: +e.target.value }) : i;
                                                            });
                                                        });
                                                    }, style: {
                                                        width: 80,
                                                        background: "#080e1a",
                                                        border: "1px solid #1d2d4a",
                                                        borderRadius: 6,
                                                        padding: "4px 8px",
                                                        color: "#dde8ff",
                                                        fontSize: 13,
                                                        outline: "none"
                                                    } }, void 0) }), void 0), (0, jsx_runtime_1.jsx)("td", __assign({ style: { padding: "8px 12px" } }, { children: (0, jsx_runtime_1.jsx)(Badge, __assign({ color: item.taxable ? "#0a2a00" : "#1a1a2a", text: item.taxable ? "#44dd88" : "#4a6a8a" }, { children: item.taxable ? "15%" : "معفى" }), void 0) }), void 0), (0, jsx_runtime_1.jsx)("td", __assign({ style: {
                                                    padding: "8px 12px",
                                                    color: "#3a9aff",
                                                    fontWeight: 700
                                                } }, { children: (item.receivedCost *
                                                    item.qty *
                                                    (item.taxable ? 1 + TAX_RATE : 1)).toFixed(2) }), void 0), (0, jsx_runtime_1.jsx)("td", __assign({ style: { padding: "8px 12px" } }, { children: (0, jsx_runtime_1.jsx)("button", __assign({ onClick: function () {
                                                        return setItems(function (p) { return p.filter(function (i) { return i.id !== item.id; }); });
                                                    }, style: {
                                                        background: "transparent",
                                                        border: "none",
                                                        color: "#5a2a2a",
                                                        cursor: "pointer"
                                                    } }, { children: (0, jsx_runtime_1.jsx)(IC, { n: "trash", s: 14 }, void 0) }), void 0) }), void 0)] }), item.id)); }) }, void 0)] }), void 0) }), void 0), items.length > 0 && ((0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                            background: "#080e1a",
                            borderRadius: 10,
                            padding: 14,
                            marginTop: 14
                        } }, { children: [(0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                                    display: "flex",
                                    justifyContent: "space-between",
                                    color: "#4a6a8a",
                                    marginBottom: 5
                                } }, { children: [(0, jsx_runtime_1.jsx)("span", { children: "\u0627\u0644\u0645\u062C\u0645\u0648\u0639 \u0642\u0628\u0644 \u0627\u0644\u0636\u0631\u064A\u0628\u0629" }, void 0), (0, jsx_runtime_1.jsxs)("span", { children: [subtotal.toFixed(2), " \u0631.\u0633"] }, void 0)] }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                                    display: "flex",
                                    justifyContent: "space-between",
                                    color: "#88dd44",
                                    marginBottom: 5
                                } }, { children: [(0, jsx_runtime_1.jsx)("span", { children: "\u0636\u0631\u064A\u0628\u0629 \u0627\u0644\u0642\u064A\u0645\u0629 \u0627\u0644\u0645\u0636\u0627\u0641\u0629 15%" }, void 0), (0, jsx_runtime_1.jsxs)("span", { children: [taxAmt.toFixed(2), " \u0631.\u0633"] }, void 0)] }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                                    display: "flex",
                                    justifyContent: "space-between",
                                    color: "#dde8ff",
                                    fontWeight: 800,
                                    fontSize: 16,
                                    borderTop: "1px solid #1d2d4a",
                                    paddingTop: 8
                                } }, { children: [(0, jsx_runtime_1.jsx)("span", { children: "\u0627\u0644\u0625\u062C\u0645\u0627\u0644\u064A" }, void 0), (0, jsx_runtime_1.jsxs)("span", { children: [total.toFixed(2), " \u0631.\u0633"] }, void 0)] }), void 0)] }), void 0)), (0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                            display: "flex",
                            gap: 10,
                            marginTop: 16,
                            justifyContent: "flex-end"
                        } }, { children: [(0, jsx_runtime_1.jsx)(Btn, __assign({ variant: "ghost", onClick: function () {
                                    setShowNew(false);
                                    setItems([]);
                                } }, { children: "\u0625\u0644\u063A\u0627\u0621" }), void 0), (0, jsx_runtime_1.jsx)(Btn, __assign({ icon: "check", onClick: savePurchase }, { children: "\u062D\u0641\u0638 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629" }), void 0)] }), void 0)] }), void 0)] }, void 0));
}
// ==================== RETURNS MODULE ====================
function ReturnsModule(_a) {
    var products = _a.products, setProducts = _a.setProducts, sales = _a.sales, setSales = _a.setSales, purchases = _a.purchases, setPurchases = _a.setPurchases, showToast = _a.showToast;
    var _b = (0, react_1.useState)("sales"), type = _b[0], setType = _b[1];
    var _c = (0, react_1.useState)(""), selInvoice = _c[0], setSelInvoice = _c[1];
    var _d = (0, react_1.useState)([]), returnItems = _d[0], setReturnItems = _d[1];
    var _e = (0, react_1.useState)(""), reason = _e[0], setReason = _e[1];
    var invoice = type === "sales"
        ? sales.find(function (s) { return s.id === selInvoice && !s.returned; })
        : purchases.find(function (p) { return p.id === selInvoice; });
    (0, react_1.useEffect)(function () {
        if (invoice)
            setReturnItems(invoice.items.map(function (i) { return (__assign(__assign({}, i), { returnQty: 0 })); }));
    }, [selInvoice, invoice === null || invoice === void 0 ? void 0 : invoice.id]);
    var returnSubtotal = returnItems.reduce(function (s, i) { return s + (i.price || i.cost) * i.returnQty; }, 0);
    var returnTax = returnItems.reduce(function (s, i) {
        return i.taxable ? s + (i.price || i.cost) * i.returnQty * TAX_RATE : s;
    }, 0);
    var returnTotal = returnSubtotal + returnTax;
    var processReturn = function () {
        if (!invoice || returnItems.every(function (i) { return i.returnQty === 0; })) {
            showToast("يرجى تحديد كميات المرتجع", "error");
            return;
        }
        if (type === "sales") {
            setSales(function (p) {
                return p.map(function (s) {
                    return s.id === selInvoice
                        ? __assign(__assign({}, s), { returned: true, returnReason: reason }) : s;
                });
            });
            setProducts(function (p) {
                return p.map(function (x) {
                    var ri = returnItems.find(function (i) { return i.id === x.id; });
                    return ri && ri.returnQty > 0
                        ? __assign(__assign({}, x), { stock: x.stock + ri.returnQty }) : x;
                });
            });
        }
        setSelInvoice("");
        setReturnItems([]);
        setReason("");
        showToast("\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u0645\u0631\u062A\u062C\u0639 \u2713 \u2014 " + returnTotal.toFixed(2) + " \u0631.\u0633");
    };
    return ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h2", __assign({ style: { margin: "0 0 18px", fontSize: 20, fontWeight: 800 } }, { children: "\u0627\u0644\u0645\u0631\u062A\u062C\u0639\u0627\u062A" }), void 0), (0, jsx_runtime_1.jsx)("div", __assign({ style: { display: "flex", gap: 10, marginBottom: 18 } }, { children: ["sales", "purchases"].map(function (t) { return ((0, jsx_runtime_1.jsxs)("button", __assign({ onClick: function () {
                        setType(t);
                        setSelInvoice("");
                        setReturnItems([]);
                    }, style: {
                        padding: "9px 22px",
                        borderRadius: 9,
                        border: "1px solid",
                        borderColor: type === t ? "#2a6aef" : "#1d2d4a",
                        background: type === t ? "#142a5a" : "transparent",
                        color: type === t ? "#6aaeff" : "#4a6a8a",
                        fontWeight: type === t ? 700 : 400,
                        cursor: "pointer",
                        fontSize: 14
                    } }, { children: ["\u0645\u0631\u062A\u062C\u0639 ", t === "sales" ? "مبيعات" : "مشتريات"] }), t)); }) }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                    marginBottom: 16
                } }, { children: [(0, jsx_runtime_1.jsx)(Select, { label: "\u0627\u062E\u062A\u0631 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629", value: selInvoice, onChange: setSelInvoice, options: __spreadArray([
                            { v: "", l: "اختر الفاتورة..." }
                        ], (type === "sales"
                            ? sales.filter(function (s) { return !s.returned; })
                            : purchases).map(function (x) { return ({
                            v: x.id,
                            l: x.id + " \u2014 " + x.date + " \u2014 " + x.total.toFixed(2) + " \u0631.\u0633"
                        }); }), true) }, void 0), (0, jsx_runtime_1.jsx)(Input, { label: "\u0633\u0628\u0628 \u0627\u0644\u0625\u0631\u062C\u0627\u0639", value: reason, onChange: setReason, placeholder: "\u0633\u0628\u0628 \u0627\u0644\u0625\u0631\u062C\u0627\u0639 (\u0627\u062E\u062A\u064A\u0627\u0631\u064A)" }, void 0)] }), void 0), invoice && ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                            background: "#0f1623",
                            border: "1px solid #1d2d4a",
                            borderRadius: 12,
                            padding: 16,
                            marginBottom: 14
                        } }, { children: [(0, jsx_runtime_1.jsxs)("div", __assign({ style: { color: "#dde8ff", fontWeight: 700, marginBottom: 12 } }, { children: ["\u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u0641\u0627\u062A\u0648\u0631\u0629: ", invoice.id] }), void 0), returnItems.map(function (item, i) { return ((0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                    padding: "8px 0",
                                    borderBottom: "1px solid #0a101a"
                                } }, { children: [(0, jsx_runtime_1.jsx)("div", __assign({ style: { flex: 1, fontSize: 13, color: "#c0d0f0" } }, { children: item.name }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: { color: "#4a6a8a", fontSize: 12 } }, { children: ["\u0627\u0644\u0643\u0645\u064A\u0629: ", item.qty] }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: { display: "flex", alignItems: "center", gap: 4 } }, { children: [(0, jsx_runtime_1.jsx)("label", __assign({ style: { color: "#4a6a8a", fontSize: 12 } }, { children: "\u0643\u0645\u064A\u0629 \u0627\u0644\u0625\u0631\u062C\u0627\u0639:" }), void 0), (0, jsx_runtime_1.jsx)("input", { type: "number", min: "0", max: item.qty, value: item.returnQty, onChange: function (e) {
                                                    return setReturnItems(function (p) {
                                                        return p.map(function (x, j) {
                                                            return j === i
                                                                ? __assign(__assign({}, x), { returnQty: Math.min(+e.target.value, item.qty) }) : x;
                                                        });
                                                    });
                                                }, style: {
                                                    width: 60,
                                                    background: "#080e1a",
                                                    border: "1px solid #1d2d4a",
                                                    borderRadius: 6,
                                                    padding: "5px 8px",
                                                    color: "#dde8ff",
                                                    fontSize: 13,
                                                    outline: "none"
                                                } }, void 0)] }), void 0), item.taxable && ((0, jsx_runtime_1.jsx)(Badge, __assign({ color: "#0a2a00", text: "#44dd88" }, { children: "15%" }), void 0))] }), i)); })] }), void 0), returnTotal > 0 && ((0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                            background: "#080e1a",
                            borderRadius: 10,
                            padding: 14,
                            marginBottom: 14
                        } }, { children: [(0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                                    display: "flex",
                                    justifyContent: "space-between",
                                    color: "#4a6a8a",
                                    marginBottom: 5
                                } }, { children: [(0, jsx_runtime_1.jsx)("span", { children: "\u0642\u064A\u0645\u0629 \u0627\u0644\u0645\u0631\u062A\u062C\u0639 \u0642\u0628\u0644 \u0627\u0644\u0636\u0631\u064A\u0628\u0629" }, void 0), (0, jsx_runtime_1.jsxs)("span", { children: [returnSubtotal.toFixed(2), " \u0631.\u0633"] }, void 0)] }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                                    display: "flex",
                                    justifyContent: "space-between",
                                    color: "#88dd44",
                                    marginBottom: 5
                                } }, { children: [(0, jsx_runtime_1.jsx)("span", { children: "\u0627\u0644\u0636\u0631\u064A\u0628\u0629 \u0627\u0644\u0645\u0633\u062A\u0631\u062F\u0629 15%" }, void 0), (0, jsx_runtime_1.jsxs)("span", { children: [returnTax.toFixed(2), " \u0631.\u0633"] }, void 0)] }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                                    display: "flex",
                                    justifyContent: "space-between",
                                    color: "#dde8ff",
                                    fontWeight: 800,
                                    fontSize: 16,
                                    borderTop: "1px solid #1d2d4a",
                                    paddingTop: 8
                                } }, { children: [(0, jsx_runtime_1.jsx)("span", { children: "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0645\u0631\u062A\u062C\u0639" }, void 0), (0, jsx_runtime_1.jsxs)("span", { children: [returnTotal.toFixed(2), " \u0631.\u0633"] }, void 0)] }), void 0)] }), void 0)), (0, jsx_runtime_1.jsx)(Btn, __assign({ icon: "returns", onClick: processReturn, variant: "danger", style: { color: "#ff8888" } }, { children: "\u062A\u0623\u0643\u064A\u062F \u0627\u0644\u0625\u0631\u062C\u0627\u0639" }), void 0)] }, void 0))] }, void 0));
}
// ==================== INVENTORY COUNT ====================
function InventoryCount(_a) {
    var products = _a.products, setProducts = _a.setProducts, inventoryLogs = _a.inventoryLogs, setInventoryLogs = _a.setInventoryLogs, currentUser = _a.currentUser, showToast = _a.showToast;
    var _b = (0, react_1.useState)(false), showNew = _b[0], setShowNew = _b[1];
    var _c = (0, react_1.useState)([]), countItems = _c[0], setCountItems = _c[1];
    var _d = (0, react_1.useState)(""), notes = _d[0], setNotes = _d[1];
    var _e = (0, react_1.useState)(""), search = _e[0], setSearch = _e[1];
    var startCount = function () {
        setCountItems(products.map(function (p) { return ({
            id: p.id,
            name: p.name,
            category: p.category,
            systemQty: p.stock,
            actualQty: p.stock,
            diff: 0
        }); }));
        setShowNew(true);
    };
    var saveCount = function () {
        var log = {
            id: "INV-ADJ-" + String(inventoryLogs.length + 1).padStart(3, "0"),
            date: new Date().toISOString().split("T")[0],
            type: "جرد",
            items: countItems.map(function (i) { return ({
                id: i.id,
                systemQty: i.systemQty,
                actualQty: i.actualQty,
                diff: i.actualQty - i.systemQty
            }); }),
            notes: notes,
            by: currentUser.name
        };
        setInventoryLogs(function (p) { return __spreadArray(__spreadArray([], p, true), [log], false); });
        setProducts(function (p) {
            return p.map(function (x) {
                var ci = countItems.find(function (i) { return i.id === x.id; });
                return ci ? __assign(__assign({}, x), { stock: ci.actualQty }) : x;
            });
        });
        setShowNew(false);
        setNotes("");
        showToast("تم حفظ الجرد وتحديث المخزون ✓");
    };
    var filtered = countItems.filter(function (i) { return i.name.includes(search) || i.category.includes(search); });
    return ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 18
                } }, { children: [(0, jsx_runtime_1.jsx)("h2", __assign({ style: { margin: 0, fontSize: 20, fontWeight: 800 } }, { children: "\u0646\u0638\u0627\u0645 \u0627\u0644\u062C\u0631\u062F" }), void 0), (0, jsx_runtime_1.jsx)(Btn, __assign({ icon: "count", onClick: startCount }, { children: "\u0628\u062F\u0621 \u062C\u0631\u062F \u062C\u062F\u064A\u062F" }), void 0)] }), void 0), (0, jsx_runtime_1.jsx)(Table, { headers: ["رقم الجرد", "التاريخ", "بواسطة", "ملاحظات", "الفروقات"], rows: inventoryLogs.map(function (l) { return [
                    (0, jsx_runtime_1.jsx)("span", __assign({ style: { color: "#6aaeff", fontWeight: 700 } }, { children: l.id }), void 0),
                    l.date,
                    l.by,
                    l.notes || "-",
                    (0, jsx_runtime_1.jsxs)("span", __assign({ style: {
                            color: l.items.some(function (i) { return i.diff !== 0; }) ? "#ffaa44" : "#44dd88"
                        } }, { children: [l.items.filter(function (i) { return i.diff !== 0; }).length, " \u0635\u0646\u0641 \u0645\u062E\u062A\u0644\u0641"] }), void 0),
                ]; }) }, void 0), (0, jsx_runtime_1.jsxs)(Modal, __assign({ open: showNew, onClose: function () { return setShowNew(false); }, title: "\u062C\u0631\u062F \u0627\u0644\u0645\u062E\u0632\u0648\u0646 \u0627\u0644\u062C\u062F\u064A\u062F", wide: true }, { children: [(0, jsx_runtime_1.jsx)(Input, { label: "\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0627\u0644\u062C\u0631\u062F", value: notes, onChange: setNotes, placeholder: "\u0648\u0635\u0641 \u0627\u0644\u062C\u0631\u062F..." }, void 0), (0, jsx_runtime_1.jsx)("input", { value: search, onChange: function (e) { return setSearch(e.target.value); }, placeholder: "\uD83D\uDD0D \u0628\u062D\u062B \u0641\u064A \u0627\u0644\u0623\u0635\u0646\u0627\u0641...", style: {
                            width: "100%",
                            background: "#080e1a",
                            border: "1px solid #1d2d4a",
                            borderRadius: 8,
                            padding: "9px 12px",
                            color: "#dde8ff",
                            fontSize: 14,
                            outline: "none",
                            boxSizing: "border-box",
                            marginTop: 12,
                            marginBottom: 12
                        } }, void 0), (0, jsx_runtime_1.jsx)("div", __assign({ style: { overflowX: "auto", maxHeight: "50vh", overflowY: "auto" } }, { children: (0, jsx_runtime_1.jsxs)("table", __assign({ style: { width: "100%", borderCollapse: "collapse" } }, { children: [(0, jsx_runtime_1.jsx)("thead", { children: (0, jsx_runtime_1.jsx)("tr", __assign({ style: { background: "#080e1a", position: "sticky", top: 0 } }, { children: [
                                            "الصنف",
                                            "الفئة",
                                            "كمية النظام",
                                            "الكمية الفعلية",
                                            "الفرق",
                                        ].map(function (h) { return ((0, jsx_runtime_1.jsx)("th", __assign({ style: {
                                                padding: "9px 14px",
                                                textAlign: "right",
                                                color: "#4a6a9a",
                                                fontSize: 12
                                            } }, { children: h }), h)); }) }), void 0) }, void 0), (0, jsx_runtime_1.jsx)("tbody", { children: filtered.map(function (item, i) { return ((0, jsx_runtime_1.jsxs)("tr", __assign({ style: {
                                            borderBottom: "1px solid #0a101a",
                                            background: i % 2 === 0 ? "transparent" : "#080e14"
                                        } }, { children: [(0, jsx_runtime_1.jsx)("td", __assign({ style: {
                                                    padding: "8px 14px",
                                                    fontSize: 13,
                                                    color: "#c0d0f0"
                                                } }, { children: item.name }), void 0), (0, jsx_runtime_1.jsx)("td", __assign({ style: { padding: "8px 14px" } }, { children: (0, jsx_runtime_1.jsx)(Badge, { children: item.category }, void 0) }), void 0), (0, jsx_runtime_1.jsx)("td", __assign({ style: { padding: "8px 14px", color: "#4a6a8a" } }, { children: item.systemQty }), void 0), (0, jsx_runtime_1.jsx)("td", __assign({ style: { padding: "8px 14px" } }, { children: (0, jsx_runtime_1.jsx)("input", { type: "number", min: "0", value: item.actualQty, onChange: function (e) {
                                                        return setCountItems(function (p) {
                                                            return p.map(function (x) {
                                                                return x.id === item.id
                                                                    ? __assign(__assign({}, x), { actualQty: +e.target.value, diff: +e.target.value - x.systemQty }) : x;
                                                            });
                                                        });
                                                    }, style: {
                                                        width: 70,
                                                        background: "#080e1a",
                                                        border: "1px solid #1d2d4a",
                                                        borderRadius: 6,
                                                        padding: "5px 8px",
                                                        color: "#dde8ff",
                                                        fontSize: 13,
                                                        outline: "none"
                                                    } }, void 0) }), void 0), (0, jsx_runtime_1.jsxs)("td", __assign({ style: {
                                                    padding: "8px 14px",
                                                    fontWeight: 700,
                                                    color: item.actualQty - item.systemQty < 0
                                                        ? "#ff7777"
                                                        : item.actualQty - item.systemQty > 0
                                                            ? "#44dd88"
                                                            : "#4a6a8a"
                                                } }, { children: [item.actualQty - item.systemQty > 0 ? "+" : "", item.actualQty - item.systemQty] }), void 0)] }), item.id)); }) }, void 0)] }), void 0) }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                            display: "flex",
                            gap: 10,
                            marginTop: 16,
                            justifyContent: "flex-end"
                        } }, { children: [(0, jsx_runtime_1.jsx)(Btn, __assign({ variant: "ghost", onClick: function () { return setShowNew(false); } }, { children: "\u0625\u0644\u063A\u0627\u0621" }), void 0), (0, jsx_runtime_1.jsx)(Btn, __assign({ icon: "check", onClick: saveCount }, { children: "\u062D\u0641\u0638 \u0627\u0644\u062C\u0631\u062F \u0648\u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0645\u062E\u0632\u0648\u0646" }), void 0)] }), void 0)] }), void 0)] }, void 0));
}
// ==================== PRODUCTS MODULE ====================
function ProductsModule(_a) {
    var _this = this;
    var products = _a.products, setProducts = _a.setProducts, suppliers = _a.suppliers, showToast = _a.showToast;
    var _b = (0, react_1.useState)(""), search = _b[0], setSearch = _b[1];
    var _c = (0, react_1.useState)(false), showForm = _c[0], setShowForm = _c[1];
    var _d = (0, react_1.useState)(null), editing = _d[0], setEditing = _d[1];
    var blank = {
        id: "",
        name: "",
        barcode: "",
        category: "مسكنات",
        unit: "قرص",
        price: "",
        cost: "",
        taxable: true,
        stock: "",
        minStock: "",
        supplier: "",
        expiry: "",
        activeIngredient: "",
        concentration: ""
    };
    var _e = (0, react_1.useState)(blank), form = _e[0], setForm = _e[1];
    var F = function (k, v) { return setForm(function (p) {
        var _a;
        return (__assign(__assign({}, p), (_a = {}, _a[k] = v, _a)));
    }); };
    var filtered = products.filter(function (p) {
        return p.name.includes(search) ||
            p.barcode.includes(search) ||
            p.id.includes(search) ||
            p.category.includes(search);
    });
    var openEdit = function (p) {
        setEditing(p.id);
        setForm(__assign(__assign({}, p), { price: String(p.price), cost: String(p.cost), stock: String(p.stock), minStock: String(p.minStock) }));
        setShowForm(true);
    };
    var openAdd = function () {
        setEditing(null);
        setForm(__assign(__assign({}, blank), { id: "P" + String(products.length + 1).padStart(3, "0") }));
        setShowForm(true);
    };
    var save = function () { return __awaiter(_this, void 0, void 0, function () {
        var p;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!form.name || !form.price || !form.stock) {
                        showToast("يرجى ملء الحقول المطلوبة", "error");
                        return [2 /*return*/];
                    }
                    p = __assign(__assign({}, form), { price: +form.price, cost: +form.cost, stock: +form.stock, min_stock: +form.minStock });
                    if (!editing) return [3 /*break*/, 2];
                    return [4 /*yield*/, supabase.from("products").update(p).eq("id", editing)];
                case 1:
                    _a.sent();
                    setProducts(function (prev) { return prev.map(function (x) { return (x.id === editing ? p : x); }); });
                    return [3 /*break*/, 4];
                case 2: return [4 /*yield*/, supabase.from("products").insert(p)];
                case 3:
                    _a.sent();
                    setProducts(function (prev) { return __spreadArray(__spreadArray([], prev, true), [p], false); });
                    _a.label = 4;
                case 4:
                    setShowForm(false);
                    showToast(editing ? "تم تعديل الصنف" : "تمت إضافة الصنف ✓");
                    return [2 /*return*/];
            }
        });
    }); };
    return ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 18
                } }, { children: [(0, jsx_runtime_1.jsx)("h2", __assign({ style: { margin: 0, fontSize: 20, fontWeight: 800 } }, { children: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0623\u0635\u0646\u0627\u0641" }), void 0), (0, jsx_runtime_1.jsx)(Btn, __assign({ icon: "plus", onClick: openAdd }, { children: "\u0625\u0636\u0627\u0641\u0629 \u0635\u0646\u0641" }), void 0)] }), void 0), (0, jsx_runtime_1.jsx)("input", { value: search, onChange: function (e) { return setSearch(e.target.value); }, placeholder: "\uD83D\uDD0D \u0628\u062D\u062B \u0628\u0627\u0644\u0627\u0633\u0645 \u0623\u0648 \u0627\u0644\u0628\u0627\u0631\u0643\u0648\u062F \u0623\u0648 \u0627\u0644\u0641\u0626\u0629...", style: {
                    width: "100%",
                    background: "#080e1a",
                    border: "1px solid #1d2d4a",
                    borderRadius: 8,
                    padding: "9px 14px",
                    color: "#dde8ff",
                    fontSize: 14,
                    outline: "none",
                    boxSizing: "border-box",
                    marginBottom: 14
                } }, void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                    display: "grid",
                    gridTemplateColumns: "repeat(4,1fr)",
                    gap: 12,
                    marginBottom: 16
                } }, { children: [(0, jsx_runtime_1.jsx)(StatCard, { label: "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0623\u0635\u0646\u0627\u0641", value: products.length, icon: "inventory", color: "#3a9aff" }, void 0), (0, jsx_runtime_1.jsx)(StatCard, { label: "\u0645\u062E\u0632\u0648\u0646 \u0645\u0646\u062E\u0641\u0636", value: products.filter(function (p) { return p.stock <= p.minStock; }).length, icon: "alert", color: "#ffaa44" }, void 0), (0, jsx_runtime_1.jsx)(StatCard, { label: "\u0623\u0635\u0646\u0627\u0641 \u062E\u0627\u0636\u0639\u0629 \u0644\u0644\u0636\u0631\u064A\u0628\u0629", value: products.filter(function (p) { return p.taxable; }).length, icon: "tax", color: "#88dd44" }, void 0), (0, jsx_runtime_1.jsx)(StatCard, { label: "\u0642\u064A\u0645\u0629 \u0627\u0644\u0645\u062E\u0632\u0648\u0646", value: products.reduce(function (s, p) { return s + p.cost * p.stock; }, 0).toFixed(0) +
                            " ر.س", icon: "money", color: "#a78bfa" }, void 0)] }), void 0), (0, jsx_runtime_1.jsx)(Table, { headers: [
                    "رمز",
                    "الصنف",
                    "الباركود",
                    "الفئة",
                    "سعر البيع",
                    "التكلفة",
                    "الضريبة",
                    "المخزون",
                    "الحد الأدنى",
                    "الانتهاء",
                    "إجراءات",
                ], rows: filtered.map(function (p) { return [
                    (0, jsx_runtime_1.jsx)("span", __assign({ style: { color: "#4a6a8a", fontSize: 11 } }, { children: p.id }), void 0),
                    (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", __assign({ style: { fontWeight: 700, color: "#dde8ff" } }, { children: p.name }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: { fontSize: 10, color: "#3a5a8a" } }, { children: [p.activeIngredient, " ", p.concentration] }), void 0)] }, void 0),
                    (0, jsx_runtime_1.jsx)("span", __assign({ style: { fontSize: 11, color: "#4a6a8a", fontFamily: "monospace" } }, { children: p.barcode }), void 0),
                    (0, jsx_runtime_1.jsx)(Badge, { children: p.category }, void 0),
                    (0, jsx_runtime_1.jsxs)("span", __assign({ style: { color: "#3a9aff", fontWeight: 700 } }, { children: [p.price, " \u0631.\u0633"] }), void 0),
                    (0, jsx_runtime_1.jsxs)("span", __assign({ style: { color: "#4a6a8a" } }, { children: [p.cost, " \u0631.\u0633"] }), void 0),
                    (0, jsx_runtime_1.jsx)(Badge, __assign({ color: p.taxable ? "#0a2a00" : "#1a1a2a", text: p.taxable ? "#44dd88" : "#4a6a8a" }, { children: p.taxable ? "15%" : "معفى" }), void 0),
                    (0, jsx_runtime_1.jsx)("span", __assign({ style: {
                            color: p.stock <= p.minStock
                                ? "#ffaa44"
                                : p.stock === 0
                                    ? "#ff5555"
                                    : "#44dd88",
                            fontWeight: 700
                        } }, { children: p.stock }), void 0),
                    p.minStock,
                    (0, jsx_runtime_1.jsx)("span", __assign({ style: {
                            color: new Date(p.expiry) < new Date() ? "#ff5555" : "#4a6a8a",
                            fontSize: 12
                        } }, { children: p.expiry }), void 0),
                    (0, jsx_runtime_1.jsxs)("div", __assign({ style: { display: "flex", gap: 5 } }, { children: [(0, jsx_runtime_1.jsx)(Btn, __assign({ size: "sm", icon: "edit", variant: "secondary", onClick: function () { return openEdit(p); } }, { children: "\u062A\u0639\u062F\u064A\u0644" }), void 0), (0, jsx_runtime_1.jsx)(Btn, __assign({ size: "sm", icon: "trash", variant: "danger", onClick: function () { return __awaiter(_this, void 0, void 0, function () {
                                    return __generator(this, function (_a) {
                                        switch (_a.label) {
                                            case 0: return [4 /*yield*/, supabase.from("products")["delete"]().eq("id", p.id)];
                                            case 1:
                                                _a.sent();
                                                setProducts(function (prev) { return prev.filter(function (x) { return x.id !== p.id; }); });
                                                showToast("تم حذف الصنف");
                                                return [2 /*return*/];
                                        }
                                    });
                                }); } }, { children: "\u062D\u0630\u0641" }), void 0)] }), void 0),
                ]; }) }, void 0), (0, jsx_runtime_1.jsxs)(Modal, __assign({ open: showForm, onClose: function () { return setShowForm(false); }, title: editing ? "تعديل الصنف" : "إضافة صنف جديد", wide: true }, { children: [(0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr 1fr",
                            gap: 12
                        } }, { children: [(0, jsx_runtime_1.jsx)(Input, { label: "\u0631\u0645\u0632 \u0627\u0644\u0635\u0646\u0641", value: form.id, onChange: function (v) { return F("id", v); }, placeholder: "P001", style: { gridColumn: "1/2" } }, void 0), (0, jsx_runtime_1.jsx)(Input, { label: "\u0627\u0633\u0645 \u0627\u0644\u0635\u0646\u0641 *", value: form.name, onChange: function (v) { return F("name", v); }, placeholder: "\u0627\u0633\u0645 \u0627\u0644\u062F\u0648\u0627\u0621", style: { gridColumn: "2/4" } }, void 0), (0, jsx_runtime_1.jsx)(Input, { label: "\u0627\u0644\u0628\u0627\u0631\u0643\u0648\u062F (Barcode/QR)", value: form.barcode, onChange: function (v) { return F("barcode", v); }, placeholder: "\u0631\u0642\u0645 \u0627\u0644\u0628\u0627\u0631\u0643\u0648\u062F" }, void 0), (0, jsx_runtime_1.jsx)(Select, { label: "\u0627\u0644\u0641\u0626\u0629", value: form.category, onChange: function (v) { return F("category", v); }, options: CATEGORIES }, void 0), (0, jsx_runtime_1.jsx)(Input, { label: "\u0648\u062D\u062F\u0629 \u0627\u0644\u0642\u064A\u0627\u0633", value: form.unit, onChange: function (v) { return F("unit", v); }, placeholder: "\u0642\u0631\u0635 / \u0643\u0628\u0633\u0648\u0644\u0629..." }, void 0), (0, jsx_runtime_1.jsx)(Input, { label: "\u0633\u0639\u0631 \u0627\u0644\u0628\u064A\u0639 *", value: form.price, onChange: function (v) { return F("price", v); }, type: "number", placeholder: "0.00" }, void 0), (0, jsx_runtime_1.jsx)(Input, { label: "\u0633\u0639\u0631 \u0627\u0644\u062A\u0643\u0644\u0641\u0629", value: form.cost, onChange: function (v) { return F("cost", v); }, type: "number", placeholder: "0.00" }, void 0), (0, jsx_runtime_1.jsx)(Input, { label: "\u0627\u0644\u0643\u0645\u064A\u0629 \u0641\u064A \u0627\u0644\u0645\u062E\u0632\u0648\u0646 *", value: form.stock, onChange: function (v) { return F("stock", v); }, type: "number", placeholder: "0" }, void 0), (0, jsx_runtime_1.jsx)(Input, { label: "\u0627\u0644\u062D\u062F \u0627\u0644\u0623\u062F\u0646\u0649 \u0644\u0644\u0645\u062E\u0632\u0648\u0646", value: form.minStock, onChange: function (v) { return F("minStock", v); }, type: "number", placeholder: "10" }, void 0), (0, jsx_runtime_1.jsx)(Input, { label: "\u0627\u0644\u0645\u0627\u062F\u0629 \u0627\u0644\u0641\u0639\u0627\u0644\u0629", value: form.activeIngredient, onChange: function (v) { return F("activeIngredient", v); }, placeholder: "Paracetamol" }, void 0), (0, jsx_runtime_1.jsx)(Input, { label: "\u0627\u0644\u062A\u0631\u0643\u064A\u0632", value: form.concentration, onChange: function (v) { return F("concentration", v); }, placeholder: "500mg" }, void 0), (0, jsx_runtime_1.jsx)(Input, { label: "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u0646\u062A\u0647\u0627\u0621", value: form.expiry, onChange: function (v) { return F("expiry", v); }, type: "date" }, void 0), (0, jsx_runtime_1.jsx)(Select, { label: "\u0627\u0644\u0645\u0648\u0631\u062F", value: form.supplier, onChange: function (v) { return F("supplier", v); }, options: __spreadArray([
                                    { v: "", l: "اختر المورد" }
                                ], suppliers.map(function (s) { return ({ v: s.id, l: s.name }); }), true) }, void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                    padding: "8px 0"
                                } }, { children: [(0, jsx_runtime_1.jsx)("label", __assign({ style: { color: "#5a7aaa", fontSize: 13, fontWeight: 600 } }, { children: "\u062E\u0627\u0636\u0639 \u0644\u0636\u0631\u064A\u0628\u0629 \u0627\u0644\u0642\u064A\u0645\u0629 \u0627\u0644\u0645\u0636\u0627\u0641\u0629 15%" }), void 0), (0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: form.taxable, onChange: function (e) { return F("taxable", e.target.checked); }, style: { width: 16, height: 16, cursor: "pointer" } }, void 0)] }), void 0)] }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                            display: "flex",
                            gap: 10,
                            marginTop: 18,
                            justifyContent: "flex-end"
                        } }, { children: [(0, jsx_runtime_1.jsx)(Btn, __assign({ variant: "ghost", onClick: function () { return setShowForm(false); } }, { children: "\u0625\u0644\u063A\u0627\u0621" }), void 0), (0, jsx_runtime_1.jsx)(Btn, __assign({ icon: "check", onClick: save }, { children: editing ? "حفظ التعديل" : "إضافة الصنف" }), void 0)] }), void 0)] }), void 0)] }, void 0));
}
// ==================== SUPPLIERS ====================
function SuppliersModule(_a) {
    var _this = this;
    var suppliers = _a.suppliers, setSuppliers = _a.setSuppliers, showToast = _a.showToast;
    var _b = (0, react_1.useState)(false), showForm = _b[0], setShowForm = _b[1];
    var _c = (0, react_1.useState)(null), editing = _c[0], setEditing = _c[1];
    var blank = {
        id: "",
        name: "",
        taxId: "",
        phone: "",
        email: "",
        address: "",
        contact: ""
    };
    var _d = (0, react_1.useState)(blank), form = _d[0], setForm = _d[1];
    var F = function (k, v) { return setForm(function (p) {
        var _a;
        return (__assign(__assign({}, p), (_a = {}, _a[k] = v, _a)));
    }); };
    var openAdd = function () {
        setEditing(null);
        setForm(__assign(__assign({}, blank), { id: "S" + String(suppliers.length + 1).padStart(3, "0") }));
        setShowForm(true);
    };
    var openEdit = function (s) {
        setEditing(s.id);
        setForm(s);
        setShowForm(true);
    };
    var save = function () {
        if (!form.name) {
            showToast("يرجى إدخال اسم المورد", "error");
            return;
        }
        if (editing)
            setSuppliers(function (p) { return p.map(function (x) { return (x.id === editing ? form : x); }); });
        else
            setSuppliers(function (p) { return __spreadArray(__spreadArray([], p, true), [form], false); });
        setShowForm(false);
        showToast(editing ? "تم تعديل المورد" : "تمت إضافة المورد ✓");
    };
    return ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 18
                } }, { children: [(0, jsx_runtime_1.jsx)("h2", __assign({ style: { margin: 0, fontSize: 20, fontWeight: 800 } }, { children: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0648\u0631\u062F\u064A\u0646" }), void 0), (0, jsx_runtime_1.jsx)(Btn, __assign({ icon: "plus", onClick: openAdd }, { children: "\u0625\u0636\u0627\u0641\u0629 \u0645\u0648\u0631\u062F" }), void 0)] }), void 0), (0, jsx_runtime_1.jsx)("div", __assign({ style: {
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))",
                    gap: 14
                } }, { children: suppliers.map(function (s) { return ((0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                        background: "#0f1623",
                        border: "1px solid #1d2d4a",
                        borderRadius: 14,
                        padding: 18
                    } }, { children: [(0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "flex-start",
                                marginBottom: 12
                            } }, { children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", __assign({ style: { fontWeight: 700, color: "#dde8ff", fontSize: 15 } }, { children: s.name }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: { color: "#3a6a9a", fontSize: 12, marginTop: 2 } }, { children: ["\u0631\u0645\u0632: ", s.id] }), void 0)] }, void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: { display: "flex", gap: 6 } }, { children: [(0, jsx_runtime_1.jsx)(Btn, __assign({ size: "sm", icon: "edit", variant: "secondary", onClick: function () { return openEdit(s); } }, { children: "\u062A\u0639\u062F\u064A\u0644" }), void 0), (0, jsx_runtime_1.jsx)(Btn, __assign({ size: "sm", icon: "trash", variant: "danger", onClick: function () { return __awaiter(_this, void 0, void 0, function () {
                                                return __generator(this, function (_a) {
                                                    switch (_a.label) {
                                                        case 0: return [4 /*yield*/, supabase.from("suppliers")["delete"]().eq("id", s.id)];
                                                        case 1:
                                                            _a.sent();
                                                            setSuppliers(function (p) { return p.filter(function (x) { return x.id !== s.id; }); });
                                                            showToast("تم حذف المورد");
                                                            return [2 /*return*/];
                                                    }
                                                });
                                            }); } }, { children: "\u062D\u0630\u0641" }), void 0)] }), void 0)] }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: { display: "flex", flexDirection: "column", gap: 6 } }, { children: [s.taxId && ((0, jsx_runtime_1.jsxs)("div", __assign({ style: { display: "flex", gap: 8, alignItems: "center" } }, { children: [(0, jsx_runtime_1.jsx)("span", __assign({ style: {
                                                color: "#3a6a9a",
                                                fontSize: 11,
                                                width: 100,
                                                flexShrink: 0
                                            } }, { children: "\u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u0636\u0631\u064A\u0628\u064A:" }), void 0), (0, jsx_runtime_1.jsx)(Badge, __assign({ color: "#0a2a00", text: "#44dd88" }, { children: s.taxId }), void 0)] }), void 0)), s.phone && ((0, jsx_runtime_1.jsxs)("div", __assign({ style: { fontSize: 12, color: "#5a7a9a" } }, { children: [(0, jsx_runtime_1.jsx)("span", __assign({ style: { color: "#3a5a7a" } }, { children: "\uD83D\uDCDE " }), void 0), s.phone] }), void 0)), s.email && ((0, jsx_runtime_1.jsxs)("div", __assign({ style: { fontSize: 12, color: "#5a7a9a" } }, { children: [(0, jsx_runtime_1.jsx)("span", __assign({ style: { color: "#3a5a7a" } }, { children: "\u2709 " }), void 0), s.email] }), void 0)), s.address && ((0, jsx_runtime_1.jsxs)("div", __assign({ style: { fontSize: 12, color: "#5a7a9a" } }, { children: [(0, jsx_runtime_1.jsx)("span", __assign({ style: { color: "#3a5a7a" } }, { children: "\uD83D\uDCCD " }), void 0), s.address] }), void 0)), s.contact && ((0, jsx_runtime_1.jsxs)("div", __assign({ style: { fontSize: 12, color: "#5a7a9a" } }, { children: [(0, jsx_runtime_1.jsx)("span", __assign({ style: { color: "#3a5a7a" } }, { children: "\uD83D\uDC64 " }), void 0), s.contact] }), void 0))] }), void 0)] }), s.id)); }) }), void 0), (0, jsx_runtime_1.jsxs)(Modal, __assign({ open: showForm, onClose: function () { return setShowForm(false); }, title: editing ? "تعديل المورد" : "إضافة مورد جديد" }, { children: [(0, jsx_runtime_1.jsxs)("div", __assign({ style: { display: "flex", flexDirection: "column", gap: 12 } }, { children: [(0, jsx_runtime_1.jsx)(Input, { label: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0648\u0631\u062F *", value: form.name, onChange: function (v) { return F("name", v); }, placeholder: "\u0627\u0633\u0645 \u0627\u0644\u0634\u0631\u0643\u0629 \u0623\u0648 \u0627\u0644\u0645\u0648\u0631\u062F" }, void 0), (0, jsx_runtime_1.jsx)(Input, { label: "\u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u0636\u0631\u064A\u0628\u064A (VAT)", value: form.taxId, onChange: function (v) { return F("taxId", v); }, placeholder: "300XXXXXXXXX00003" }, void 0), (0, jsx_runtime_1.jsx)(Input, { label: "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641", value: form.phone, onChange: function (v) { return F("phone", v); }, placeholder: "011XXXXXXX" }, void 0), (0, jsx_runtime_1.jsx)(Input, { label: "\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A", value: form.email, onChange: function (v) { return F("email", v); }, placeholder: "info@company.com" }, void 0), (0, jsx_runtime_1.jsx)(Input, { label: "\u0627\u0644\u0639\u0646\u0648\u0627\u0646", value: form.address, onChange: function (v) { return F("address", v); }, placeholder: "\u0627\u0644\u0645\u062F\u064A\u0646\u0629\u060C \u0627\u0644\u062D\u064A..." }, void 0), (0, jsx_runtime_1.jsx)(Input, { label: "\u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u062A\u0648\u0627\u0635\u0644", value: form.contact, onChange: function (v) { return F("contact", v); }, placeholder: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u0624\u0648\u0644" }, void 0)] }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                            display: "flex",
                            gap: 10,
                            marginTop: 18,
                            justifyContent: "flex-end"
                        } }, { children: [(0, jsx_runtime_1.jsx)(Btn, __assign({ variant: "ghost", onClick: function () { return setShowForm(false); } }, { children: "\u0625\u0644\u063A\u0627\u0621" }), void 0), (0, jsx_runtime_1.jsx)(Btn, __assign({ icon: "check", onClick: save }, { children: editing ? "حفظ التعديل" : "إضافة المورد" }), void 0)] }), void 0)] }), void 0)] }, void 0));
}
// ==================== CUSTOMERS ====================
function CustomersModule(_a) {
    var customers = _a.customers, setCustomers = _a.setCustomers, showToast = _a.showToast;
    var _b = (0, react_1.useState)(""), search = _b[0], setSearch = _b[1];
    var _c = (0, react_1.useState)(false), showForm = _c[0], setShowForm = _c[1];
    var _d = (0, react_1.useState)(null), editing = _d[0], setEditing = _d[1];
    var blank = {
        id: "",
        name: "",
        phone: "",
        taxId: "",
        totalSpent: 0,
        visits: 0,
        lastVisit: "-"
    };
    var _e = (0, react_1.useState)(blank), form = _e[0], setForm = _e[1];
    var F = function (k, v) { return setForm(function (p) {
        var _a;
        return (__assign(__assign({}, p), (_a = {}, _a[k] = v, _a)));
    }); };
    var openAdd = function () {
        setEditing(null);
        setForm(__assign(__assign({}, blank), { id: "C" + String(customers.length + 1).padStart(3, "0") }));
        setShowForm(true);
    };
    var openEdit = function (c) {
        setEditing(c.id);
        setForm(c);
        setShowForm(true);
    };
    var save = function () {
        if (!form.name || !form.phone) {
            showToast("يرجى ملء بيانات العميل", "error");
            return;
        }
        if (editing)
            setCustomers(function (p) { return p.map(function (x) { return (x.id === editing ? form : x); }); });
        else
            setCustomers(function (p) { return __spreadArray(__spreadArray([], p, true), [form], false); });
        setShowForm(false);
        showToast(editing ? "تم تعديل العميل" : "تمت إضافة العميل ✓");
    };
    var filtered = customers.filter(function (c) {
        var _a;
        return c.name.includes(search) ||
            c.phone.includes(search) ||
            ((_a = c.taxId) === null || _a === void 0 ? void 0 : _a.includes(search));
    });
    return ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 18
                } }, { children: [(0, jsx_runtime_1.jsx)("h2", __assign({ style: { margin: 0, fontSize: 20, fontWeight: 800 } }, { children: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0639\u0645\u0644\u0627\u0621" }), void 0), (0, jsx_runtime_1.jsx)(Btn, __assign({ icon: "plus", onClick: openAdd }, { children: "\u0625\u0636\u0627\u0641\u0629 \u0639\u0645\u064A\u0644" }), void 0)] }), void 0), (0, jsx_runtime_1.jsx)("input", { value: search, onChange: function (e) { return setSearch(e.target.value); }, placeholder: "\uD83D\uDD0D \u0628\u062D\u062B \u0628\u0627\u0644\u0627\u0633\u0645 \u0623\u0648 \u0627\u0644\u0647\u0627\u062A\u0641 \u0623\u0648 \u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u0636\u0631\u064A\u0628\u064A...", style: {
                    width: "100%",
                    background: "#080e1a",
                    border: "1px solid #1d2d4a",
                    borderRadius: 8,
                    padding: "9px 14px",
                    color: "#dde8ff",
                    fontSize: 14,
                    outline: "none",
                    boxSizing: "border-box",
                    marginBottom: 14
                } }, void 0), (0, jsx_runtime_1.jsx)("div", __assign({ style: {
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))",
                    gap: 14
                } }, { children: filtered.map(function (c) { return ((0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                        background: "#0f1623",
                        border: "1px solid #1d2d4a",
                        borderRadius: 14,
                        padding: 18
                    } }, { children: [(0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "flex-start",
                                marginBottom: 12
                            } }, { children: [(0, jsx_runtime_1.jsxs)("div", __assign({ style: { display: "flex", alignItems: "center", gap: 10 } }, { children: [(0, jsx_runtime_1.jsx)("div", __assign({ style: {
                                                width: 40,
                                                height: 40,
                                                borderRadius: 10,
                                                background: "#1a2a5a",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                color: "#5a9aff"
                                            } }, { children: (0, jsx_runtime_1.jsx)(IC, { n: "user", s: 18 }, void 0) }), void 0), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("div", __assign({ style: { fontWeight: 700, color: "#dde8ff" } }, { children: c.name }), void 0), (0, jsx_runtime_1.jsx)("div", __assign({ style: { color: "#3a6a9a", fontSize: 12 } }, { children: c.phone }), void 0)] }, void 0)] }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: { display: "flex", gap: 5 } }, { children: [(0, jsx_runtime_1.jsx)(Btn, __assign({ size: "sm", icon: "edit", variant: "secondary", onClick: function () { return openEdit(c); } }, { children: "\u062A\u0639\u062F\u064A\u0644" }), void 0), (0, jsx_runtime_1.jsx)(Btn, __assign({ size: "sm", icon: "trash", variant: "danger", onClick: function () {
                                                setCustomers(function (p) { return p.filter(function (x) { return x.id !== c.id; }); });
                                                showToast("تم حذف العميل");
                                            } }, { children: "\u062D\u0630\u0641" }), void 0)] }), void 0)] }), void 0), c.taxId && ((0, jsx_runtime_1.jsx)("div", __assign({ style: { marginBottom: 8 } }, { children: (0, jsx_runtime_1.jsxs)(Badge, __assign({ color: "#0a2a00", text: "#44dd88" }, { children: ["\u0631\u0642\u0645 \u0636\u0631\u064A\u0628\u064A: ", c.taxId] }), void 0) }), void 0)), (0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: 8
                            } }, { children: [(0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                                        background: "#080e1a",
                                        borderRadius: 8,
                                        padding: "9px 11px"
                                    } }, { children: [(0, jsx_runtime_1.jsx)("div", __assign({ style: { color: "#3a5a8a", fontSize: 10 } }, { children: "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0645\u0634\u062A\u0631\u064A\u0627\u062A" }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                                                color: "#3a9aff",
                                                fontWeight: 700,
                                                fontSize: 15,
                                                marginTop: 2
                                            } }, { children: [c.totalSpent.toFixed(2), " \u0631.\u0633"] }), void 0)] }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                                        background: "#080e1a",
                                        borderRadius: 8,
                                        padding: "9px 11px"
                                    } }, { children: [(0, jsx_runtime_1.jsx)("div", __assign({ style: { color: "#3a5a8a", fontSize: 10 } }, { children: "\u0639\u062F\u062F \u0627\u0644\u0632\u064A\u0627\u0631\u0627\u062A" }), void 0), (0, jsx_runtime_1.jsx)("div", __assign({ style: {
                                                color: "#44dd88",
                                                fontWeight: 700,
                                                fontSize: 15,
                                                marginTop: 2
                                            } }, { children: c.visits }), void 0)] }), void 0)] }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: { marginTop: 8, color: "#2a4a6a", fontSize: 11 } }, { children: ["\u0622\u062E\u0631 \u0632\u064A\u0627\u0631\u0629: ", c.lastVisit] }), void 0)] }), c.id)); }) }), void 0), (0, jsx_runtime_1.jsxs)(Modal, __assign({ open: showForm, onClose: function () { return setShowForm(false); }, title: editing ? "تعديل العميل" : "إضافة عميل جديد" }, { children: [(0, jsx_runtime_1.jsxs)("div", __assign({ style: { display: "flex", flexDirection: "column", gap: 12 } }, { children: [(0, jsx_runtime_1.jsx)(Input, { label: "\u0627\u0633\u0645 \u0627\u0644\u0639\u0645\u064A\u0644 *", value: form.name, onChange: function (v) { return F("name", v); }, placeholder: "\u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0643\u0627\u0645\u0644" }, void 0), (0, jsx_runtime_1.jsx)(Input, { label: "\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 *", value: form.phone, onChange: function (v) { return F("phone", v); }, placeholder: "05XXXXXXXX" }, void 0), (0, jsx_runtime_1.jsx)(Input, { label: "\u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u0636\u0631\u064A\u0628\u064A (\u0644\u0644\u0634\u0631\u0643\u0627\u062A)", value: form.taxId, onChange: function (v) { return F("taxId", v); }, placeholder: "310XXXXXXXXX003 (\u0627\u062E\u062A\u064A\u0627\u0631\u064A)" }, void 0)] }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                            display: "flex",
                            gap: 10,
                            marginTop: 18,
                            justifyContent: "flex-end"
                        } }, { children: [(0, jsx_runtime_1.jsx)(Btn, __assign({ variant: "ghost", onClick: function () { return setShowForm(false); } }, { children: "\u0625\u0644\u063A\u0627\u0621" }), void 0), (0, jsx_runtime_1.jsx)(Btn, __assign({ icon: "check", onClick: save }, { children: editing ? "حفظ التعديل" : "إضافة العميل" }), void 0)] }), void 0)] }), void 0)] }, void 0));
}
// ==================== REPORTS ====================
function Reports(_a) {
    var sales = _a.sales, purchases = _a.purchases, products = _a.products, suppliers = _a.suppliers, customers = _a.customers;
    var _b = (0, react_1.useState)("sales"), type = _b[0], setType = _b[1];
    var _c = (0, react_1.useState)(""), fromDate = _c[0], setFromDate = _c[1];
    var _d = (0, react_1.useState)(new Date().toISOString().split("T")[0]), toDate = _d[0], setToDate = _d[1];
    var _e = (0, react_1.useState)(""), filterSupplier = _e[0], setFilterSupplier = _e[1];
    var _f = (0, react_1.useState)(""), filterProduct = _f[0], setFilterProduct = _f[1];
    var filteredSales = sales.filter(function (s) {
        var d = s.date;
        var ok = true;
        if (fromDate && d < fromDate)
            ok = false;
        if (toDate && d > toDate)
            ok = false;
        if (filterProduct && !s.items.some(function (i) { return i.id === filterProduct; }))
            ok = false;
        return ok;
    });
    var filteredPurchases = purchases.filter(function (p) {
        var d = p.date;
        var ok = true;
        if (fromDate && d < fromDate)
            ok = false;
        if (toDate && d > toDate)
            ok = false;
        if (filterSupplier && p.supplier !== filterSupplier)
            ok = false;
        return ok;
    });
    var salesByMonth = {};
    filteredSales.forEach(function (s) {
        var m = s.date.substring(0, 7);
        if (!salesByMonth[m])
            salesByMonth[m] = { count: 0, subtotal: 0, tax: 0, total: 0 };
        salesByMonth[m].count++;
        salesByMonth[m].subtotal += s.subtotal;
        salesByMonth[m].tax += s.taxAmount;
        salesByMonth[m].total += s.total;
    });
    var productSales = {};
    filteredSales.forEach(function (s) {
        return s.items.forEach(function (i) {
            if (!productSales[i.id])
                productSales[i.id] = { name: i.name, qty: 0, revenue: 0, tax: 0 };
            productSales[i.id].qty += i.qty;
            productSales[i.id].revenue += i.price * i.qty;
            productSales[i.id].tax += i.taxable ? i.price * i.qty * TAX_RATE : 0;
        });
    });
    var totalSalesRev = filteredSales
        .filter(function (s) { return !s.returned; })
        .reduce(function (a, s) { return a + s.total; }, 0);
    var totalSalesTax = filteredSales
        .filter(function (s) { return !s.returned; })
        .reduce(function (a, s) { return a + (s.taxAmount || s.tax_amount || 0); }, 0);
    var returnedCount = filteredSales.filter(function (s) { return s.returned; }).length;
    var totalPurchase = filteredPurchases.reduce(function (a, p) { return a + p.total; }, 0);
    var totalPurchaseTax = filteredPurchases.reduce(function (a, p) { return a + p.taxAmount; }, 0);
    return ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h2", __assign({ style: { margin: "0 0 18px", fontSize: 20, fontWeight: 800 } }, { children: "\u0627\u0644\u062A\u0642\u0627\u0631\u064A\u0631 \u0648\u0627\u0644\u0625\u062D\u0635\u0627\u0626\u064A\u0627\u062A" }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                    display: "flex",
                    gap: 8,
                    marginBottom: 18,
                    flexWrap: "wrap",
                    alignItems: "flex-end"
                } }, { children: [["sales", "purchase", "product", "monthly"].map(function (t) { return ((0, jsx_runtime_1.jsx)("button", __assign({ onClick: function () { return setType(t); }, style: {
                            padding: "8px 18px",
                            borderRadius: 8,
                            border: "1px solid",
                            borderColor: type === t ? "#2a6aef" : "#1d2d4a",
                            background: type === t ? "#142a5a" : "transparent",
                            color: type === t ? "#6aaeff" : "#4a6a8a",
                            fontWeight: type === t ? 700 : 400,
                            cursor: "pointer",
                            fontSize: 13
                        } }, { children: t === "sales"
                            ? "تقرير المبيعات"
                            : t === "purchase"
                                ? "تقرير المشتريات"
                                : t === "product"
                                    ? "تقرير الأصناف"
                                    : "تقرير شهري" }), t)); }), (0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                            marginRight: "auto",
                            display: "flex",
                            gap: 10,
                            alignItems: "center"
                        } }, { children: [(0, jsx_runtime_1.jsx)(Input, { label: "\u0645\u0646", value: fromDate, onChange: setFromDate, type: "date", style: { width: 140 } }, void 0), (0, jsx_runtime_1.jsx)(Input, { label: "\u0625\u0644\u0649", value: toDate, onChange: setToDate, type: "date", style: { width: 140 } }, void 0), type === "purchase" && ((0, jsx_runtime_1.jsx)(Select, { label: "\u0627\u0644\u0645\u0648\u0631\u062F", value: filterSupplier, onChange: setFilterSupplier, options: __spreadArray([
                                    { v: "", l: "الكل" }
                                ], suppliers.map(function (s) { return ({ v: s.id, l: s.name }); }), true), style: { width: 160 } }, void 0)), type === "product" && ((0, jsx_runtime_1.jsx)(Select, { label: "\u0627\u0644\u0635\u0646\u0641", value: filterProduct, onChange: setFilterProduct, options: __spreadArray([
                                    { v: "", l: "الكل" }
                                ], products.map(function (p) { return ({ v: p.id, l: p.name }); }), true), style: { width: 180 } }, void 0))] }), void 0)] }), void 0), type === "sales" && ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                            display: "grid",
                            gridTemplateColumns: "repeat(4,1fr)",
                            gap: 12,
                            marginBottom: 16
                        } }, { children: [(0, jsx_runtime_1.jsx)(StatCard, { label: "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A (\u0634\u0627\u0645\u0644 \u0627\u0644\u0636\u0631\u064A\u0628\u0629)", value: totalSalesRev.toFixed(2) + " ر.س", icon: "money", color: "#3a9aff" }, void 0), (0, jsx_runtime_1.jsx)(StatCard, { label: "\u0636\u0631\u064A\u0628\u0629 \u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A", value: totalSalesTax.toFixed(2) + " ر.س", icon: "tax", color: "#88dd44" }, void 0), (0, jsx_runtime_1.jsx)(StatCard, { label: "\u0639\u062F\u062F \u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631", value: filteredSales.filter(function (s) { return !s.returned; }).length, icon: "pos", color: "#a78bfa" }, void 0), (0, jsx_runtime_1.jsx)(StatCard, { label: "\u0627\u0644\u0645\u0631\u062A\u062C\u0639\u0627\u062A", value: returnedCount, icon: "returns", color: "#ff7744" }, void 0)] }), void 0), (0, jsx_runtime_1.jsx)(Table, { headers: [
                            "رقم الفاتورة",
                            "التاريخ",
                            "العميل",
                            "المجموع",
                            "الضريبة",
                            "الإجمالي شامل الضريبة",
                            "الدفع",
                            "حالة",
                        ], rows: filteredSales.map(function (s) { return [
                            (0, jsx_runtime_1.jsx)("span", __assign({ style: { color: "#6aaeff", fontWeight: 700 } }, { children: s.id }), void 0),
                            s.date,
                            s.customerName || "زبون عادي",
                            (s.subtotal || 0).toFixed(2) + " ر.س",
                            (0, jsx_runtime_1.jsxs)("span", __assign({ style: { color: "#88dd44" } }, { children: [(s.taxAmount || s.tax_amount || 0).toFixed(2), " \u0631.\u0633"] }), void 0),
                            (0, jsx_runtime_1.jsxs)("span", __assign({ style: { color: "#3a9aff", fontWeight: 700 } }, { children: [(s.total || 0).toFixed(2), " \u0631.\u0633"] }), void 0),
                            s.payment,
                            s.returned ? ((0, jsx_runtime_1.jsx)(Badge, __assign({ color: "#3a0a0a", text: "#ff7777" }, { children: "\u0645\u0631\u062A\u062C\u0639\u0629" }), void 0)) : ((0, jsx_runtime_1.jsx)(Badge, __assign({ color: "#0a2a10", text: "#44dd88" }, { children: "\u0645\u0643\u062A\u0645\u0644\u0629" }), void 0)),
                        ]; }) }, void 0)] }, void 0)), type === "purchase" && ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                            display: "grid",
                            gridTemplateColumns: "repeat(3,1fr)",
                            gap: 12,
                            marginBottom: 16
                        } }, { children: [(0, jsx_runtime_1.jsx)(StatCard, { label: "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0645\u0634\u062A\u0631\u064A\u0627\u062A (\u0634\u0627\u0645\u0644 \u0627\u0644\u0636\u0631\u064A\u0628\u0629)", value: totalPurchase.toFixed(2) + " ر.س", icon: "purchase", color: "#fb923c" }, void 0), (0, jsx_runtime_1.jsx)(StatCard, { label: "\u0636\u0631\u064A\u0628\u0629 \u0627\u0644\u0645\u0634\u062A\u0631\u064A\u0627\u062A", value: totalPurchaseTax.toFixed(2) + " ر.س", icon: "tax", color: "#88dd44" }, void 0), (0, jsx_runtime_1.jsx)(StatCard, { label: "\u0639\u062F\u062F \u0623\u0648\u0627\u0645\u0631 \u0627\u0644\u0634\u0631\u0627\u0621", value: filteredPurchases.length, icon: "suppliers", color: "#a78bfa" }, void 0)] }), void 0), (0, jsx_runtime_1.jsx)(Table, { headers: [
                            "رقم الأمر",
                            "التاريخ",
                            "المورد",
                            "المجموع",
                            "الضريبة",
                            "الإجمالي",
                            "الحالة",
                        ], rows: filteredPurchases.map(function (p) { return [
                            (0, jsx_runtime_1.jsx)("span", __assign({ style: { color: "#6aaeff", fontWeight: 700 } }, { children: p.id }), void 0),
                            p.date,
                            p.supplierName,
                            p.subtotal.toFixed(2) + " ر.س",
                            (0, jsx_runtime_1.jsxs)("span", __assign({ style: { color: "#88dd44" } }, { children: [p.taxAmount.toFixed(2), " \u0631.\u0633"] }), void 0),
                            (0, jsx_runtime_1.jsxs)("span", __assign({ style: { color: "#fb923c", fontWeight: 700 } }, { children: [p.total.toFixed(2), " \u0631.\u0633"] }), void 0),
                            (0, jsx_runtime_1.jsx)(Badge, __assign({ color: "#0a2a10", text: "#44dd88" }, { children: p.status }), void 0),
                        ]; }) }, void 0)] }, void 0)), type === "product" && ((0, jsx_runtime_1.jsx)(Table, { headers: [
                    "الصنف",
                    "الكمية المباعة",
                    "الإيراد قبل الضريبة",
                    "الضريبة",
                    "الإيراد الكلي",
                ], rows: Object.entries(productSales)
                    .sort(function (a, b) { return b[1].revenue - a[1].revenue; })
                    .map(function (_a) {
                    var id = _a[0], d = _a[1];
                    return [
                        (0, jsx_runtime_1.jsx)("span", __assign({ style: { fontWeight: 700, color: "#dde8ff" } }, { children: d.name }), void 0),
                        (0, jsx_runtime_1.jsx)("span", __assign({ style: { color: "#3a9aff", fontWeight: 700 } }, { children: d.qty }), void 0),
                        d.revenue.toFixed(2) + " ر.س",
                        (0, jsx_runtime_1.jsxs)("span", __assign({ style: { color: "#88dd44" } }, { children: [d.tax.toFixed(2), " \u0631.\u0633"] }), void 0),
                        (0, jsx_runtime_1.jsxs)("span", __assign({ style: { color: "#44dd88", fontWeight: 700 } }, { children: [(d.revenue + d.tax).toFixed(2), " \u0631.\u0633"] }), void 0),
                    ];
                }) }, void 0)), type === "monthly" && ((0, jsx_runtime_1.jsx)(Table, { headers: [
                    "الشهر",
                    "عدد الفواتير",
                    "المبيعات قبل الضريبة",
                    "ضريبة المبيعات",
                    "المبيعات الكلية",
                ], rows: Object.entries(salesByMonth)
                    .sort()
                    .reverse()
                    .map(function (_a) {
                    var m = _a[0], d = _a[1];
                    return [
                        (0, jsx_runtime_1.jsx)("span", __assign({ style: { fontWeight: 700, color: "#dde8ff" } }, { children: m }), void 0),
                        d.count,
                        d.subtotal.toFixed(2) + " ر.س",
                        (0, jsx_runtime_1.jsxs)("span", __assign({ style: { color: "#88dd44" } }, { children: [d.tax.toFixed(2), " \u0631.\u0633"] }), void 0),
                        (0, jsx_runtime_1.jsxs)("span", __assign({ style: { color: "#3a9aff", fontWeight: 700 } }, { children: [d.total.toFixed(2), " \u0631.\u0633"] }), void 0),
                    ];
                }) }, void 0))] }, void 0));
}
// ==================== TAX REPORT ====================
function TaxReport(_a) {
    var sales = _a.sales, purchases = _a.purchases;
    var _b = (0, react_1.useState)("Q2-2026"), quarter = _b[0], setQuarter = _b[1];
    var quarters = [
        "Q1-2026",
        "Q2-2026",
        "Q3-2026",
        "Q4-2026",
        "Q1-2025",
        "Q2-2025",
    ];
    var qMap = {
        Q1: "01,02,03",
        Q2: "04,05,06",
        Q3: "07,08,09",
        Q4: "10,11,12"
    };
    var _c = quarter.split("-"), q = _c[0], year = _c[1];
    var months = qMap[q].split(",").map(function (m) { return year + "-" + m; });
    var filtSales = sales.filter(function (s) { return months.some(function (m) { return s.date.startsWith(m); }) && !s.returned; });
    var filtPurchases = purchases.filter(function (p) {
        return months.some(function (m) { return p.date.startsWith(m); });
    });
    var salesSubtotal = filtSales.reduce(function (a, s) { return a + s.subtotal; }, 0);
    var salesTax = filtSales.reduce(function (a, s) { return a + s.taxAmount; }, 0);
    var salesTotal = filtSales.reduce(function (a, s) { return a + s.total; }, 0);
    var purchSubtotal = filtPurchases.reduce(function (a, p) { return a + p.subtotal; }, 0);
    var purchTax = filtPurchases.reduce(function (a, p) { return a + p.taxAmount; }, 0);
    var purchTotal = filtPurchases.reduce(function (a, p) { return a + p.total; }, 0);
    var netTax = salesTax - purchTax;
    return ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h2", __assign({ style: { margin: "0 0 18px", fontSize: 20, fontWeight: 800 } }, { children: "\u062A\u0642\u0631\u064A\u0631 \u0636\u0631\u064A\u0628\u0629 \u0627\u0644\u0642\u064A\u0645\u0629 \u0627\u0644\u0645\u0636\u0627\u0641\u0629 \u2014 \u0631\u0628\u0639 \u0633\u0646\u0648\u064A" }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                    display: "flex",
                    gap: 12,
                    marginBottom: 22,
                    alignItems: "center"
                } }, { children: [(0, jsx_runtime_1.jsx)(Select, { label: "\u0627\u0644\u0631\u0628\u0639 \u0627\u0644\u0633\u0646\u0648\u064A", value: quarter, onChange: setQuarter, options: quarters.map(function (q) { return ({ v: q, l: "\u0627\u0644\u0631\u0628\u0639 " + q }); }), style: { width: 200 } }, void 0), (0, jsx_runtime_1.jsx)("div", __assign({ style: { color: "#3a5a8a", fontSize: 13, marginTop: 20 } }, { children: "\u0646\u0633\u0628\u0629 \u0627\u0644\u0636\u0631\u064A\u0628\u0629: 15% (VAT)" }), void 0)] }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                    marginBottom: 20
                } }, { children: [(0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                            background: "#0f1623",
                            border: "1px solid #1a3a1a",
                            borderRadius: 14,
                            padding: 20
                        } }, { children: [(0, jsx_runtime_1.jsxs)("h3", __assign({ style: {
                                    margin: "0 0 16px",
                                    fontSize: 15,
                                    fontWeight: 700,
                                    color: "#44dd88",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8
                                } }, { children: [(0, jsx_runtime_1.jsx)(IC, { n: "pos", s: 16 }, void 0), "\u0636\u0631\u064A\u0628\u0629 \u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A (\u0627\u0644\u0636\u0631\u064A\u0628\u0629 \u0627\u0644\u0645\u062D\u0635\u0644\u0629)"] }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: { display: "flex", flexDirection: "column", gap: 10 } }, { children: [(0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                                            display: "flex",
                                            justifyContent: "space-between",
                                            color: "#6a8aaa"
                                        } }, { children: [(0, jsx_runtime_1.jsx)("span", { children: "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A \u0642\u0628\u0644 \u0627\u0644\u0636\u0631\u064A\u0628\u0629" }, void 0), (0, jsx_runtime_1.jsxs)("span", __assign({ style: { fontWeight: 700 } }, { children: [salesSubtotal.toFixed(2), " \u0631.\u0633"] }), void 0)] }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                                            display: "flex",
                                            justifyContent: "space-between",
                                            color: "#88dd44"
                                        } }, { children: [(0, jsx_runtime_1.jsx)("span", { children: "\u0636\u0631\u064A\u0628\u0629 \u0627\u0644\u0642\u064A\u0645\u0629 \u0627\u0644\u0645\u0636\u0627\u0641\u0629 (15%)" }, void 0), (0, jsx_runtime_1.jsxs)("span", __assign({ style: { fontWeight: 700 } }, { children: [salesTax.toFixed(2), " \u0631.\u0633"] }), void 0)] }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                                            display: "flex",
                                            justifyContent: "space-between",
                                            color: "#dde8ff",
                                            fontWeight: 800,
                                            borderTop: "1px solid #1d3a1d",
                                            paddingTop: 10
                                        } }, { children: [(0, jsx_runtime_1.jsx)("span", { children: "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A \u0634\u0627\u0645\u0644 \u0627\u0644\u0636\u0631\u064A\u0628\u0629" }, void 0), (0, jsx_runtime_1.jsxs)("span", { children: [salesTotal.toFixed(2), " \u0631.\u0633"] }, void 0)] }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: { color: "#3a6a3a", fontSize: 12 } }, { children: ["\u0639\u062F\u062F \u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631: ", filtSales.length] }), void 0)] }), void 0)] }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                            background: "#0f1623",
                            border: "1px solid #1a2a3a",
                            borderRadius: 14,
                            padding: 20
                        } }, { children: [(0, jsx_runtime_1.jsxs)("h3", __assign({ style: {
                                    margin: "0 0 16px",
                                    fontSize: 15,
                                    fontWeight: 700,
                                    color: "#6aaeff",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8
                                } }, { children: [(0, jsx_runtime_1.jsx)(IC, { n: "purchase", s: 16 }, void 0), "\u0636\u0631\u064A\u0628\u0629 \u0627\u0644\u0645\u0634\u062A\u0631\u064A\u0627\u062A (\u0636\u0631\u064A\u0628\u0629 \u0627\u0644\u0645\u062F\u062E\u0644\u0627\u062A)"] }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: { display: "flex", flexDirection: "column", gap: 10 } }, { children: [(0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                                            display: "flex",
                                            justifyContent: "space-between",
                                            color: "#6a8aaa"
                                        } }, { children: [(0, jsx_runtime_1.jsx)("span", { children: "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0645\u0634\u062A\u0631\u064A\u0627\u062A \u0642\u0628\u0644 \u0627\u0644\u0636\u0631\u064A\u0628\u0629" }, void 0), (0, jsx_runtime_1.jsxs)("span", __assign({ style: { fontWeight: 700 } }, { children: [purchSubtotal.toFixed(2), " \u0631.\u0633"] }), void 0)] }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                                            display: "flex",
                                            justifyContent: "space-between",
                                            color: "#6aaeff"
                                        } }, { children: [(0, jsx_runtime_1.jsx)("span", { children: "\u0636\u0631\u064A\u0628\u0629 \u0627\u0644\u0642\u064A\u0645\u0629 \u0627\u0644\u0645\u0636\u0627\u0641\u0629 (15%)" }, void 0), (0, jsx_runtime_1.jsxs)("span", __assign({ style: { fontWeight: 700 } }, { children: [purchTax.toFixed(2), " \u0631.\u0633"] }), void 0)] }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                                            display: "flex",
                                            justifyContent: "space-between",
                                            color: "#dde8ff",
                                            fontWeight: 800,
                                            borderTop: "1px solid #1d2d4a",
                                            paddingTop: 10
                                        } }, { children: [(0, jsx_runtime_1.jsx)("span", { children: "\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0645\u0634\u062A\u0631\u064A\u0627\u062A \u0634\u0627\u0645\u0644 \u0627\u0644\u0636\u0631\u064A\u0628\u0629" }, void 0), (0, jsx_runtime_1.jsxs)("span", { children: [purchTotal.toFixed(2), " \u0631.\u0633"] }, void 0)] }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: { color: "#3a5a7a", fontSize: 12 } }, { children: ["\u0639\u062F\u062F \u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631: ", filtPurchases.length] }), void 0)] }), void 0)] }), void 0)] }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                    background: netTax > 0 ? "#0a1a0a" : "#1a0a0a",
                    border: "2px solid " + (netTax > 0 ? "#1a6a1a" : "#6a1a1a"),
                    borderRadius: 16,
                    padding: 24
                } }, { children: [(0, jsx_runtime_1.jsxs)("h3", __assign({ style: {
                            margin: "0 0 16px",
                            fontSize: 16,
                            fontWeight: 800,
                            color: netTax > 0 ? "#44dd88" : "#ff7777"
                        } }, { children: [netTax > 0 ? "✔ ضريبة مستحقة الدفع" : "✔ ضريبة مستردة", " \u2014 ", quarter] }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                            display: "grid",
                            gridTemplateColumns: "repeat(3,1fr)",
                            gap: 16
                        } }, { children: [(0, jsx_runtime_1.jsxs)("div", __assign({ style: { textAlign: "center" } }, { children: [(0, jsx_runtime_1.jsx)("div", __assign({ style: { color: "#6a8aaa", fontSize: 13 } }, { children: "\u0636\u0631\u064A\u0628\u0629 \u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A" }), void 0), (0, jsx_runtime_1.jsx)("div", __assign({ style: {
                                            color: "#44dd88",
                                            fontSize: 22,
                                            fontWeight: 800,
                                            marginTop: 4
                                        } }, { children: salesTax.toFixed(2) }), void 0)] }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: { textAlign: "center" } }, { children: [(0, jsx_runtime_1.jsx)("div", __assign({ style: { color: "#6a8aaa", fontSize: 13 } }, { children: "\u0636\u0631\u064A\u0628\u0629 \u0627\u0644\u0645\u0634\u062A\u0631\u064A\u0627\u062A" }), void 0), (0, jsx_runtime_1.jsx)("div", __assign({ style: {
                                            color: "#6aaeff",
                                            fontSize: 22,
                                            fontWeight: 800,
                                            marginTop: 4
                                        } }, { children: purchTax.toFixed(2) }), void 0)] }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: { textAlign: "center" } }, { children: [(0, jsx_runtime_1.jsx)("div", __assign({ style: { color: "#6a8aaa", fontSize: 13 } }, { children: "\u0635\u0627\u0641\u064A \u0627\u0644\u0636\u0631\u064A\u0628\u0629" }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                                            color: netTax > 0 ? "#44dd88" : "#ff7777",
                                            fontSize: 28,
                                            fontWeight: 900,
                                            marginTop: 4
                                        } }, { children: [netTax.toFixed(2), " \u0631.\u0633"] }), void 0)] }), void 0)] }), void 0), (0, jsx_runtime_1.jsx)("div", __assign({ style: {
                            marginTop: 16,
                            padding: "12px 16px",
                            background: "rgba(0,0,0,0.2)",
                            borderRadius: 10,
                            color: "#6a8aaa",
                            fontSize: 13
                        } }, { children: netTax > 0
                            ? "\u064A\u062C\u0628 \u062A\u062D\u0648\u064A\u0644 \u0645\u0628\u0644\u063A " + netTax.toFixed(2) + " \u0631.\u0633 \u0625\u0644\u0649 \u0647\u064A\u0626\u0629 \u0627\u0644\u0632\u0643\u0627\u0629 \u0648\u0627\u0644\u0636\u0631\u064A\u0628\u0629 \u0648\u0627\u0644\u062C\u0645\u0627\u0631\u0643 \u0639\u0646 \u0627\u0644\u0631\u0628\u0639 " + quarter
                            : "\u064A\u062D\u0642 \u0627\u0633\u062A\u0631\u062F\u0627\u062F \u0645\u0628\u0644\u063A " + Math.abs(netTax).toFixed(2) + " \u0631.\u0633 \u0645\u0646 \u0647\u064A\u0626\u0629 \u0627\u0644\u0632\u0643\u0627\u0629 \u0648\u0627\u0644\u0636\u0631\u064A\u0628\u0629 \u0648\u0627\u0644\u062C\u0645\u0627\u0631\u0643 \u0639\u0646 \u0627\u0644\u0631\u0628\u0639 " + quarter }), void 0)] }), void 0)] }, void 0));
}
// ==================== SHIFT MODULE ====================
function ShiftModule(_a) {
    var shifts = _a.shifts, setShifts = _a.setShifts, sales = _a.sales, currentUser = _a.currentUser, showToast = _a.showToast;
    var _b = (0, react_1.useState)("500"), openCash = _b[0], setOpenCash = _b[1];
    var _c = (0, react_1.useState)(""), closeCash = _c[0], setCloseCash = _c[1];
    var _d = (0, react_1.useState)(""), notes = _d[0], setNotes = _d[1];
    var currentShift = shifts.find(function (s) { return !s.end && s.user === currentUser.name; });
    var shiftSales = currentShift
        ? sales.filter(function (s) { return s.shift === currentShift.id; })
        : [];
    var shiftRevenue = shiftSales.reduce(function (a, s) { return a + s.total; }, 0);
    var openShift = function () {
        if (currentShift) {
            showToast("يوجد شفت مفتوح بالفعل", "warn");
            return;
        }
        var sh = {
            id: "SH-" + String(shifts.length + 1).padStart(3, "0"),
            user: currentUser.name,
            role: currentUser.role,
            start: new Date().toLocaleString("ar-SA"),
            end: null,
            openCash: +openCash,
            closeCash: null,
            sales: 0,
            notes: ""
        };
        setShifts(function (p) { return __spreadArray(__spreadArray([], p, true), [sh], false); });
        showToast("تم فتح الشفت ✓");
    };
    var closeShift = function () {
        if (!closeCash) {
            showToast("يرجى إدخال النقد الفعلي عند الإغلاق", "error");
            return;
        }
        setShifts(function (p) {
            return p.map(function (s) {
                return s.id === currentShift.id
                    ? __assign(__assign({}, s), { end: new Date().toLocaleString("ar-SA"), closeCash: +closeCash, sales: shiftRevenue, notes: notes }) : s;
            });
        });
        showToast("تم إغلاق الشفت وتسليمه ✓");
    };
    return ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("h2", __assign({ style: { margin: "0 0 18px", fontSize: 20, fontWeight: 800 } }, { children: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0634\u0641\u062A\u0627\u062A" }), void 0), !currentShift ? ((0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                    background: "#0f1623",
                    border: "1px solid #1d2d4a",
                    borderRadius: 14,
                    padding: 24,
                    marginBottom: 20,
                    maxWidth: 480
                } }, { children: [(0, jsx_runtime_1.jsx)("h3", __assign({ style: {
                            margin: "0 0 16px",
                            fontSize: 16,
                            fontWeight: 700,
                            color: "#dde8ff"
                        } }, { children: "\u0641\u062A\u062D \u0634\u0641\u062A \u062C\u062F\u064A\u062F" }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: { display: "flex", flexDirection: "column", gap: 12 } }, { children: [(0, jsx_runtime_1.jsx)(Input, { label: "\u0627\u0644\u0646\u0642\u062F \u0627\u0644\u0627\u0641\u062A\u062A\u0627\u062D\u064A (\u0631.\u0633)", value: openCash, onChange: setOpenCash, type: "number", placeholder: "500" }, void 0), (0, jsx_runtime_1.jsx)(Btn, __assign({ icon: "shift", onClick: openShift, size: "lg" }, { children: "\u0641\u062A\u062D \u0627\u0644\u0634\u0641\u062A" }), void 0)] }), void 0)] }), void 0)) : ((0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                    background: "#0a1a0a",
                    border: "1px solid #1a5a1a",
                    borderRadius: 14,
                    padding: 24,
                    marginBottom: 20,
                    maxWidth: 520
                } }, { children: [(0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 16
                        } }, { children: [(0, jsx_runtime_1.jsx)("h3", __assign({ style: {
                                    margin: 0,
                                    fontSize: 16,
                                    fontWeight: 700,
                                    color: "#44dd88"
                                } }, { children: "\u0634\u0641\u062A \u0645\u0641\u062A\u0648\u062D \u2713" }), void 0), (0, jsx_runtime_1.jsx)(Badge, __assign({ color: "#0a3a0a", text: "#44dd88" }, { children: currentShift.id }), void 0)] }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 12,
                            marginBottom: 16
                        } }, { children: [(0, jsx_runtime_1.jsxs)("div", __assign({ style: { background: "#080e14", borderRadius: 8, padding: 12 } }, { children: [(0, jsx_runtime_1.jsx)("div", __assign({ style: { color: "#3a6a3a", fontSize: 11 } }, { children: "\u0628\u062F\u0627\u064A\u0629 \u0627\u0644\u0634\u0641\u062A" }), void 0), (0, jsx_runtime_1.jsx)("div", __assign({ style: { color: "#dde8ff", fontSize: 13, marginTop: 4 } }, { children: currentShift.start }), void 0)] }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: { background: "#080e14", borderRadius: 8, padding: 12 } }, { children: [(0, jsx_runtime_1.jsx)("div", __assign({ style: { color: "#3a6a3a", fontSize: 11 } }, { children: "\u0627\u0644\u0646\u0642\u062F \u0627\u0644\u0627\u0641\u062A\u062A\u0627\u062D\u064A" }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                                            color: "#44dd88",
                                            fontSize: 16,
                                            fontWeight: 700,
                                            marginTop: 2
                                        } }, { children: [currentShift.openCash, " \u0631.\u0633"] }), void 0)] }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: { background: "#080e14", borderRadius: 8, padding: 12 } }, { children: [(0, jsx_runtime_1.jsx)("div", __assign({ style: { color: "#3a6a3a", fontSize: 11 } }, { children: "\u0645\u0628\u064A\u0639\u0627\u062A \u0627\u0644\u0634\u0641\u062A" }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                                            color: "#3a9aff",
                                            fontSize: 16,
                                            fontWeight: 700,
                                            marginTop: 2
                                        } }, { children: [shiftRevenue.toFixed(2), " \u0631.\u0633"] }), void 0)] }), void 0), (0, jsx_runtime_1.jsxs)("div", __assign({ style: { background: "#080e14", borderRadius: 8, padding: 12 } }, { children: [(0, jsx_runtime_1.jsx)("div", __assign({ style: { color: "#3a6a3a", fontSize: 11 } }, { children: "\u0639\u062F\u062F \u0627\u0644\u0641\u0648\u0627\u062A\u064A\u0631" }), void 0), (0, jsx_runtime_1.jsx)("div", __assign({ style: {
                                            color: "#a78bfa",
                                            fontSize: 16,
                                            fontWeight: 700,
                                            marginTop: 2
                                        } }, { children: shiftSales.length }), void 0)] }), void 0)] }), void 0), (0, jsx_runtime_1.jsx)(Input, { label: "\u0627\u0644\u0646\u0642\u062F \u0627\u0644\u0641\u0639\u0644\u064A \u0639\u0646\u062F \u0627\u0644\u0625\u063A\u0644\u0627\u0642 (\u0631.\u0633)", value: closeCash, onChange: setCloseCash, type: "number", placeholder: "0" }, void 0), (0, jsx_runtime_1.jsx)(Input, { label: "\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u062A\u0633\u0644\u064A\u0645 \u0627\u0644\u0634\u0641\u062A", value: notes, onChange: setNotes, placeholder: "\u0623\u064A \u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0639\u0646\u062F \u0627\u0644\u062A\u0633\u0644\u064A\u0645...", style: { marginTop: 10 } }, void 0), closeCash && ((0, jsx_runtime_1.jsxs)("div", __assign({ style: {
                            margin: "10px 0",
                            padding: "10px 14px",
                            background: "#080e14",
                            borderRadius: 8,
                            color: "#ffaa44",
                            fontSize: 13
                        } }, { children: ["\u0641\u0631\u0642 \u0627\u0644\u0646\u0642\u062F:", " ", (+closeCash - currentShift.openCash - shiftRevenue).toFixed(2), " ", "\u0631.\u0633"] }), void 0)), (0, jsx_runtime_1.jsx)(Btn, __assign({ icon: "check", variant: "success", onClick: closeShift, size: "lg", style: { marginTop: 10, width: "100%", justifyContent: "center" } }, { children: "\u0625\u063A\u0644\u0627\u0642 \u0648\u062A\u0633\u0644\u064A\u0645 \u0627\u0644\u0634\u0641\u062A" }), void 0)] }), void 0)), (0, jsx_runtime_1.jsx)(Table, { headers: [
                    "رقم الشفت",
                    "الموظف",
                    "البداية",
                    "النهاية",
                    "النقد الافتتاحي",
                    "المبيعات",
                    "النقد الختامي",
                    "الحالة",
                ], rows: __spreadArray([], shifts, true).reverse().map(function (s) { return [
                    (0, jsx_runtime_1.jsx)("span", __assign({ style: { color: "#6aaeff", fontWeight: 700 } }, { children: s.id }), void 0),
                    s.user,
                    s.start,
                    s.end || "-",
                    s.openCash + " ر.س",
                    (0, jsx_runtime_1.jsxs)("span", __assign({ style: { color: "#3a9aff", fontWeight: 700 } }, { children: [(s.sales || 0).toFixed(2), " \u0631.\u0633"] }), void 0),
                    s.closeCash ? s.closeCash + " ر.س" : "-",
                    s.end ? ((0, jsx_runtime_1.jsx)(Badge, __assign({ color: "#0a2a10", text: "#44dd88" }, { children: "\u0645\u063A\u0644\u0642" }), void 0)) : ((0, jsx_runtime_1.jsx)(Badge, __assign({ color: "#0a2a1a", text: "#44ffaa" }, { children: "\u0645\u0641\u062A\u0648\u062D" }), void 0)),
                ]; }) }, void 0)] }, void 0));
}
