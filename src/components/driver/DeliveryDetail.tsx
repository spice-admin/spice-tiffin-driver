import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import "../dashboard/admin-dash.css";

interface Props {
  orderId: string;
}

const DeliveryDetail: React.FC<Props> = ({ orderId }) => {
  const [delivery, setDelivery] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [driverId, setDriverId] = useState<string | null>(null);

  useEffect(() => {
    const fetchDriver = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (data?.user?.id) setDriverId(data.user.id);
      else console.error("Unable to fetch driver ID:", error);
    };
    fetchDriver();
  }, []);

  useEffect(() => {
    const fetchOrder = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase
          .from("orders")
          .select("id, user_full_name, delivery_address, package_name")
          .eq("id", orderId)
          .single();

        if (error) throw error;
        setDelivery(data);
      } catch (err: any) {
        console.error("Error fetching order:", err.message);
        setError("Failed to load delivery details.");
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  const handleStartMap = () => {
    if (!delivery?.delivery_address) return;
    const encodedAddress = encodeURIComponent(delivery.delivery_address);
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`,
      "_blank"
    );
  };

  //   const handleUploadProof = () => {
  //     alert("Upload proof functionality coming soon.");
  //   };

  const getLocalDate = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().split("T")[0];
  };

  const handleFinishDelivery = async () => {
    if (!driverId) {
      alert("Driver ID not available.");
      return;
    }

    try {
      const { error } = await supabase
        .from("optimized_routes")
        .update({ status: "Delivered" })
        .eq("driver_id", driverId)
        .eq("delivery_date", getLocalDate());

      if (error) {
        console.error("Failed to finish delivery:", error.message);
        alert("Failed to finish delivery.");
      } else {
        alert("Delivery marked as Delivered!");
        window.location.href = "/dashboard";
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      alert("Something went wrong!");
    }
  };

  if (loading)
    return <div className="delivery-loader">Loading delivery details...</div>;
  if (error) return <div className="delivery-error">{error}</div>;
  if (!delivery)
    return <div className="delivery-error">No delivery data found.</div>;

  return (
    <div className="delivery-detail-container">
      <h2 className="delivery-detail-title">Delivery Details</h2>
      <div className="delivery-detail-card">
        <p>
          <strong>Customer:</strong> {delivery.user_full_name}
        </p>
        <p>
          <strong>Package:</strong> {delivery.package_name || "N/A"}
        </p>
        <p>
          <strong>Address:</strong> {delivery.delivery_address}
        </p>
        <div className="delivery-actions">
          <button className="delivery-button" onClick={handleStartMap}>
            Start Map
          </button>
          <button
            className="delivery-button upload"
            onClick={() => {
              window.location.href = `/upload_proof/${orderId}`;
            }}
          >
            Upload Delivery Proof
          </button>
          <button
            className="delivery-button finish"
            onClick={handleFinishDelivery}
          >
            Finish Delivery
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeliveryDetail;
