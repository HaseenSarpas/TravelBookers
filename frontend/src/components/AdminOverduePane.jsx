import { useEffect, useState, useMemo } from "react";
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

  // Helper to normalize date strings to local midnight (avoiding timezone issues)
  // PostgreSQL DATE values come as strings, and we need to parse them as local dates
  const normalizeDateForComparison = (dateStr) => {
    if (!dateStr) return null;
    
    // Extract date-only portion if it's an ISO string with time
    let dateOnly = dateStr;
    if (typeof dateStr === 'string' && dateStr.includes('T')) {
      dateOnly = dateStr.split('T')[0];
    }
    
    // If date is in YYYY-MM-DD format, parse it as local date (not UTC)
    if (typeof dateOnly === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
      const [year, month, day] = dateOnly.split('-').map(Number);
      // Create date in local timezone (not UTC)
      const date = new Date(year, month - 1, day);
      date.setHours(0, 0, 0, 0);
      return date;
    }
    
    // Fallback: try to parse and normalize
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    // Normalize to local midnight
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const overdueRentals = useMemo(() => {
    return rentals
      .filter((r) => r.status === "active")
      .filter((r) => {
        if (!r.end_date) return false;
        const end = normalizeDateForComparison(r.end_date);
        if (!end) return false;
        // Only mark as overdue if end date is strictly before today (not equal to today)
        // Compare dates as date-only (ignore time)
        return end < today;
      })
      .sort((a, b) => {
        const dateA = normalizeDateForComparison(a.end_date);
        const dateB = normalizeDateForComparison(b.end_date);
        return (dateA || new Date(0)) - (dateB || new Date(0));
      });
  }, [rentals, today]);

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

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    
    // Handle YYYY-MM-DD format (from PostgreSQL DATE type) as local date
    if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [year, month, day] = dateStr.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      if (Number.isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
    
    // Handle ISO strings or other formats
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

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


