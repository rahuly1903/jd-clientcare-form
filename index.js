require("dotenv").config();

const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");

const app = express();
const port = process.env.PORT || 4000;

const SENDER = process.env.SENDER || "clientcare@jeandousset.com";
const RECEIVER = process.env.RECEIVER || "clientcare@jeandousset.com";
const DEFAULT_ORIGINS = [
  "https://jeandousset.com",
  "https://www.jeandousset.com",
];
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || DEFAULT_ORIGINS.join(","))
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

const SALES_ADVISORS = [
  "Jessica",
  "Sara",
  "Kadidja",
  "Courtney",
  "Jordan",
  "Kristy",
  "Dylan",
  "Lilie",
  "Jane",
  "Charman",
  "Chanda",
  "Yorlan",
  "Alexandra",
];

const STORES = [
  "Westfield Valley Fair",
  "West Hollywood",
  "Soho NY Store",
];

const FIELD_LABELS = {
  salesAdvisor: "Sales Advisor",
  store: "Store",
  name: "Name",
  phone: "Phone",
  email: "Email",
  productNames: "Product Name(s)",
  variants: "Variant(s)",
  metal: "Precious Metal",
  ringSizes: "Ring Sizes",
  occasion: "Occasion / Timeline",
  favorites: "Favorites",
  notes: "Notes",
};

app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(express.json({ limit: "1mb" }));
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, false);
        return;
      }
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed"));
    },
    methods: ["POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
    optionsSuccessStatus: 200,
  })
);

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: SENDER,
    pass: process.env.PASSWORD,
  },
});

function normalizeOrigin(value) {
  if (!value) return "";
  try {
    return new URL(value).origin;
  } catch (error) {
    return "";
  }
}

function isAllowedOrigin(value) {
  const origin = normalizeOrigin(value);
  return Boolean(origin) && ALLOWED_ORIGINS.includes(origin);
}

function requestOrigin(req) {
  return req.get("origin") || req.get("referer") || "";
}

function requireJeanDoussetOrigin(req, res, next) {
  const origin = requestOrigin(req);
  if (!isAllowedOrigin(origin)) {
    res.status(403).json({
      ok: false,
      msg: "Requests are only accepted from https://jeandousset.com/",
    });
    return;
  }
  next();
}

function trimValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function pickFormData(body) {
  return {
    salesAdvisor: trimValue(body.salesAdvisor || body["Select Sales Advisor"]),
    store: trimValue(body.store || body["Select Store"] || body["Select  Store"]),
    name: trimValue(body.name),
    phone: trimValue(body.phone),
    email: trimValue(body.email),
    productNames: trimValue(body.productNames || body["product-field"]),
    variants: trimValue(body.variants || body.variant),
    metal: trimValue(body.metal),
    ringSizes: trimValue(body.ringSizes || body["ring-size"]),
    occasion: trimValue(body.occasion),
    favorites: trimValue(body.favorites),
    notes: trimValue(body.notes),
  };
}

function validateForm(data) {
  const errors = [];

  if (!data.salesAdvisor) {
    errors.push("Please select a sales advisor.");
  } else if (!SALES_ADVISORS.includes(data.salesAdvisor)) {
    errors.push("Please select a valid sales advisor.");
  }

  if (!data.store) {
    errors.push("Please select a store.");
  } else if (!STORES.includes(data.store)) {
    errors.push("Please select a valid store.");
  }

  return errors;
}

function buildEmailHtml(data) {
  const rows = Object.keys(FIELD_LABELS)
    .map((key) => {
      const value = data[key] ? escapeHtml(data[key]).replace(/\n/g, "<br>") : "—";
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600;vertical-align:top;white-space:nowrap;">${FIELD_LABELS[key]}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${value}</td>
      </tr>`;
    })
    .join("");

  return `
    <div style="font-family:Arial,sans-serif;color:#222;max-width:640px;">
      <h2 style="margin:0 0 16px;">New Sales Collateral Request</h2>
      <table style="border-collapse:collapse;width:100%;font-size:14px;">
        ${rows}
      </table>
    </div>
  `;
}

app.get("/", (req, res) => {
  res.json({ msg: "JD Client Care form API" });
});

app.post("/api/v1/sales-collateral", requireJeanDoussetOrigin, async (req, res) => {
  const data = pickFormData(req.body || {});
  // console.log(data);
  const errors = validateForm(data);

  if (errors.length) {
    res.status(400).json({ ok: false, msg: errors[0], errors });
    return;
  }

  if (!process.env.PASSWORD) {
    res.status(500).json({ ok: false, msg: "Mailer is not configured." });
    return;
  }

  const clientName = data.name || "New client";
  const mailOptions = {
    from: SENDER,
    to: RECEIVER,
    subject: `Sales Collateral — ${data.salesAdvisor} / ${data.store} — ${clientName}`,
    html: buildEmailHtml(data),
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ ok: true, msg: "Mail sent successfully" });
  } catch (error) {
    console.error("Sales collateral mail error:", error);
    res.status(500).json({ ok: false, msg: "Error sending mail" });
  }
});

app.use((err, req, res, next) => {
  if (err && err.message === "Origin not allowed") {
    res.status(403).json({
      ok: false,
      msg: "Requests are only accepted from https://jeandousset.com/",
    });
    return;
  }
  next(err);
});

app.listen(port, () => {
  console.log(`JD Client Care form API running on port ${port}`);
});
