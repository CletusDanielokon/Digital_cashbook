const mongoose = require("mongoose");

// One payment the person made toward a debt (part or full)
const paymentSchema = new mongoose.Schema(
    {
        amount: {
            type: Number,
            required: true,
            min: 0.01
        },
        date: {
            type: String,      // YYYY-MM-DD, same style as transactions
            required: true
        },
        note: {
            type: String,
            trim: true,
            default: "",
            maxlength: 300
        }
    },
    { timestamps: true }
);

// Money that someone owes the logged-in user
const debtSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        personName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100
        },

        // Optional: used for the "Remind on WhatsApp" button
        phone: {
            type: String,
            trim: true,
            default: "",
            maxlength: 30
        },

        // The full amount that was lent / is owed
        amount: {
            type: Number,
            required: true,
            min: 0.01
        },

        // What the money was for, agreements, anything worth remembering
        note: {
            type: String,
            trim: true,
            default: "",
            maxlength: 1000
        },

        dateLent: {
            type: String,      // YYYY-MM-DD
            required: true
        },

        // Optional promised date; empty string means no due date
        dueDate: {
            type: String,
            default: ""
        },

        payments: [paymentSchema]
    },
    { timestamps: true }
);

module.exports = mongoose.model("Debt", debtSchema);
