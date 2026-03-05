import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use .default if it exists (common in some ESM environments)
const DB = (Database as any).default || Database;
const db = new DB("safeguard.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    type TEXT, -- 'text', 'image', 'audio'
    category TEXT,
    severity TEXT,
    content TEXT,
    status TEXT, -- 'blocked', 'allowed'
    feedback TEXT -- 'safe', 'unsafe', NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS screen_time (
    date TEXT PRIMARY KEY,
    minutes INTEGER DEFAULT 0
  );

  INSERT OR IGNORE INTO settings (key, value) VALUES ('sensitivity', 'Medium');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('alert_email', '');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('age_limit', '12');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('allowed_categories', '["Education", "Entertainment", "Games"]');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('screen_time_limit_minutes', '60');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('blocked_websites', '["unsafe-site.com", "bad-content.net"]');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('face_detection_enabled', 'true');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('voice_alerts_enabled', 'true');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('password_enabled', 'true');
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/logs", (req, res) => {
    const logs = db.prepare("SELECT * FROM logs ORDER BY timestamp DESC LIMIT 50").all();
    res.json(logs);
  });

  app.post("/api/logs", (req, res) => {
    const { type, category, severity, content, status } = req.body;
    const stmt = db.prepare("INSERT INTO logs (type, category, severity, content, status) VALUES (?, ?, ?, ?, ?)");
    stmt.run(type, category, severity, content, status);
    res.json({ success: true });
  });

  app.post("/api/logs/feedback", (req, res) => {
    const { id, feedback } = req.body;
    db.prepare("UPDATE logs SET feedback = ? WHERE id = ?").run(feedback, id);
    res.json({ success: true });
  });

  app.get("/api/settings", (req, res) => {
    const settings = db.prepare("SELECT * FROM settings").all();
    const settingsObj = settings.reduce((acc: any, curr: any) => {
      try {
        acc[curr.key] = JSON.parse(curr.value);
      } catch {
        acc[curr.key] = curr.value;
      }
      return acc;
    }, {});
    res.json(settingsObj);
  });

  app.post("/api/settings", (req, res) => {
    const body = req.body;
    const stmt = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
    
    Object.entries(body).forEach(([key, value]) => {
      const valStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
      stmt.run(key, valStr);
    });
    
    res.json({ success: true });
  });

  app.get("/api/stats", (req, res) => {
    const totalBlocked = db.prepare("SELECT COUNT(*) as count FROM logs WHERE status = 'blocked'").get() as any;
    const categoryBreakdown = db.prepare("SELECT category, COUNT(*) as count FROM logs WHERE status = 'blocked' GROUP BY category").all();
    
    const today = new Date().toISOString().split('T')[0];
    let screenTime = db.prepare("SELECT minutes FROM screen_time WHERE date = ?").get(today) as any;
    if (!screenTime) {
      db.prepare("INSERT INTO screen_time (date, minutes) VALUES (?, 0)").run(today);
      screenTime = { minutes: 0 };
    }

    res.json({
      totalBlocked: totalBlocked.count,
      categoryBreakdown,
      screenTimeUsedMinutes: screenTime.minutes
    });
  });

  app.post("/api/screen-time/tick", (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    db.prepare("UPDATE screen_time SET minutes = minutes + 1 WHERE date = ?").run(today);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
