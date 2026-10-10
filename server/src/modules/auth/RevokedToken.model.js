const mongoose = require("mongoose");

// Tokens signed out before they expired (G2). A JWT cannot be un-issued, so
// logout records its id here and `protect` refuses any token on this list.
//
// Each row lives exactly as long as the token it names: past `expiresAt` the
// token is refused for being expired anyway, and Mongo's TTL monitor deletes
// the row. The collection therefore never holds more than a week of sign-outs.
const revokedTokenSchema = new mongoose.Schema({
  jti: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

module.exports = mongoose.model("RevokedToken", revokedTokenSchema);
