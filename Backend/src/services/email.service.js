/**
 * Mode dev : affiche le mail dans la console.
 * Plus tard : remplacer par Brevo / Gmail.
 */
export async function sendPasswordResetCode({ to, code }) {
  console.log("========================================");
  console.log("  SECUREDRIVE — PASSWORD RESET CODE");
  console.log("  To  :", to);
  console.log("  Code:", code);
  console.log("  (valid 15 minutes)");
  console.log("========================================");

  return { ok: true, mode: "console" };
}