const jwt = require("jsonwebtoken");

// `role` is carried for readability only — authorization is always re-derived
// from the database (D3). `tv` is different: it is compared on every request,
// and is the one claim that can invalidate the token.
function signToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role, tv: user.tokenVersion || 0 },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES || "7d" }
  );
}

module.exports = { signToken };
