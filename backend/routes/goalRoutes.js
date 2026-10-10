const express = require("express");
const Goal = require("../models/Goal");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

function validateGoal(body) {
    const name = (body.name || "").trim();
    const target = Number(body.target);
    const saved = Number(body.saved) || 0;

    if (!name || !(target > 0) || saved < 0) {
        return { error: "Please enter valid goal information." };
    }
    if (saved > target) {
        return { error: "Amount saved cannot be greater than the target amount." };
    }
    return { name, target, saved };
}

// GET all goals for the logged-in user
router.get("/", protect, async (req, res) => {
    try {
        const goals = await Goal.find({ user: req.userId }).sort({ createdAt: 1 });
        res.json({ goals });
    } catch (error) {
        console.error("Get goals error:", error.message);
        res.status(500).json({ message: "Server error while loading goals." });
    }
});

// CREATE a goal
router.post("/", protect, async (req, res) => {
    try {
        const result = validateGoal(req.body);
        if (result.error) return res.status(400).json({ message: result.error });

        const goal = await Goal.create({
            user: req.userId,
            name: result.name,
            target: result.target,
            saved: result.saved
        });

        res.status(201).json({ message: "Goal created successfully!", goal });
    } catch (error) {
        console.error("Create goal error:", error.message);
        res.status(500).json({ message: "Server error while creating goal." });
    }
});

// UPDATE a goal
router.put("/:id", protect, async (req, res) => {
    try {
        const result = validateGoal(req.body);
        if (result.error) return res.status(400).json({ message: result.error });

        const goal = await Goal.findOneAndUpdate(
            { _id: req.params.id, user: req.userId },
            { name: result.name, target: result.target, saved: result.saved },
            { new: true, runValidators: true }
        );

        if (!goal) return res.status(404).json({ message: "Goal not found." });

        res.json({ message: "Goal updated successfully!", goal });
    } catch (error) {
        console.error("Update goal error:", error.message);
        res.status(500).json({ message: "Unable to update goal." });
    }
});

// DELETE a goal
router.delete("/:id", protect, async (req, res) => {
    try {
        const goal = await Goal.findOneAndDelete({
            _id: req.params.id,
            user: req.userId
        });

        if (!goal) return res.status(404).json({ message: "Goal not found." });

        res.json({ message: "Goal deleted successfully!" });
    } catch (error) {
        console.error("Delete goal error:", error.message);
        res.status(500).json({ message: "Server error while deleting goal." });
    }
});

module.exports = router;
