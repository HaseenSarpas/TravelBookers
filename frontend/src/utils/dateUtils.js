/**
 * Formats a date string to a human-readable format
 * @param {string} dateStr - ISO date string or YYYY-MM-DD string
 * @returns {string} Formatted date string
 */
export const formatDate = (dateStr) => {
  if (!dateStr) return "";
  
  // Extract date-only portion if it's an ISO string with time (e.g., "2024-12-06T00:00:00.000Z")
  // This prevents timezone shifts when parsing
  let dateOnly = dateStr;
  if (typeof dateStr === 'string' && dateStr.includes('T')) {
    dateOnly = dateStr.split('T')[0];
  }
  
  // Handle YYYY-MM-DD format (from PostgreSQL DATE type) as local date
  if (typeof dateOnly === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    const [year, month, day] = dateOnly.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
  
  // Fallback: try to parse as date (may have timezone issues)
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

