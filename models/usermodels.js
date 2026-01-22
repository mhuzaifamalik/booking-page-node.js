import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { ErrorHandler } from "../middlewares/error.js   "; // make sure path is correct
import jwt from 'jsonwebtoken'
import crypto from "crypto";


function validatePhoneNumber(phone) {
    // Accepts international numbers with + and 10-15 digits
    const phoneRegex = /^(\+1\s?)?(\([0-9]{3}\)|[0-9]{3})[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/;
    return phoneRegex.test(phone);

}

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true, unique: true },
    password: {
        type: String,
        required: true,
        // minlength: [8, "Password must be at least 6 characters long"],
        select: false, // Exclude password from queries by default
        // maxlength: [32, "Password cannot exceed 64 characters"] 


    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    accountverified: { type: Boolean, default: false },
    verificationCode: { type: Number },
    verificationCodeExpires: { type: Date },
});

// Hash password before save AND validate phone
userSchema.pre("save", async function () {
    // Validate phone
    if (!validatePhoneNumber(this.phone)) {
        throw new ErrorHandler("Invalid phone number", 400);
    }

    // Hash password if modified
    if (this.isModified("password")) {
        this.password = await bcrypt.hash(this.password, 10);
    }
});
userSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
}
// Generate verification code method
userSchema.methods.generateVerificationCode = function () {
    const code = Math.floor(100000 + Math.random() * 900000); // 6-digit code
    this.verificationCode = code;
    this.verificationCodeExpires = Date.now() + 5 * 60 * 1000; // 5 mins
    return code;
};


userSchema.methods.generateToken = function () {
    return jwt.sign(
        { id: this._id },
        process.env.JWT_SECRET.trim(),
        { expiresIn: process.env.JWT_EXPIRE || "7d" }
    );
};

userSchema.methods.getResetPasswordToken = function () {
    // 1️⃣ Generate plain token
    const resetToken = crypto.randomBytes(20).toString("hex"); // 40-char hex string

    // 2️⃣ Hash token and save to DB
    this.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    // 3️⃣ Set expiry time (15 minutes from now)
    this.resetPasswordExpire = Date.now() + 15 * 60 * 1000; // 15 mins

    // 4️⃣ Return plain token to send in email
    return resetToken;
}

export const User = mongoose.model("User", userSchema);
