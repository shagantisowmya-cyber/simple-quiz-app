// ========================== IMPORTS ==========================
const express = require("express");
const fs = require("fs");
const path = require("path");
const session = require("express-session");

// ========================== APP SETUP ==========================
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session setup
app.use(
  session({
    secret: "quiz-secret-key",
    resave: false,
    saveUninitialized: true,
  })
);

// ========================== MIDDLEWARES ==========================

// 🔐 Verify Login
function verifyLogin(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    res.redirect("/login.html");
  }
}

// 🧑‍💼 Verify Admin
function verifyAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === "admin") {
    next();
  } else if (!req.session.user) {
    // Not logged in at all — redirect to admin login
    res.redirect("/admin-login.html");
  } else {
    // Logged in as a normal user — block access
    res.status(403).send("<h2>Access Denied: Admins Only</h2>");
  }
}

// ========================== USER AUTH ==========================

// 📝 Register
app.post("/register", (req, res) => {
  const { username, password } = req.body;
  const usersFile = path.join(__dirname, "data", "users.json");

  let users = [];
  if (fs.existsSync(usersFile)) {
    users = JSON.parse(fs.readFileSync(usersFile, "utf-8"));
  }

  if (users.find((u) => u.username === username)) {
    return res.status(400).json({ message: "User already exists!" });
  }

  const role = username === "admin" ? "admin" : "user";
  users.push({ username, password, role });
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));

  res.json({ success: true, message: "Registration successful!" });
});

// 🔑 Login (for both admin & users)
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const usersFile = path.join(__dirname, "data", "users.json");

  if (!fs.existsSync(usersFile)) {
    return res.status(400).json({ message: "No users found!" });
  }

  const users = JSON.parse(fs.readFileSync(usersFile, "utf-8"));
  const user = users.find(
    (u) => u.username === username && u.password === password
  );

  if (!user) {
    return res.status(400).json({ message: "Invalid username or password" });
  }

  req.session.user = user;
  res.json({ success: true, role: user.role });
});

// 🚪 Logout
app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true, message: "Logged out successfully" });
  });
});

// ✅ Check Login (used by frontend)
app.get("/check-login", (req, res) => {
  if (req.session.user) {
    res.json({ loggedIn: true, user: req.session.user });
  } else {
    res.json({ loggedIn: false });
  }
});

// ========================== QUESTIONS ==========================

// 📥 Get All Questions (users must be logged in)
app.get("/questions", verifyLogin, (req, res) => {
  const dataPath = path.join(__dirname, "data", "questions.json");
  if (!fs.existsSync(dataPath)) {
    return res.status(404).json({ message: "No questions found!" });
  }

  const questions = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  res.json(questions);
});

// ➕ Add Question (admin only)
app.post("/questions", verifyAdmin, (req, res) => {
  const dataPath = path.join(__dirname, "data", "questions.json");
  const questions = fs.existsSync(dataPath)
    ? JSON.parse(fs.readFileSync(dataPath, "utf-8"))
    : [];
  questions.push(req.body);
  fs.writeFileSync(dataPath, JSON.stringify(questions, null, 2));
  res.json({ message: "Question added successfully!" });
});

// ========================== ROUTES ==========================

// 🧑‍🎓 User pages
app.get("/index.html", verifyLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// 🧾 Default route → Login page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

// ---------------- Admin login page (unprotected, always serve) ----------------
app.get("/admin-login.html", (req, res) => {
  res.sendFile(path.join(__dirname, "admin-login.html"));
});

// ---------------- Admin dashboard (protected) ----------------
// handle both /admin.html and /admin-dashboard.html, but DO NOT include /admin-login.html here
app.get(["/admin.html", "/admin-dashboard.html"], (req, res) => {
  if (!req.session.user) {
    return res.redirect("/admin-login.html");
  }

  if (req.session.user.role === "admin") {
    return res.sendFile(path.join(__dirname, "admin-dashboard.html"));
  }

  return res.status(403).send("<h2>Access Denied: Admins Only</h2>");
});

// ========================== STATIC FILES ==========================
app.use(express.static(__dirname));

// ========================== START SERVER ==========================
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
