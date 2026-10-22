const express = require("express");
const mongoose = require("mongoose");
const Attachment = require("../models/Attachment");
const Transaction = require("../models/Transaction");
const Debt = require("../models/Debt");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

const MAX_BASE64_LENGTH = 700000;      // about 520 KB of picture (the browser shrinks photos first)
const MAX_PER_USER = 400;
const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

// Checks the first bytes so only real pictures are stored
function looksLikeImage(mime, base64) {
    const head = Buffer.from(base64.slice(0, 32), "base64");
    if (mime === "image/jpeg") return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
    if (mime === "image/png") return head[0] === 0x89 && head.slice(1, 4).toString() === "PNG";
    if (mime === "image/webp") return head.slice(0, 4).toString() === "RIFF" && head.slice(8, 12).toString() === "WEBP";
    return false;
}

// UPLOAD a picture. Body: { image: "data:image/jpeg;base64,...." }
router.post("/", protect, async (req, res) => {
    try {
        const match = DATA_URL.exec(String(req.body.image || ""));
        if (!match) {
            return res.status(400).json({ message: "Please choose a JPG, PNG or WebP picture." });
        }

        const mime = match[1];
        const base64 = match[2];

        if (base64.length > MAX_BASE64_LENGTH) {
            return res.status(413).json({ message: "That picture is too large. Please choose a smaller one." });
        }
        if (!looksLikeImage(mime, base64)) {
            return res.status(400).json({ message: "That file is not a valid picture." });
        }

        const count = await Attachment.countDocuments({ user: req.userId });
        if (count >= MAX_PER_USER) {
            return res.status(400).json({ message: "You have reached the limit of saved pictures. Delete some old ones first." });
        }

        const attachment = await Attachment.create({
            user: req.userId,
            mime,
            data: base64,
            size: Math.floor(base64.length * 0.75)
        });

        res.status(201).json({ id: String(attachment._id) });
    } catch (error) {
        console.error("Upload attachment error:", error.message);
        res.status(500).json({ message: "Unable to save the picture." });
    }
});

// GET one picture (only its owner can see it)
router.get("/:id", protect, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(404).json({ message: "Picture not found." });
        }

        const attachment = await Attachment.findOne({ _id: req.params.id, user: req.userId });
        if (!attachment) return res.status(404).json({ message: "Picture not found." });

        res.json({ image: "data:" + attachment.mime + ";base64," + attachment.data });
    } catch (error) {
        console.error("Get attachment error:", error.message);
        res.status(500).json({ message: "Unable to load the picture." });
    }
});

// DELETE a picture that was uploaded but never attached to anything
router.delete("/:id", protect, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) {
            return res.status(404).json({ message: "Picture not found." });
        }

        const id = req.params.id;
        const inUse =
            (await Transaction.exists({ user: req.userId, attachment: id })) ||
            (await Debt.exists({ user: req.userId, $or: [{ attachment: id }, { "payments.attachment": id }] }));

        if (inUse) return res.status(409).json({ message: "That picture is attached to a record." });

        await Attachment.deleteOne({ _id: id, user: req.userId });
        res.json({ message: "Picture removed." });
    } catch (error) {
        console.error("Delete attachment error:", error.message);
        res.status(500).json({ message: "Unable to remove the picture." });
    }
});

module.exports = router;
