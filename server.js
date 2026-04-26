const Fastify = require("fastify");
const axios = require("axios");
const cors = require("@fastify/cors");

const app = Fastify({ logger: false });

// ⚠️ Render dùng PORT này
const PORT = process.env.PORT || 3000;

// API gốc
const API_URL = "https://wtxmd52.tele68.com/v1/txmd5/lite-sessions?cp=R&cl=R&pf=web&at=ee2d066f9a42e456cbd7f1ca034b88ea";

// cache
let cacheData = null;
let lastFetch = 0;
const CACHE_TIME = 5000; // 5s

/* ================= AI ================= */

function getStreak(data) {
    let streak = 1;
    for (let i = 1; i < data.length; i++) {
        if (data[i].resultTruyenThong === data[0].resultTruyenThong) {
            streak++;
        } else break;
    }
    return streak;
}

function detectPattern(data) {
    let results = data.slice(0, 6).map(i => i.resultTruyenThong);

    let zigzag = true;
    for (let i = 1; i < results.length; i++) {
        if (results[i] === results[i - 1]) {
            zigzag = false;
            break;
        }
    }

    if (zigzag) return "Cầu 1-1 (ZigZag)";
    if (results.every(r => r === "TAI")) return "Bệt TÀI";
    if (results.every(r => r === "XIU")) return "Bệt XỈU";

    return "Ngẫu nhiên";
}

function predict(data) {
    let streak = getStreak(data);
    let last = data[0].resultTruyenThong;

    let prediction = "TAI";
    let confidence = 50;
    let reason = "";

    if (streak >= 3) {
        prediction = last === "TAI" ? "XIU" : "TAI";
        confidence = 70;
        reason = "Đảo cầu sau bệt";
    } else {
        prediction = last === "TAI" ? "XIU" : "TAI";
        confidence = 60;
        reason = "Cầu đổi cơ bản";
    }

    let pattern = detectPattern(data);

    if (pattern.includes("ZigZag")) {
        prediction = last === "TAI" ? "XIU" : "TAI";
        confidence = 75;
        reason = "Cầu 1-1";
    }

    return {
        duDoan: prediction,
        doTinCay: confidence,
        lyDo: reason,
        cau: pattern,
        streak
    };
}

/* ================= ROUTES ================= */

// check server sống
app.get("/", async (req, reply) => {
    return {
        status: "OK",
        message: "API Tài Xỉu MD5 đang chạy 🚀"
    };
});

// API chính
app.get("/taixiumd5", async (req, reply) => {
    try {
        const now = Date.now();

        // dùng cache nếu chưa hết hạn
        if (cacheData && now - lastFetch < CACHE_TIME) {
            return cacheData;
        }

        const res = await axios.get(API_URL, { timeout: 5000 });
        const data = res.data;

        let list = data.list || [];

        if (!list.length) {
            throw new Error("Không có dữ liệu");
        }

        let ai = predict(list);

        const result = {
            status: true,
            phienGanNhat: list[0]?.id,
            ketQuaGanNhat: list[0]?.resultTruyenThong,
            xucXac: list[0]?.dices,
            tong: list[0]?.point,

            // AI
            duDoan: ai.duDoan,
            doTinCay: ai.doTinCay + "%",
            lyDo: ai.lyDo,
            cau: ai.cau,
            chuoi: ai.streak,

            // thống kê
            thongKe: data.typeStat,

            // lịch sử
            lichSu: list.slice(0, 20),

            // dòng thêm
            doanhtung: "API Tài Xỉu MD5 VIP - By Văn Minh"
        };

        // lưu cache
        cacheData = result;
        lastFetch = now;

        return result;

    } catch (err) {
        return {
            status: false,
            message: "Lỗi lấy dữ liệu API",
            error: err.message
        };
    }
});

/* ================= START ================= */

app.register(cors, { origin: true });

app.listen({ port: PORT, host: "0.0.0.0" })
    .then(() => {
        console.log("🚀 Server chạy tại port " + PORT);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
