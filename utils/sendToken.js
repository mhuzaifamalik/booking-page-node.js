export const sendToken = (user, statusCode, message, res) => {
  const token = user.generateToken();

  const expireDays = Number(process.env.JWT_EXPIRE) || 7;

  res.status(statusCode)
    .cookie("token", token, {
      expires: new Date(Date.now() + expireDays * 24 * 60 * 60 * 1000),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // secure in production
    })
    .json({
      success: true,
      message,
      token,
      user,
    });
};
