/** Keep validation guidance useful while hiding database and transport internals. */
export function userError(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (!error) return fallback;
  const message = typeof error === "string" ? error : String((error as { message?: unknown }).message || "");
  if (/abort|timed?\s*out|timeout|deadline/i.test(message))
    return "The data request took too long. Your saved data is safe. Please try again.";
  if (/network|failed to fetch|fetch failed|network_access_denied|network request failed/i.test(message))
    return "Unable to connect. Check your internet connection and try again.";
  if (/jwt|refresh.?token|session.*expired|invalid.*token/i.test(message))
    return "Your session has expired. Sign in again to continue.";
  if (/permission denied|row.level security|42501|violates.*policy/i.test(message))
    return "Your account cannot perform this action. Contact your workspace administrator.";
  if (/duplicate key|23505/i.test(message))
    return "This record already exists. Refresh the page before trying again.";
  if (/foreign key|23503/i.test(message))
    return "A related record is no longer available. Refresh and select it again.";
  if (/relation .*does not exist|column .*does not exist|schema cache|PGRST|SQLSTATE|postgres|stack trace/i.test(message))
    return "This feature is temporarily unavailable. Please try again or contact your administrator.";
  return message.trim() && message.length <= 500 ? message : fallback;
}
