// src/components/driver/DriverDashboard.tsx
import React, { useEffect, useState, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient"; // Adjust path to your Supabase client
import { format } from "date-fns";
import { parseISO } from "date-fns";
// If you created src/types/driverApp.types.ts, import from there:
// import type { OptimizedStopData, DriverDeliveryTask } from '../../types/delivery.types';
import "./admin-dash.css";

// If defining types locally for now:
interface OptimizedStopData {
  id: string; // This is the daily_assignment_id
  order_id: string;
  coordinates: [number, number]; // [longitude, latitude]
  customer_name: string | null;
  full_delivery_address: string | null;
  package_name: string | null;
  user_phone?: string | null;
  delivery_city?: string | null;
  // Add any other fields you denormalized into optimized_order_sequence
}

interface DriverDeliveryTask extends OptimizedStopData {
  delivery_status: string; // Current status from 'driver_assignments'
}
// End local type definitions

const DriverDashboard: React.FC = () => {
  const [deliveries, setDeliveries] = useState<DriverDeliveryTask[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState<string>(""); // Will be YYYY-MM-DD

  // Function to get today's date in YYYY-MM-DD format
  const getLocalDateString = useCallback(() => {
    return new Date().toISOString().split("T")[0];
  }, []);

  // Effect to set current date and fetch driver ID on mount
  useEffect(() => {
    setCurrentDate(getLocalDateString());
    const fetchSupabaseDriverId = async () => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) {
        console.error("Error fetching authenticated user:", authError);
        setError("Failed to identify driver. Please ensure you are logged in.");
        setLoading(false);
        return;
      }
      if (user?.id) {
        setDriverId(user.id);
      } else {
        setError("No driver logged in. Please log in to view deliveries.");
        setLoading(false);
      }
    };
    fetchSupabaseDriverId();
  }, [getLocalDateString]);

  // Main data fetching function
  const fetchDeliveriesForDriver = useCallback(
    async (currentDriverId: string, dateStr: string) => {
      if (!currentDriverId || !dateStr) {
        setDeliveries([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        console.log(
          `DriverDashboard: Fetching optimized route for driver ${currentDriverId} on ${dateStr}`
        );

        // 1. Fetch the optimized route for the driver and current date
        const { data: routeData, error: routeError } = await supabase
          .from("optimized_daily_routes") // Your new table name
          .select("optimized_order_sequence, status") // 'status' here is the overall route status
          .eq("driver_id", currentDriverId)
          .eq("route_date", dateStr)
          .single(); // Expect one route per driver per day

        if (routeError && routeError.code !== "PGRST116") {
          // PGRST116: 0 rows found
          console.error(
            "DriverDashboard: Error fetching optimized route:",
            routeError
          );
          throw routeError;
        }

        if (!routeData || !routeData.optimized_order_sequence) {
          console.log(
            "DriverDashboard: No optimized route found or sequence is empty for today."
          );
          setDeliveries([]);
          return;
        }

        const sequencedStops =
          routeData.optimized_order_sequence as OptimizedStopData[];
        if (sequencedStops.length === 0) {
          console.log("DriverDashboard: Optimized sequence has no stops.");
          setDeliveries([]);
          return;
        }

        // 'stop.id' in sequencedStops is the daily_assignment_id
        const dailyAssignmentIds = sequencedStops.map((stop) => stop.id);

        if (dailyAssignmentIds.length === 0) {
          // Should not happen if sequencedStops had items
          setDeliveries([]);
          return;
        }

        // 2. Fetch current statuses for these daily assignments from 'driver_assignments' table
        console.log(
          "DriverDashboard: Fetching statuses for assignment IDs:",
          dailyAssignmentIds
        );
        const { data: assignmentStatuses, error: statusError } = await supabase
          .from("driver_assignments")
          .select("id, status") // id here is daily_assignment_id
          .in("id", dailyAssignmentIds);

        if (statusError) {
          console.error(
            "DriverDashboard: Error fetching assignment statuses:",
            statusError
          );
          throw statusError;
        }

        const statusMap = new Map<string, string>();
        assignmentStatuses?.forEach((item) => {
          statusMap.set(item.id, item.status);
        });
        console.log("DriverDashboard: Status map created:", statusMap);

        // 3. Map the sequenced stops to include the individual delivery status
        const mappedDeliveries: DriverDeliveryTask[] = sequencedStops.map(
          (stop) => {
            return {
              ...stop, // Spreads all properties from OptimizedStopData
              delivery_status: statusMap.get(stop.id) || "Status Unknown", // stop.id is daily_assignment_id
            };
          }
        );
        console.log(
          "DriverDashboard: Mapped deliveries with statuses:",
          mappedDeliveries
        );
        setDeliveries(mappedDeliveries);
      } catch (err: any) {
        console.error(
          "DriverDashboard: Error in fetchDeliveriesForDriver:",
          err.message
        );
        setError(`Failed to load today's deliveries: ${err.message}`);
        setDeliveries([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Effect to fetch deliveries when driverId or currentDate is set/changed
  useEffect(() => {
    if (driverId && currentDate) {
      fetchDeliveriesForDriver(driverId, currentDate);
    }
  }, [driverId, currentDate, fetchDeliveriesForDriver]);

  const handleViewOnGoogleMaps = (delivery: DriverDeliveryTask) => {
    if (
      delivery.coordinates &&
      delivery.coordinates[1] != null &&
      delivery.coordinates[0] != null
    ) {
      const lat = delivery.coordinates[1]; // Latitude
      const lng = delivery.coordinates[0]; // Longitude

      // For opening directions in Google Maps app or web
      const destinationQuery = encodeURIComponent(
        delivery.full_delivery_address || `${lat},${lng}`
      );
      const url = `https://www.google.com/maps/dir/?api=1&destination=${destinationQuery}`;
      // For a simple pin: const url = `https://www.google.com/maps?q=encoded_address{lat},${lng}`;

      console.log("Opening Google Maps with URL:", url);
      window.open(url, "_blank"); // Opens in a new tab
    } else {
      alert("Location coordinates are not available for this delivery.");
    }
  };

  const handleUpdateStatus = async (
    dailyAssignmentId: string,
    newStatus: "Delivered" | "Failed"
  ) => {
    if (!driverId) return;

    console.log(
      `DriverDashboard: Attempting to update assignment ${dailyAssignmentId} to ${newStatus}`
    );
    // Optimistically update UI or show loading on the specific item
    // For now, let's do a general loading state.
    setLoading(true);
    try {
      const { data, error: updateError } = await supabase
        .from("driver_assignments")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", dailyAssignmentId)
        .eq("driver_id", driverId) // Ensure driver can only update their own assignments
        .select() // Select to confirm update and get the updated row
        .single();

      if (updateError) {
        console.error(
          "DriverDashboard: Error updating delivery status:",
          updateError
        );
        throw updateError;
      }

      if (data) {
        // Update local state to reflect change immediately
        setDeliveries((prevDeliveries) =>
          prevDeliveries.map((d) =>
            d.id === dailyAssignmentId
              ? { ...d, delivery_status: newStatus }
              : d
          )
        );
        alert(`Delivery marked as ${newStatus}!`);
      } else {
        throw new Error("Failed to confirm status update from server.");
      }
    } catch (err: any) {
      console.error("DriverDashboard: Failed to update status:", err);
      alert(`Error updating status: ${err.message}. Please try again.`);
      // Optionally revert optimistic UI update here if you implemented one
    } finally {
      setLoading(false);
    }
  };

  if (loading && deliveries.length === 0 && !error) {
    return (
      <div className="dashboard-loading">
        Loading your deliveries for today...
      </div>
    );
  }

  if (error) {
    return <div className="dashboard-error">Error: {error}</div>;
  }

  return (
    <div className="driver-dashboard-container">
      <h2 className="driver-dashboard-title">
        Today's Deliveries (
        {currentDate ? format(parseISO(currentDate), "MMMM dd, yyyy") : ""})
      </h2>

      {deliveries.length === 0 && !loading && (
        <div className="driver-dashboard-empty">
          No deliveries assigned for today, or all tasks are completed. Great
          job!
        </div>
      )}

      {deliveries.length > 0 && (
        <div className="delivery-list">
          {deliveries.map((delivery, index) => (
            <div
              key={delivery.id /* daily_assignment_id */}
              className={`delivery-card status-${delivery.delivery_status
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")}`}
            >
              <div className="delivery-card-header">
                <span className="delivery-stop-number">{index + 1}</span>
                <h3 className="delivery-customer">
                  {delivery.customer_name || "N/A"}
                </h3>
                <span
                  className={`delivery-status-badge status-${delivery.delivery_status
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")}`}
                >
                  {delivery.delivery_status}
                </span>
              </div>
              <div className="delivery-card-body">
                <p className="delivery-package">
                  <strong>Package:</strong> {delivery.package_name || "N/A"}
                </p>
                <p className="delivery-address">
                  <strong>Address:</strong>{" "}
                  {delivery.full_delivery_address || "N/A"}
                </p>
                {delivery.user_phone && (
                  <p className="delivery-phone">
                    <strong>Phone:</strong>{" "}
                    <a href={`tel:${delivery.user_phone}`}>
                      {delivery.user_phone}
                    </a>
                  </p>
                )}
              </div>
              <div className="delivery-card-actions">
                <button
                  onClick={() => handleViewOnGoogleMaps(delivery)}
                  className="delivery-action-button button-navigate"
                  disabled={
                    !delivery.coordinates ||
                    delivery.coordinates[0] == null ||
                    delivery.coordinates[1] == null
                  }
                >
                  View on Google Maps
                </button>

                {delivery.delivery_status === "Pending" ||
                delivery.delivery_status === "Out for Delivery" ? (
                  <>
                    <button
                      onClick={() =>
                        handleUpdateStatus(delivery.id, "Delivered")
                      }
                      className="delivery-action-button button-delivered"
                      disabled={loading} // Disable if any global loading is true
                    >
                      Mark Delivered
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(delivery.id, "Failed")}
                      className="delivery-action-button button-failed" // You'll need CSS for .button-failed
                      disabled={loading}
                    >
                      Mark Failed
                    </button>
                  </>
                ) : delivery.delivery_status === "Delivered" ? (
                  <span className="status-finalized-text">Completed</span>
                ) : delivery.delivery_status === "Failed" ? (
                  <span className="status-finalized-text error-text">
                    Delivery Failed
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DriverDashboard;
