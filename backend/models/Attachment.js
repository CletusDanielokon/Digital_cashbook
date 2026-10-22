const mongoose = require("mongoose");

// A photo of a transfer teller or receipt that a user attached to a transaction or debt.
// It lives in its own collection so lists of transactions stay small and fast.
const attachmentSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        mime: {
            type: String,
            required: true,
            enum: ["image/jpeg", "image/png", "image/webp"]
        },

        // The picture as base64 text (without the "data:image/...;base64," start)
        data: {
            type: String,
            required: true
        },

        size: {
            type: Number,
            default: 0
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Attachment", attachmentSchema);
