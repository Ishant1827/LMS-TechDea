// Creates exactly one admin account, and nothing else.
//
//   npm run create:admin
//
// This exists because there is otherwise no way to make the first one:
// self-registration always produces a student (A8), and only an admin can
// create staff (A9). An installation with no admin would have no route to one
// short of editing the database by hand.
//
// It is deliberately not the old seed script. No demo teacher, no sample
// courses, no default password — the thing that replaced carried
// `admin12345` as a fallback, which is exactly the kind of credential that
// survives into production because nobody remembers it is there.
//
// The password is typed in, not passed as an argument or an environment
// variable: a command-line argument lands in shell history and in the process
// list, where anyone on the machine can read it.

require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../src/config/db");
const User = require("../src/modules/users/User.model");

const MIN_PASSWORD = 6; // matches the rule the API enforces
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const force = process.argv.includes("--force");

function ask(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", (data) => {
      process.stdin.pause();
      resolve(String(data).trim());
    });
  });
}

// Reads without echoing. Falls back to a plain read when there is no terminal —
// piping into this is not the intended use, but it should not hang.
function askHidden(question) {
  const stdin = process.stdin;
  if (!stdin.isTTY) return ask(question);

  return new Promise((resolve) => {
    process.stdout.write(question);
    stdin.resume();
    stdin.setRawMode(true);
    stdin.setEncoding("utf8");

    let value = "";
    const finish = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
      process.stdout.write("\n");
      resolve(value);
    };

    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") return finish();
        if (ch === "") {
          // Ctrl-C — leave the terminal usable on the way out.
          stdin.setRawMode(false);
          process.stdout.write("\n");
          process.exit(130);
        }
        if (ch === "" || ch === "\b") value = value.slice(0, -1);
        else if (ch >= " ") value += ch;
      }
    };

    stdin.on("data", onData);
  });
}

(async () => {
  await connectDB();

  const existing = await User.countDocuments({ role: "admin" });
  if (existing && !force) {
    console.log(
      `\nThere ${existing === 1 ? "is already 1 admin" : `are already ${existing} admins`} on this ` +
        `database.\n\nCreate further admins from Admin > Users in the app — that way the action ` +
        `is taken by\nsomeone already trusted, rather than by anyone who can reach a shell.\n\n` +
        `If you really mean to add one here, re-run with --force.\n`
    );
    await mongoose.connection.close();
    process.exit(1);
  }

  console.log(existing ? "\nCreating an additional admin (--force).\n" : "\nCreating the first admin.\n");

  const email = (await ask("Email:    ")).toLowerCase();
  if (!EMAIL.test(email)) {
    console.error("\nThat is not a valid email address.");
    await mongoose.connection.close();
    process.exit(1);
  }
  if (await User.findOne({ email })) {
    console.error(`\nAn account with ${email} already exists.`);
    await mongoose.connection.close();
    process.exit(1);
  }

  const name = (await ask("Name:     ")) || "Admin";

  const password = await askHidden("Password: ");
  if (password.length < MIN_PASSWORD) {
    console.error(`\nPassword must be at least ${MIN_PASSWORD} characters.`);
    await mongoose.connection.close();
    process.exit(1);
  }
  const again = await askHidden("Confirm:  ");
  if (password !== again) {
    console.error("\nPasswords do not match.");
    await mongoose.connection.close();
    process.exit(1);
  }

  const user = new User({ name, email, role: "admin" });
  await user.setPassword(password);
  // Left unverified on purpose: nothing has proved this address, and recording
  // otherwise would be a lie the recovery flow might later depend on. Staff are
  // not gated on verification anyway (see requireVerified).
  await user.save();

  console.log(`\nCreated admin ${user.email} (${user.name}).`);
  console.log("Sign in at your client URL with that address and the password you just set.\n");

  await mongoose.connection.close();
  process.exit(0);
})().catch(async (err) => {
  console.error("\n" + err.message);
  try {
    await mongoose.connection.close();
  } catch {
    /* already closed */
  }
  process.exit(1);
});
