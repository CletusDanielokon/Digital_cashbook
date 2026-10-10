const express = require("express");
const Budget = require("../models/Budget");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

// GET the logged-in user's monthly budget
router.get("/", protect, async (req, res) => {
    try {
        const budget = await Budget.findOne({ user: req.userId });
        res.json({ budget: budget || { amount: 0 } });
    } catch (error) {
        console.error("Get budget error:", error.message);
        res.status(500).json({ message: "Server error while loading budget." });
    }
});

// SET (create or update) the monthly budget
router.put("/", protect, async (req, res) => {
    try {
        const amount = Number(req.body.amount);

        if (!amount || amount <= 0) {
            return res.status(400).json({
                message: "Please enter a valid budget amount."
            });
        }

        const budget = await Budget.findOneAndUpdate(
            { user: req.userId },
            { amount },
            { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
        );

        res.json({ message: "Budget saved successfully!", budget });
    } catch (error) {
        console.error("Save budget error:", error.message);
        res.status(500).json({ message: "Server error while saving budget." });
    }
});

module.exports = router;
