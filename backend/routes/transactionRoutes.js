const express = require("express");
const Transaction = require("../models/Transaction");
const protect = require("../middleware/authMiddleware");
const { ownedAttachmentId, removeAttachment } = require("../utils/attachments");

const router = express.Router();

// ===============================
// CREATE TRANSACTION
// ===============================
router.post("/", protect, async (req, res) => {
  console.log("POST TRANSACTION RECEIVED");
  console.log(req.body);
    try {
        const {
            description,
            amount,
            date,
            time,
            category,
            type
        } = req.body;

        // Check required fields
        if (
            !description ||
            !amount ||
            !date ||
            !time ||
            !category ||
            !type
        ) {
            return res.status(400).json({
                message: "Please fill in all transaction fields."
            });
        }

        // Optional teller / receipt picture
        const attachment = await ownedAttachmentId(req.userId, req.body.attachment);

        // Create transaction for logged-in user
        const transaction = await Transaction.create({
            user: req.userId,
            description,
            amount,
            date,
            time,
            category,
            type,
            attachment: attachment || null
        });

        res.status(201).json({
            message: "Transaction created successfully!",
            transaction
        });

    } catch (error) {
        console.error("Create transaction error:", error.message);

        if (error.status) return res.status(error.status).json({ message: error.message });

        res.status(500).json({
            message: "Server error while creating transaction."
        });
    }
});


// ===============================
// GET USER TRANSACTIONS
// ===============================
router.get("/", protect, async (req, res) => {
    try {
        const transactions = await Transaction.find({
            user: req.userId
        }).sort({ createdAt: -1 });

        res.json({
            transactions
        });

    } catch (error) {
        console.error("Get transactions error:", error.message);

        res.status(500).json({
            message: "Server error while loading transactions."
        });
    }
});

// UPDATE TRANSACTION
router.put("/:id", protect, async (req, res) => {
    try {
        const {
            description,
            amount,
            date,
            time,
            category,
            type
        } = req.body;

        if (
            !description ||
            !amount ||
            !date ||
            !time ||
            !category ||
            !type
        ) {
            return res.status(400).json({
                message: "Please fill in all transaction fields."
            });
        }

        const changes = { description, amount, date, time, category, type };

        // Picture: not mentioned = keep, null = remove, an id = replace
        const attachment = await ownedAttachmentId(req.userId, req.body.attachment);
        let oldAttachment = null;

        if (attachment !== undefined) {
            const existing = await Transaction.findOne({ _id: req.params.id, user: req.userId });
            if (existing) {
                oldAttachment = existing.attachment ? String(existing.attachment) : null;
                changes.attachment = attachment;
            }
        }

        const transaction = await Transaction.findOneAndUpdate(
            {
                _id: req.params.id,
                user: req.userId
            },
            changes,
            {
                new: true,
                runValidators: true
            }
        );

        if (!transaction) {
            return res.status(404).json({
                message: "Transaction not found."
            });
        }

        // The old picture is no longer used
        if (oldAttachment && oldAttachment !== attachment) {
            await removeAttachment(req.userId, oldAttachment);
        }

        res.json({
            message: "Transaction updated successfully!",
            transaction
        });

    } catch (error) {
        console.error(
            "Update transaction error:",
            error.message
        );

        if (error.status) return res.status(error.status).json({ message: error.message });

        res.status(500).json({
            message: "Unable to update transaction."
        });
    }
});


// ===============================
// DELETE TRANSACTION
// ===============================
router.delete("/:id", protect, async (req, res) => {
    try {
        const transaction = await Transaction.findOneAndDelete({
            _id: req.params.id,
            user: req.userId
        });

        if (!transaction) {
            return res.status(404).json({
                message: "Transaction not found."
            });
        }

        await removeAttachment(req.userId, transaction.attachment);

        res.json({
            message: "Transaction deleted successfully!"
        });

    } catch (error) {
        console.error("Delete transaction error:", error.message);

        res.status(500).json({
            message: "Server error while deleting transaction."
        });
    }
});


module.exports = router;