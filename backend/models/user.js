const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        fullName: {
            type: String,
            required: true,
            trim: true
        },

        // Not required for accounts created with Google
        mobile: {
            type: String,
            trim: true,
            default: "",
            required: function () {
                return !this.googleId;
            }
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },

        book: {
            type: String,
            required: true,
            trim: true,
            default: "My CashBook"
        },

        // Not required for accounts created with Google
        password: {
            type: String,
            required: function () {
                return !this.googleId;
            }
        },

        // Profile photo address from the Google account (empty otherwise)
        picture: {
            type: String,
            default: ""
        },

        // Proof that the email / phone really belongs to this person
        // (email is verified by Google sign-in or by entering the code we send)
        emailVerified: {
            type: Boolean,
            default: false
        },

        mobileVerified: {
            type: Boolean,
            default: false
        },

        // Google account id ("sub" claim) for Google sign-in
        googleId: {
            type: String,
            unique: true,
            sparse: true
        },

        // Password reset (token is stored hashed, never in plain text)
        resetPasswordToken: {
            type: String
        },

        resetPasswordExpires: {
            type: Date
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("User", userSchema);
