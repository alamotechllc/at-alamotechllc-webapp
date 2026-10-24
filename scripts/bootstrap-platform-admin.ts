import { auth, firestore, grantPlatformAdmin } from "@raas/store";
import { staffEligible } from "@raas/auth";

const phrase = process.env.BOOTSTRAP_PHRASE?.trim();
const email = process.argv.find((arg) => arg.startsWith("--email="))?.slice("--email=".length) ?? "";

if (phrase !== "AUTHORIZE PLATFORM ADMIN BOOTSTRAP") {
  console.error("BOOTSTRAP STOPPED");
  console.error("Set BOOTSTRAP_PHRASE to AUTHORIZE PLATFORM ADMIN BOOTSTRAP.");
  process.exit(1);
}

if (!email.includes("@")) {
  console.error("BOOTSTRAP STOPPED");
  console.error("Pass --email=<workspace-email>.");
  process.exit(1);
}

const emulator = Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);
if (!staffEligible({
  email,
  emulator,
  signInProvider: emulator ? "custom" : "google.com",
  operatorDomain: process.env.OPERATOR_HOSTED_DOMAIN,
})) {
  console.error("BOOTSTRAP STOPPED");
  console.error("That email is not eligible for platform_admin.");
  process.exit(1);
}

const user = await auth().getUserByEmail(email).catch(() => null);
if (!user) {
  console.error("BOOTSTRAP STOPPED");
  console.error("Sign in with that Google account once, then run this command again. The first sign-in does not grant access.");
  process.exit(1);
}

await grantPlatformAdmin(firestore(), auth(), {
  uid: user.uid,
  email,
  actorUid: "bootstrap",
  requestId: "bootstrap-platform-admin",
  signInProvider: emulator ? "custom" : "google.com",
});

console.log(`platform_admin granted to uid ${user.uid}. Refresh tokens were revoked.`);
