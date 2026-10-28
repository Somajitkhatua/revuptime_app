export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function nonNegativeNumber(value: string) {
  return (
    value.trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0
  );
}
export function installationTimestamp(
  date: string,
  time: string,
): string | null {
  if (time && !date)
    throw new Error("Enter an installation date before the time.");
  if (date && !validDate(date))
    throw new Error("Enter a valid installation date (YYYY-MM-DD).");
  if (!time) return null;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))
    throw new Error("Enter installation time as HH:mm, for example 09:30.");
  const result = new Date(`${date}T${time}:00`);
  if (
    result.getHours() !== Number(time.slice(0, 2)) ||
    result.getMinutes() !== Number(time.slice(3))
  )
    throw new Error(
      "This local time does not exist due to a clock change. Choose another time.",
    );
  return result.toISOString();
}
