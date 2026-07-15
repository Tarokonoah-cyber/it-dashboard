export function isThreeDigitRoomNumber(value) {
  return /^[0-9]{3}$/.test(String(value || "").trim());
}
