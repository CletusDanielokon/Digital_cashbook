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

// Money that is owed between the logged-in user and another person (either direction)
const debtSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        // owed_to_me = someone owes the user money, i_owe = the user owes someone
        direction: {
            type: String,
            enum: ["owed_to_me", "i_owe"],
            default: "owed_to_me"
        },

        // What the money is for. Empty = not specified.
        category: {
            type: String,
            enum: ["", "loan", "service", "goods", "bill", "rent", "other"],
            default: ""
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
