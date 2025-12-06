/**
 * Formats a date string to a human-readable format
 * @param {string} dateStr - ISO date string
 * @returns {string} Formatted date string
 */
export const formatDate = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

/**
 * Formats a Date object to YYYY-MM-DD string (date-only, no timezone conversion)
 * This prevents timezone issues when storing dates in the database
 * @param {Date} date - Date object
 * @returns {string} Date string in YYYY-MM-DD format
 */
export const formatDateForAPI = (date) => {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

