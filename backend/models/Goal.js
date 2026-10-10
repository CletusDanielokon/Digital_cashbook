const mongoose = require("mongoose");

const goalSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        target: {
            type: Number,
            required: true,
            min: 1
        },
        saved: {
            type: Number,
            default: 0,
            min: 0
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("Goal", goalSchema);
