import React, { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import "../dashboard/admin-dash.css";

interface Props {
  orderId: string;
}

const UploadProof: React.FC<Props> = ({ orderId }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [driverName, setDriverName] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");

  useEffect(() => {
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        console.error("Camera error:", err);
      }
    };

    const fetchUserInfo = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id;
      setDriverId(uid || null);

      if (uid) {
        const { data: driver } = await supabase
          .from("drivers")
          .select("full_name")
          .eq("id", uid)
          .single();

        setDriverName(driver?.full_name || "");

        const { data: order } = await supabase
          .from("orders")
          .select("user_full_name")
          .eq("id", orderId)
          .single();

        setCustomerName(order?.user_full_name || "");
      }
    };

    initCamera();
    fetchUserInfo();
  }, [orderId]);

  const handleCaptureAndUpload = async () => {
    if (!videoRef.current || !canvasRef.current || !driverId) return;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    canvasRef.current.width = 320;
    canvasRef.current.height = 240;
    ctx.drawImage(videoRef.current, 0, 0, 320, 240);

    canvasRef.current.toBlob(
      async (blob) => {
        if (!blob) return;

        // Compress and upload
        const file = new File([blob], `proof-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });

        const { data: storageData, error: storageError } =
          await supabase.storage
            .from("delivery-proofs")
            .upload(`proofs/${file.name}`, file);

        if (storageError) {
          console.error("Upload error:", storageError);
          return;
        }

        const imageUrl = supabase.storage
          .from("delivery-proofs")
          .getPublicUrl(storageData.path).data.publicUrl;

        const { error: insertError } = await supabase
          .from("delivery_proofs")
          .insert({
            driver_id: driverId,
            order_id: orderId,
            image_url: imageUrl,
            customer_name: customerName,
            driver_name: driverName,
          });

        if (insertError) {
          console.error("Insert DB error:", insertError);
          return;
        }

        alert("Proof uploaded successfully!");
        window.location.href = `/delivery/${orderId}`;
      },
      "image/jpeg",
      0.7
    ); // 70% compression
  };

  return (
    <div className="upload-container">
      <h2 className="upload-title">Upload Delivery Proof</h2>
      <video ref={videoRef} autoPlay className="upload-video" />
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <button onClick={handleCaptureAndUpload} className="upload-button">
        Capture & Upload
      </button>
    </div>
  );
};

export default UploadProof;
