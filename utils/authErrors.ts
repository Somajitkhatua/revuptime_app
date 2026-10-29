export function authError(error: {
  code?: string;
  status?: number;
  message?: string;
}) {
  const message = error.message || "";
  if (/invalid login credentials|invalid credentials|email or password/i.test(message))
    return new Error("Check your email and password, then try again.");
  if (
    error.code === "over_email_send_rate_limit" ||
    error.code === "over_request_rate_limit" ||
    error.status === 429
  )
    return new Error(
      "Too many email requests. Please wait before retrying. If this continues, contact support.",
    );
  if (error.code === "email_address_not_authorized")
    return new Error(
      "Email delivery is not available for this address. Contact support to enable verification emails.",
    );
  if (error.code === "email_not_confirmed")
    return new Error(
      "Verify your email before signing in. Check your inbox or request a new verification email.",
    );
  return new Error(
    message || "Unable to sign in. Please try again.",
  );
}
