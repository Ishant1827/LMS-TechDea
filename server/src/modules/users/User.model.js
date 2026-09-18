const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { ROLES } = require("../../shared/utils/constants");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    phone: { type: String, default: "" },
    role: { type: String, enum: ROLES, default: "student" },
    active: { type: Boolean, default: true },

    // Null until the address has been proved by a one-time code. Deliberately a
    // date rather than a boolean: "when" answers questions a flag cannot, and
    // costs nothing.
    //
    // Unverified is a soft gate, not a lock — see requireVerified in
    // shared/middleware/auth.js. Signing in and browsing stay open; enrolling,
    // submitting and asking a doubt do not. A hard gate would turn one
    // undelivered email into a permanently blocked user, and G21 says
    // undelivered is currently a realistic outcome.
    emailVerifiedAt: { type: Date, default: null },

    // Bumped whenever every existing session should stop working: a password
    // change, a reset, a deactivation. The value is carried in the JWT and
    // compared on each request, so a token minted before the bump is refused.
    //
    // This is what makes "I changed my password because I was hacked" actually
    // true. Without it a stolen token stayed valid for its full seven days and
    // the attacker kept the account while the owner believed they had taken it
    // back. Nearly free to check: A5 already reloads the user every request.
    tokenVersion: { type: Number, default: 0 },

    // An address the owner has asked to move to but has not yet proved. It sits
    // here, not in `email`, for the whole of the flow: until a code sent to it
    // comes back, it is an unverified claim, and writing it into `email` would
    // hand account recovery to whoever made the claim.
    pendingEmail: { type: String, default: "", lowercase: true, trim: true },

    // Set on accounts whose password somebody else chose — a bulk import, where
    // the password is derived from the person's own name and is therefore
    // guessable by anyone who knows it (G27). Until it is cleared, the account
    // can do exactly two things: read itself and change its password.
    //
    // Enforced in `protect`, not in a middleware each router has to remember to
    // add, so a new endpoint is covered the day it is written rather than the
    // day somebody notices.
    mustChangePassword: { type: Boolean, default: false },
  },
  { timestamps: true }
);

userSchema.methods.setPassword = async function (plain) {
  this.passwordHash = await bcrypt.hash(String(plain), 10);
};

userSchema.methods.checkPassword = function (plain) {
  return bcrypt.compare(String(plain), this.passwordHash);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("User", userSchema);
