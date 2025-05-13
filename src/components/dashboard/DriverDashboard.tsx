import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import "./admin-dash.css"; // Make sure this path matches your project structure

interface Delivery {
  id: string;
  customerName: string;
  address: string;
  status: string;
}

const DriverDashboard: React.FC = () => {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [driverId, setDriverId] = useState<string | null>(null);

  const getLocalDate = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().split("T")[0];
  };

  const fetchDriverId = async () => {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user?.id) setDriverId(data.user.id);
  };

  const fetchDeliveries = async (driverId: string) => {
    setLoading(true);
    try {
      const currentDate = getLocalDate();
      const { data: routes } = await supabase
        .from("optimized_routes")
        .select("optimized_order, status")
        .eq("driver_id", driverId)
        .eq("delivery_date", currentDate);

      if (!routes || routes.length === 0) return setDeliveries([]);

      const { optimized_order, status } = routes[0];

      const { data: orders } = await supabase
        .from("orders")
        .select("id, user_full_name, delivery_address")
        .in("id", optimized_order);

      const mapped = optimized_order
        .map((orderId: string) => {
          const order = orders?.find((o) => o.id === orderId);
          if (!order) return null;
          return {
            id: order.id,
            customerName: order.user_full_name,
            address: order.delivery_address,
            status: status,
          };
        })
        .filter(Boolean);

      setDeliveries(mapped);
    } catch (err) {
      console.error("Error fetching deliveries:", err);
      setDeliveries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDriverId();
  }, []);

  useEffect(() => {
    if (driverId) fetchDeliveries(driverId);
  }, [driverId]);

  return (
    <div className="dashboard-container">
      <h2 className="dashboard-title">Today's Deliveries</h2>

      {loading ? (
        <div className="dashboard-loading">Loading deliveries...</div>
      ) : deliveries.length === 0 ? (
        <div className="dashboard-empty">
          No confirmed deliveries for today.
        </div>
      ) : (
        <div className="delivery-list">
          {deliveries.map((delivery) => (
            <div key={delivery.id} className="delivery-card">
              <div>
                <h3 className="delivery-customer">{delivery.customerName}</h3>
                <p className="delivery-address">{delivery.address}</p>
                <p
                  className={`delivery-status ${delivery.status.toLowerCase()}`}
                >
                  Status: {delivery.status}
                </p>
              </div>
              <a
                className="delivery-view-button"
                href={`/delivery/${delivery.id}`}
              >
                View
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DriverDashboard;
