const path = require("path");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { findUserByEmail, createUser } = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "replace-this-in-production";

app.use(express.json());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (origin.startsWith("chrome-extension://")) return callback(null, true);

      const allowedOrigins = ["http://localhost:3000", "http://127.0.0.1:3000"];
      if (allowedOrigins.includes(origin)) return callback(null, true);

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.static(path.join(__dirname, "public")));

function createToken(user) {
  return jwt.sign({ email: user.email }, JWT_SECRET, { expiresIn: "7d" });
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : "";

  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

app.post("/api/auth/register", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  if (findUserByEmail(email)) {
    return res.status(409).json({ error: "User already exists" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  createUser({
    email,
    passwordHash,
    createdAt: new Date().toISOString(),
  });

  return res.status(201).json({ message: "User registered successfully" });
});

app.post("/api/auth/login", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");

  const user = findUserByEmail(email);
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = createToken(user);
  return res.json({ token, user: { email: user.email } });
});

app.get("/api/auth/verify", authMiddleware, (req, res) => {
  return res.json({ valid: true, user: { email: req.user.email } });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Auth server running on http://localhost:${PORT}`);
});
