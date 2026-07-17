const TERMINATED_CONTRACT_PATTERN = /中止|終止|取消|失效|停用|terminated|cancel|inactive/i;

function toDateKey(value) {
  const key = String(value || "").trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : "";
}

function addDays(dateKey, days) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return "";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return date.toISOString().slice(0, 10);
}

function localTodayKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

export function isTerminatedContractStatus(value) {
  return TERMINATED_CONTRACT_PATTERN.test(String(value || "").trim());
}

export function getContractLifecycleStatus(contract, today = localTodayKey(), windowDays = 30) {
  if (isTerminatedContractStatus(contract?.status)) return "中止";
  const todayKey = toDateKey(today);
  const endDate = toDateKey(contract?.end_date || contract?.expire_date);
  const reminderEndDate = addDays(todayKey, windowDays);
  if (endDate && reminderEndDate) return endDate <= reminderEndDate ? "即期" : "有效";
  if (/即期|expiring/i.test(String(contract?.status || ""))) return "即期";
  return "有效";
}

export function isContractExpiringWithin(contract, today = localTodayKey(), windowDays = 30) {
  if (isTerminatedContractStatus(contract?.status)) return false;
  const todayKey = toDateKey(today);
  const endDate = toDateKey(contract?.end_date || contract?.expire_date);
  const reminderEndDate = addDays(todayKey, windowDays);
  return Boolean(endDate && todayKey && reminderEndDate && endDate >= todayKey && endDate <= reminderEndDate);
}
