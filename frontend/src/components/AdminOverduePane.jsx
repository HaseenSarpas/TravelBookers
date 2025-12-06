import { useEffect, useState, useMemo } from "react";
import { formatDate as formatDateUtil } from "../utils/dateUtils";
import "../css/AdminDashboard.css";

const API_BASE = import.meta.env.MODE === "development" ? "http://localhost:3000" : "";

function AdminOverduePane() {
  const [rentals, setRentals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [vehicles, setVehicles] = useState([]);

  useEffect(() => {
    const fetchRentals = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(`${API_BASE}/api/rentals`);
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.message || "Failed to load rentals");
        }
        setRentals(data.data || []);
      } catch (err) {
        setError(err.message || "Failed to load rentals");
      } finally {
        setLoading(false);
      }
    };

    const fetchVehicles = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/vehicles`);
        const data = await res.json();
        if (res.ok && data.success) {
          setVehicles(data.data || []);
        }
      } catch {
        // ignore vehicle fetch errors; we'll just fall back to IDs
      }
    };

    // Initial load
    fetchRentals();
    fetchVehicles();

    // Poll every 10 minutes for overdue changes
    const intervalId = setInterval(fetchRentals, 10 * 60 * 1000);

    return () => clearInterval(intervalId);
  }, []);

  // Get today's date in local timezone, normalized to midnight
  // Calculate on each render to ensure it stays current even if component stays mounted past midnight
  const today = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  })();
  
  // Get today as a date string for useMemo dependency (YYYY-MM-DD format)
  // Recalculate on each render so the memo updates when the day changes
  const todayString = (() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  })();

  // Helper to normalize date strings to local midnight (avoiding timezone issues)
  // PostgreSQL DATE values come as strings, and we need to parse them as local dates
  // This function always extracts the YYYY-MM-DD portion and parses it as a local date
  const normalizeDateForComparison = (dateStr) => {
    if (!dateStr) return null;
    
    // Convert to string if it's not already
    const str = String(dateStr);
    
    // Extract date-only portion (YYYY-MM-DD) from any format
    let dateOnly = str;
    
    // If it's an ISO string with time, extract just the date part
    if (str.includes('T')) {
      dateOnly = str.split('T')[0];
    }
    // If it has a space (like "2024-12-06 00:00:00"), extract just the date part
    else if (str.includes(' ')) {
      dateOnly = str.split(' ')[0];
    }
    
    // Now try to match YYYY-MM-DD format
    const dateMatch = dateOnly.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dateMatch) {
      const [, year, month, day] = dateMatch;
      // Create date in local timezone (not UTC) to avoid timezone shifts
      const date = new Date(Number(year), Number(month) - 1, Number(day));
      date.setHours(0, 0, 0, 0);
      return date;
    }
    
    // Last resort: try to parse as-is and normalize (may have timezone issues)
    const date = new Date(str);
    if (isNaN(date.getTime())) return null;
    // Normalize to local midnight
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const overdueRentals = useMemo(() => {
    const activeRentals = rentals.filter((r) => r.status === "active");
    
    // Debug: log today and active rentals
    console.log("Today:", today, "Today string:", todayString);
    console.log("Active rentals count:", activeRentals.length);
    
    const overdue = activeRentals
      .filter((r) => {
        if (!r.end_date) {
          console.log("Rental", r.rental_id, "has no end_date");
          return false;
        }
        const end = normalizeDateForComparison(r.end_date);
        if (!end) {
          console.log("Rental", r.rental_id, "end_date could not be parsed:", r.end_date);
          return false;
        }
        // Only mark as overdue if end date is strictly before today (not equal to today)
        // Compare dates as date-only (ignore time)
        const isOverdue = end < today;
        console.log(`Rental ${r.rental_id}: end_date=${r.end_date}, parsed=${end.toISOString()}, today=${today.toISOString()}, isOverdue=${isOverdue}`);
        return isOverdue;
      })
      .sort((a, b) => {
        const dateA = normalizeDateForComparison(a.end_date);
        const dateB = normalizeDateForComparison(b.end_date);
        return (dateA || new Date(0)) - (dateB || new Date(0));
      });
    
    console.log("Overdue rentals count:", overdue.length);
    return overdue;
  }, [rentals, todayString]);

  if (loading && rentals.length === 0) {
    return (
      <section className="admin-overdue-pane admin-overdue-pane--loading">
        <p>Checking for overdue rentals...</p>
      </section>
    );
  }

  if (error && rentals.length === 0) {
    return (
      <section className="admin-overdue-pane admin-overdue-pane--error">
        <p>{error}</p>
      </section>
    );
  }

  if (overdueRentals.length === 0) {
    return null;
  }

  const daysOverdue = (endDate) => {
    const end = normalizeDateForComparison(endDate);
    if (!end) return 0;
    const diffMs = today.getTime() - end.getTime();
    return Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  };

  // Use the shared formatDate utility which handles timezone issues correctly
  const formatDate = formatDateUtil;

  const getVehicleLabel = (vehicleId) => {
    const v = vehicles.find((veh) => veh.vehicle_id === vehicleId);
    if (!v) return `Vehicle #${vehicleId}`;
    return `${v.year} ${v.make} ${v.model}`;
  };

  return (
    <section className="admin-overdue-pane">
      <div className="admin-overdue-header">
        <h2>OVERDUE RENTALS</h2>
        <p>
          These vehicles are overdue for return. Please contact customers and process returns
          promptly.
        </p>
      </div>

      <div className="admin-overdue-list">
        {overdueRentals.map((rental) => (
          <div key={rental.rental_id} className="admin-overdue-item">
            <div className="admin-overdue-main">
              <div className="admin-overdue-title">
                <span className="admin-overdue-badge">
                  {daysOverdue(rental.end_date)} day
                  {daysOverdue(rental.end_date) > 1 ? "s" : ""} overdue
                </span>
                <span className="admin-overdue-vehicle">
                  {getVehicleLabel(rental.vehicle_id)} · Rental #{rental.rental_id}
                </span>
              </div>
              <div className="admin-overdue-meta">
                <span>
                  Customer:{" "}
                  {rental.first_name || rental.last_name
                    ? `${rental.first_name || ""} ${rental.last_name || ""}`.trim()
                    : `User #${rental.user_id}`}
                </span>
                {rental.email && <span className="admin-table-subtext"> · {rental.email}</span>}
                {rental.phone && <span className="admin-table-subtext"> · {rental.phone}</span>}
              </div>
              <div className="admin-overdue-dates">
                Scheduled end date: <strong>{formatDate(rental.end_date)}</strong>
              </div>
            </div>
            <div className="admin-overdue-actions">
              <button
                type="button"
                className="admin-secondary-btn admin-overdue-email-btn"
                onClick={() => {
                  // Placeholder: will be wired to mail API later
                  console.log("Email customer clicked", {
                    rental_id: rental.rental_id,
                    email: rental.email,
                  });
                }}
              >
                Email Customer
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default AdminOverduePane;


