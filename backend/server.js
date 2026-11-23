const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

require('dotenv').config();
const mongoose = require('mongoose');
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

// ---------- MongoDB ----------
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log('MongoDB error:', err.message));

const Profile = mongoose.model('Profile', new mongoose.Schema({
  username: { type: String, unique: true },
  realName: String,
  ranking: Number,
  totalSolved: Number,
  streak: Number,
  totalActiveDays: Number,
  lastFetched: Date
}));

// ---------- LeetCode query ----------
const query = `
query userProfile($username: String!) {
  matchedUser(username: $username) {
    username
    profile {
      realName
      userAvatar
      ranking
    }
    submitStats {
      acSubmissionNum {
        difficulty
        count
        submissions
      }
    }
    userCalendar {
      activeYears
      streak
      totalActiveDays
      submissionCalendar
    }
  }
}
`;

// ---------- Routes ----------
app.get("/api/leetcode/:username", async (req, res) => {
  try {
    const username = req.params.username;

    const response = await fetch("https://leetcode.com/graphql/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Referer": "https://leetcode.com/",
        "Origin": "https://leetcode.com"
      },
      body: JSON.stringify({
        query,
        variables: { username }
      })
    });

    const result = await response.json();

    if (!response.ok || result.errors || !result.data?.matchedUser) {
      return res.status(400).json({
        error: "Could not retrieve LeetCode profile",
        details: result.errors || result
      });
    }

    // Save a summary to MongoDB (never blocks the response if it fails)
    try {
      const u = result.data.matchedUser;
      const all = u.submitStats.acSubmissionNum.find(x => x.difficulty === "All");
      await Profile.findOneAndUpdate(
        { username: u.username },
        {
          realName: u.profile.realName,
          ranking: u.profile.ranking,
          totalSolved: all ? all.count : 0,
          streak: u.userCalendar.streak,
          totalActiveDays: u.userCalendar.totalActiveDays,
          lastFetched: new Date()
        },
        { upsert: true }
      );
    } catch (e) {
      console.error("DB save error:", e.message);
    }

    res.json(result);

  } catch (error) {
    console.error("LeetCode API error:", error);

    res.status(500).json({
      error: "Server error while fetching LeetCode data",
      details: error.message
    });
  }
});

// Recent searches saved in the database
app.get("/api/history", async (req, res) => {
  try {
    const list = await Profile.find().sort({ lastFetched: -1 }).limit(20);
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: "Could not load history", details: error.message });
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

app.listen(PORT, () => {
  console.log(`CodeTrail Lite running at http://localhost:${PORT}`);
});