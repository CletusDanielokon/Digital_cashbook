const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        description: {
            type: String,
            required: true,
            trim: true
        },

        amount: {
            type: Number,
            required: true
        },

        date: {
            type: String,
            required: true
        },

        time: {
            type: String,
            required: true
        },

        category: {
            type: String,
            required: true
        },

        type: {
            type: String,
            required: true,
            enum: ["income", "expense"]
        },

        // Optional photo of the teller or receipt (see models/Attachment.js)
        attachment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Attachment",
            default: null
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Transaction", transactionSchema);