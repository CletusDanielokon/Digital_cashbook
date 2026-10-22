const express = require("express");
const mongoose = require("mongoose");
const Debt = require("../models/Debt");
const Transaction = require("../models/Transaction");
const { ownedAttachmentId, removeAttachment, cloneAttachment } = require("../utils/attachments");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(text) {
    if (!DATE_PATTERN.test(text)) return false;
    const d = new Date(text + "T00:00:00Z");
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === text;
}

const round2 = (n) => Math.round(n * 100) / 100;

// Adds amountPaid and remaining so the page does not have to work them out
function present(debt) {
    const plain = debt.toObject();
    const paid = round2((plain.payments || []).reduce((sum, p) => sum + p.amount, 0));
    plain.direction = plain.direction || "owed_to_me";
    plain.category = plain.category || "";
    plain.amountPaid = paid;
    plain.remaining = Math.max(0, round2(plain.amount - paid));
    return plain;
}

const DIRECTIONS = ["owed_to_me", "i_owe"];
const CATEGORIES = ["", "loan", "service", "goods", "bill", "rent", "other"];

// existing is the saved debt when editing, so an edit that does not mention
// the direction or the category keeps what was already there
function validateDebt(body, existing) {
    existing = existing || {};
    const direction = body.direction === undefined || body.direction === ""
        ? (existing.direction || "owed_to_me")
        : String(body.direction);
    const category = body.category === undefined
        ? (existing.category || "")
        : String(body.category).trim().toLowerCase();
    if (!CATEGORIES.includes(category)) return { error: "Please choose what the money is for from the list." };
    if (!DIRECTIONS.includes(direction)) return { error: "Please choose whether this is money you owe or money owed to you." };
    const owes = direction === "i_owe";
    const personName = String(body.personName || "").trim();
    const phone = String(body.phone || "").trim();
    const note = String(body.note || "").trim();
    const amount = round2(Number(body.amount));
    const dateLent = String(body.dateLent || "").trim();
    const dueDate = String(body.dueDate || "").trim();

    if (!personName) return { error: owes ? "Please enter the name of the person you owe." : "Please enter the name of the person who owes you." };
    if (personName.length > 100) return { error: "The name is too long (100 characters at most)." };
    if (!(amount > 0)) return { error: "Please enter an amount greater than zero." };
    if (!isRealDate(dateLent)) return { error: "Please choose a valid date." };
    if (dueDate && !isRealDate(dueDate)) return { error: "The due date is not valid." };
    if (dueDate && dueDate < dateLent) return { error: "The due date cannot be before the date of the debt." };
    if (phone && !/^[0-9+\s\-().]{5,30}$/.test(phone)) return { error: "The phone number can only contain digits, spaces and + - ( )." };
    if (note.length > 1000) return { error: "The note is too long (1000 characters at most)." };

    return { direction, category, personName, phone, amount, note, dateLent, dueDate };
}

// Answers with the right status when a helper threw an HttpError, otherwise with the fallback
function fail(res, error, fallbackMessage) {
    if (error && error.status) return res.status(error.status).json({ message: error.message });
    return res.status(500).json({ message: fallbackMessage });
}

// Stops a badly formed id from crashing the request
function checkId(req, res, next) {
    if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(404).json({ message: "Debt not found." });
    }
    next();
}

// GET all debts for the logged-in user
router.get("/", protect, async (req, res) => {
    try {
        const debts = await Debt.find({ user: req.userId }).sort({ createdAt: -1 });
        res.json({ debts: debts.map(present) });
    } catch (error) {
        console.error("Get debts error:", error.message);
        res.status(500).json({ message: "Server error while loading debts." });
    }
});

// CREATE a debt
router.post("/", protect, async (req, res) => {
    try {
        const result = validateDebt(req.body);
        if (result.error) return res.status(400).json({ message: result.error });

        const attachment = await ownedAttachmentId(req.userId, req.body.attachment);

        const debt = await Debt.create({ user: req.userId, ...result, attachment: attachment || null });
        res.status(201).json({ message: "Debt saved successfully!", debt: present(debt) });
    } catch (error) {
        console.error("Create debt error:", error.message);
        fail(res, error, "Server error while saving the debt.");
    }
});

// UPDATE the details of a debt (payments are changed on their own routes below)
router.put("/:id", protect, checkId, async (req, res) => {
    try {
        const debt = await Debt.findOne({ _id: req.params.id, user: req.userId });
        if (!debt) return res.status(404).json({ message: "Debt not found." });

        const result = validateDebt(req.body, debt);
        if (result.error) return res.status(400).json({ message: result.error });

        const paid = round2(debt.payments.reduce((sum, p) => sum + p.amount, 0));
        if (result.amount < paid) {
            return res.status(400).json({
                message: "The amount cannot be less than what has already been paid back."
            });
        }

        // Picture: not mentioned = keep, null = remove, an id = replace
        const attachment = await ownedAttachmentId(req.userId, req.body.attachment);
        const oldAttachment = debt.attachment ? String(debt.attachment) : null;

        debt.set(result);
        if (attachment !== undefined) debt.attachment = attachment;
        await debt.save();

        if (attachment !== undefined && oldAttachment && oldAttachment !== attachment) {
            await removeAttachment(req.userId, oldAttachment);
        }

        res.json({ message: "Debt updated successfully!", debt: present(debt) });
    } catch (error) {
        console.error("Update debt error:", error.message);
        fail(res, error, "Unable to update the debt.");
    }
});

// RECORD a payment (part or full) toward a debt
router.post("/:id/payments", protect, checkId, async (req, res) => {
    try {
        const amount = round2(Number(req.body.amount));
        const date = String(req.body.date || "").trim();
        const note = String(req.body.note || "").trim();

        if (!(amount > 0)) return res.status(400).json({ message: "Please enter an amount greater than zero." });
        if (!isRealDate(date)) return res.status(400).json({ message: "Please choose a valid payment date." });
        if (note.length > 300) return res.status(400).json({ message: "The payment note is too long (300 characters at most)." });

        const debt = await Debt.findOne({ _id: req.params.id, user: req.userId });
        if (!debt) return res.status(404).json({ message: "Debt not found." });

        const paid = round2(debt.payments.reduce((sum, p) => sum + p.amount, 0));
        const remaining = round2(debt.amount - paid);

        if (amount > remaining) {
            return res.status(400).json({
                message: "That is more than what is still owed."
            });
        }

        const attachment = await ownedAttachmentId(req.userId, req.body.attachment);
        const wantsTransaction = req.body.recordTransaction === true || req.body.recordTransaction === "true";

        // The time shown on the transaction comes from the user's phone (the server clock is in another time zone)
        const sentTime = String(req.body.time || "");
        const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(sentTime)
            ? sentTime
            : new Date().toISOString().slice(11, 16);

        let transactionId = null;
        let copiedAttachment = null;

        // Only when the user said yes: record the payment in Transactions as well
        if (wantsTransaction) {
            const iOwe = debt.direction === "i_owe";
            copiedAttachment = attachment ? await cloneAttachment(req.userId, attachment) : null;

            const transaction = await Transaction.create({
                user: req.userId,
                description: (iOwe ? "Debt payment to " : "Debt payment from ") + debt.personName,
                amount,
                date,
                time,
                category: "Debt",
                type: iOwe ? "expense" : "income",
                attachment: copiedAttachment
            });
            transactionId = transaction._id;
        }

        try {
            debt.payments.push({ amount, date, note, attachment: attachment || null, transaction: transactionId });
            await debt.save();
        } catch (saveError) {
            // Do not leave a transaction behind for a payment that was not saved
            if (transactionId) await Transaction.deleteOne({ _id: transactionId, user: req.userId });
            if (copiedAttachment) await removeAttachment(req.userId, copiedAttachment);
            throw saveError;
        }

        res.status(201).json({
            message: "Payment recorded!",
            recordedTransaction: Boolean(transactionId),
            debt: present(debt)
        });
    } catch (error) {
        console.error("Add payment error:", error.message);
        fail(res, error, "Unable to record the payment.");
    }
});

// REMOVE a payment that was recorded by mistake
router.delete("/:id/payments/:paymentId", protect, checkId, async (req, res) => {
    try {
        const debt = await Debt.findOne({ _id: req.params.id, user: req.userId });
        if (!debt) return res.status(404).json({ message: "Debt not found." });

        const payment = debt.payments.id(req.params.paymentId);
        if (!payment) return res.status(404).json({ message: "Payment not found." });

        const linkedTransaction = payment.transaction;
        const paymentPicture = payment.attachment;

        payment.deleteOne();
        await debt.save();

        // A payment that was recorded in Transactions automatically goes away from there too
        let removedTransaction = false;
        if (linkedTransaction) {
            const gone = await Transaction.findOneAndDelete({ _id: linkedTransaction, user: req.userId });
            if (gone) {
                removedTransaction = true;
                await removeAttachment(req.userId, gone.attachment);
            }
        }
        await removeAttachment(req.userId, paymentPicture);

        res.json({ message: "Payment removed.", removedTransaction, debt: present(debt) });
    } catch (error) {
        console.error("Delete payment error:", error.message);
        res.status(500).json({ message: "Unable to remove the payment." });
    }
});

// DELETE a debt
router.delete("/:id", protect, checkId, async (req, res) => {
    try {
        const debt = await Debt.findOneAndDelete({ _id: req.params.id, user: req.userId });
        if (!debt) return res.status(404).json({ message: "Debt not found." });

        // The pictures go with the debt. Transactions that were recorded from its payments stay,
        // because that money really moved.
        await removeAttachment(req.userId, debt.attachment);
        for (const payment of debt.payments) await removeAttachment(req.userId, payment.attachment);

        res.json({ message: "Debt deleted successfully!" });
    } catch (error) {
        console.error("Delete debt error:", error.message);
        res.status(500).json({ message: "Server error while deleting the debt." });
    }
});

module.exports = router;
