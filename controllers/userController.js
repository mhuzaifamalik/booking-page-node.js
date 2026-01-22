// controllers/userController.js

import { ErrorHandler } from "../middlewares/error.js";
import { catchAsyncError } from "../middlewares/catchAsyncError.js";
import { User } from "../models/usermodels.js";
import { sendEmail } from "../utils/sendEmail.js";
import twilio from "twilio";
import { sendToken } from "../utils/sendToken.js";
import crypto from "crypto";

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// ------------------- REGISTER -------------------
export const register = catchAsyncError(async (req, res, next) => {
    const { name, email, phone, password, verificationMethod } = req.body;

    if (!name || !email || !phone || !password || !verificationMethod) {
        return next(new ErrorHandler("All fields are required.", 400));
    }

    // Format phone to E.164 (US numbers)
    const formattedPhone = phone.startsWith("+") ? phone : `+1${phone}`;
    const phoneRegex = /^\+1[0-9]{10}$/;
    if (!phoneRegex.test(formattedPhone)) {
        return next(new ErrorHandler("Invalid phone number.", 400));
    }

    // Check for existing verified user
    const existingUser = await User.findOne({
        $or: [
            { email, accountverified: true },
            { phone: formattedPhone, accountverified: true }
        ]
    });
    if (existingUser) {
        return next(new ErrorHandler("Email or phone already in use.", 400));
    }

    // Limit unverified attempts
    const unverifiedAttempts = await User.find({
        $or: [
            { email, accountverified: false },
            { phone: formattedPhone, accountverified: false }
        ]
    });
    if (unverifiedAttempts.length >= 3) {
        return next(
            new ErrorHandler(
                "You have exceeded the maximum number of attempts (3). Please try again after an hour.",
                400
            )
        );
    }

    // Create user
    const user = await User.create({
        name,
        email,
        phone: formattedPhone,
        password
    });

    // Generate verification code and expiry
    const verificationCode = Math.floor(100000 + Math.random() * 900000); // 6-digit
    user.verificationCode = verificationCode;
    user.verificationCodeExpires = Date.now() + 5 * 60 * 1000; // 5 minutes
    await user.save();

    // Send verification code
    await sendVerificationCode(user, verificationMethod, res, next);
});

// ------------------- SEND VERIFICATION CODE -------------------
async function sendVerificationCode(user, method, res, next) {
    const { verificationCode, email, phone } = user;

    try {
        if (method === "email") {
            const message = generateEmailTemplate(verificationCode);
            await sendEmail({
                email,
                subject: "Your Verification Code",
                message
            });

            return res.status(200).json({
                success: true,
                message: `Verification code sent to ${email} successfully via Email.`
            });
        } else if (method === "phone") {
            const phoneNumber = phone.startsWith("+") ? phone : `+1${phone}`;
            await twilioClient.messages.create({
                body: `Your verification code is ${verificationCode}`,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: phoneNumber
            });

            return res.status(200).json({
                success: true,
                message: `Verification code sent to ${phoneNumber} successfully via SMS.`
            });
        } else {
            return next(
                new ErrorHandler("Invalid verification method. Choose 'email' or 'phone'.", 400)
            );
        }
    } catch (err) {
        console.error("Verification sending error:", err);
        return next(new ErrorHandler("Failed to send verification code. Try again.", 500));
    }
}

// ------------------- EMAIL TEMPLATE -------------------
function generateEmailTemplate(verificationCode) {
    return `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
          <h2 style="text-align: center; color: #007bff;">Verification Code</h2>
          <p>Hello,</p>
          <p>Your verification code is:</p>
          <p style="font-size: 24px; font-weight: bold; text-align: center; background: #f2f2f2; padding: 10px; border-radius: 5px;">
            ${verificationCode}
          </p>
          <p>This code will expire in <strong>5 minutes</strong>. Please do not share it with anyone.</p>
          <p>Thank you,<br>Your Company Team</p>
        </div>
      </body>
    </html>
  `;
}

// ------------------- VERIFY OTP -------------------
export const verifyOTP = catchAsyncError(async (req, res, next) => {
    const { email, phone, verificationCode } = req.body;
    const formattedPhone = phone.startsWith("+") ? phone : `+1${phone}`;

    const userEntries = await User.find({
        $or: [
            { email, accountverified: false },
            { phone: formattedPhone, accountverified: false }
        ]
    }).sort({ createdAt: -1 });

    if (userEntries.length === 0) {
        return next(new ErrorHandler("User not found.", 404));
    }

    const user = userEntries[0];

    // Delete duplicates
    if (userEntries.length > 1) {
        const idsToDelete = userEntries.slice(1).map(u => u._id);
        await User.deleteMany({ _id: { $in: idsToDelete } });
    }

    // Verify code
    if (user.verificationCode !== Number(verificationCode)) {
        return next(new ErrorHandler("Invalid verification code.", 400));
    }

    // Check expiry
    if (Date.now() > new Date(user.verificationCodeExpires).getTime()) {
        return next(new ErrorHandler("Verification code has expired.", 400));
    }

    // Mark account verified
    user.accountverified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    await user.save();

    // Send JWT token
    sendToken(user, 200, "User verified successfully.", res);
});

export const login = catchAsyncError(async (req, res, next) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return next(new ErrorHandler("Please provide email and password", 400));
    }
    const user = await User.findOne({ email, accountverified: true }).select("+password");
    if (!user) {
        return next(new ErrorHandler("Invalid email or account not verified", 400));
    }
    const isPasswordMatched = await user.comparePassword(password);
    if (!isPasswordMatched) {
        return next(new ErrorHandler("Invalid password", 400));
    }
    sendToken(user, 200, "Login successful", res);

});



export const logout = (req, res) => {
  res
    .status(200)
    .cookie("token", "", {
      expires: new Date(0),
      httpOnly: true,
    })
    .json({
      success: true,
      message: "Logged out successfully",
    });
};


export const getUser =  catchAsyncError (async (req,res,next) => {
    const user = req.user;
    res.status(200).json({
        success: true,
        user,
    });
});

export const forgotPassword = catchAsyncError(async (req, res, next) => {
    const { email } = req.body || {};

    if (!email) {
        return next(new ErrorHandler("Email is required", 400));
    }

    const user = await User.findOne({ email, accountverified: true });

    if (!user) {
        return next(new ErrorHandler("User not found with this email", 404));
    }

    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    const resetPasswordUrl = `${process.env.FRONTEND_URL}/resetpassword/${resetToken}`;
    const message = `Your password reset link:\n\n${resetPasswordUrl}`;

    try {
        await sendEmail({
            email: user.email,
            subject: "Password Recovery",
            message,    
        });

        return res.status(200).json({
            success: true,
            message: `Email sent to ${user.email} successfully`,
        });
    } catch (error) {
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save({ validateBeforeSave: false });

        return next(
            new ErrorHandler("Email could not be sent", 500)
        );
    }
});


export const resetPassword = catchAsyncError(async (req, res, next) => {
  const { token } = req.params;

  if (!token) {
    return next(new ErrorHandler("Reset token is required", 400));
  }

  // Hash the token to match DB
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  // Find user with matching hashed token and valid expiry
  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: Date.now() }, // token must not be expired
  });

  if (!user) {
    // Debug info (remove in production)
    console.log("No user found for token:", token);
    console.log("Hashed token:", resetPasswordToken);
    return next(new ErrorHandler("Invalid or expired password reset token", 400));
  }

  // Check password and confirmation match
  const { password, confirmPassword } = req.body;
  if (!password || !confirmPassword) {
    return next(new ErrorHandler("Password and confirmPassword are required", 400));
  }

  if (password !== confirmPassword) {
    return next(new ErrorHandler("Passwords do not match", 400));
  }

  // Update password
  user.password = password;

  // Clear reset token and expiry
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;

  await user.save();

  // Return JWT after successful reset
  sendToken(user, 200, "Password reset successful", res);
});
