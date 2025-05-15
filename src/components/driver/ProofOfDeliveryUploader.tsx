// src/components/driver/ProofOfDeliveryUploader.tsx
import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import "./proof-of-delivery.css";

// You might want to create a src/types/driverApp.types.ts for these
interface AssignmentDetails {
  id: string; // daily_assignment_id
  customer_name: string | null;
  package_name: string | null;
  full_delivery_address: string | null;
  status: string;
  proof_of_delivery_url: string | null;
}

interface ProofOfDeliveryUploaderProps {
  assignmentId: string; // This is the daily_assignment_id
}

const ProofOfDeliveryUploader: React.FC<ProofOfDeliveryUploaderProps> = ({
  assignmentId,
}) => {
  const [assignmentDetails, setAssignmentDetails] =
    useState<AssignmentDetails | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [currentProofUrl, setCurrentProofUrl] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [finalStatus, setFinalStatus] = useState<string | null>(null); // To show if successfully delivered

  const [error, setError] = useState<string | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(true);
  const [currentDriverId, setCurrentDriverId] = useState<string | null>(null);

  useEffect(() => {
    const getDriver = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setCurrentDriverId(user.id);
      } else {
        setError("Driver not authenticated. Please log in again.");
      }
    };
    getDriver();
  }, []);

  const fetchAssignmentDetails = useCallback(async () => {
    if (!assignmentId) return;
    setIsLoadingDetails(true);
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from("driver_assignments")
        .select(
          "id, customer_name, package_name, full_delivery_address, status, proof_of_delivery_url"
        )
        .eq("id", assignmentId)
        .single();
      if (dbError) throw dbError;
      if (data) {
        setAssignmentDetails(data as AssignmentDetails);
        setCurrentProofUrl(data.proof_of_delivery_url);
        if (data.status === "Delivered") {
          setFinalStatus("Delivered");
        }
      } else {
        setError("Could not find assignment details.");
      }
    } catch (err: any) {
      console.error("Error fetching assignment details:", err);
      setError(`Failed to load assignment: ${err.message}`);
    } finally {
      setIsLoadingDetails(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    fetchAssignmentDetails();
  }, [fetchAssignmentDetails]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        // Max 5MB example
        setError("File is too large. Maximum 5MB allowed.");
        setSelectedFile(null);
        setPreviewUrl(null);
        return;
      }
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        setError("Invalid file type. Only JPG, PNG, WEBP images are allowed.");
        setSelectedFile(null);
        setPreviewUrl(null);
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setSelectedFile(null);
      setPreviewUrl(null);
    }
  };

  const handleUploadProof = async () => {
    if (!selectedFile || !currentDriverId || !assignmentId) {
      setError("No file selected or missing critical information.");
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    // Create a unique file name/path
    const fileExtension = selectedFile.name.split(".").pop();
    const fileName = `${assignmentId}-${Date.now()}.${fileExtension}`;
    const filePath = `${currentDriverId}/${fileName}`; // Store under driver's folder

    try {
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("delivery-proofs") // Your bucket name
        .upload(filePath, selectedFile, {
          cacheControl: "3600",
          upsert: true, // Overwrite if file with same name exists (useful for re-uploads)
          //contentType: selectedFile.type // Optional: Supabase usually infers this
        });

      if (uploadError) throw uploadError;

      // Get public URL (ensure bucket policies allow public reads or use signed URLs for private)
      const { data: urlData } = supabase.storage
        .from("delivery-proofs")
        .getPublicUrl(filePath);

      const publicUrl = urlData?.publicUrl;
      if (!publicUrl) {
        throw new Error("Could not get public URL for the uploaded file.");
      }

      console.log("File uploaded successfully:", publicUrl);

      // Update driver_assignments table with the proof_of_delivery_url
      const { error: dbUpdateError } = await supabase
        .from("driver_assignments")
        .update({
          proof_of_delivery_url: publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", assignmentId)
        .eq("driver_id", currentDriverId); // Ensure driver owns this assignment

      if (dbUpdateError) throw dbUpdateError;

      setCurrentProofUrl(publicUrl); // Update UI to show new proof
      setSelectedFile(null); // Clear selection
      setPreviewUrl(null); // Clear preview
      alert("Proof uploaded successfully!");
    } catch (err: any) {
      console.error("Error during proof upload:", err);
      setError(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
      //   setUploadProgress(0);
    }
  };

  const handleMarkDelivered = async () => {
    if (!currentDriverId || !assignmentId || !currentProofUrl) {
      setError(
        "Cannot mark as delivered. Proof of delivery might be missing or not saved."
      );
      return;
    }
    setIsUpdatingStatus(true);
    setError(null);
    try {
      const { data, error: updateError } = await supabase
        .from("driver_assignments")
        .update({ status: "Delivered", updated_at: new Date().toISOString() })
        .eq("id", assignmentId)
        .eq("driver_id", currentDriverId)
        .select()
        .single();

      if (updateError) throw updateError;

      if (data) {
        setAssignmentDetails((prev) =>
          prev ? { ...prev, status: "Delivered" } : null
        );
        setFinalStatus("Delivered");
        alert("Delivery successfully marked as Delivered!");
        // Optionally navigate back to dashboard after a delay or on user action
        // window.location.href = '/driver/dashboard'; // Adjust path
      } else {
        throw new Error("Failed to confirm status update from server.");
      }
    } catch (err: any) {
      console.error("Error marking as delivered:", err);
      setError(`Failed to mark as delivered: ${err.message}`);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  if (isLoadingDetails) {
    return <div className="pod-loading">Loading assignment details...</div>;
  }

  if (!assignmentDetails) {
    return (
      <div className="pod-error">
        {error || "Assignment not found or access denied."}
      </div>
    );
  }

  // If already delivered and has proof, show a summary
  if (
    finalStatus === "Delivered" ||
    (assignmentDetails.status === "Delivered" && currentProofUrl)
  ) {
    return (
      <div className="pod-container pod-completed">
        <h3>Delivery Completed!</h3>
        <p>
          <strong>Customer:</strong> {assignmentDetails.customer_name || "N/A"}
        </p>
        <p>
          <strong>Package:</strong> {assignmentDetails.package_name || "N/A"}
        </p>
        {currentProofUrl && (
          <div>
            <p>
              <strong>Proof of Delivery:</strong>
            </p>
            <img
              src={currentProofUrl}
              alt="Proof of delivery"
              style={{
                maxWidth: "100%",
                maxHeight: "300px",
                borderRadius: "4px",
                marginTop: "10px",
              }}
            />
          </div>
        )}
        <button
          onClick={() => (window.location.href = "/driver/dashboard")}
          className="pod-button button-back"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="pod-container">
      <div className="pod-order-summary">
        <h3>Delivery for: {assignmentDetails.customer_name || "N/A"}</h3>
        <p>
          <strong>Package:</strong> {assignmentDetails.package_name || "N/A"}
        </p>
        <p>
          <strong>Address:</strong>{" "}
          {assignmentDetails.full_delivery_address || "N/A"}
        </p>
      </div>

      {error && <p className="pod-error-message">{error}</p>}

      {!currentProofUrl && (
        <div className="pod-upload-section">
          <h4>Upload Proof of Delivery (Image)</h4>
          <input
            type="file"
            accept="image/*"
            capture="environment" // <--- KEY ADDITION HERE
            onChange={handleFileChange}
            disabled={isUploading}
            className="pod-file-input"
          />
          {previewUrl && (
            <img src={previewUrl} alt="Preview" className="pod-image-preview" />
          )}
          {selectedFile && !isUploading && (
            <button
              onClick={handleUploadProof}
              className="pod-button button-upload"
              disabled={isUploading}
            >
              Upload: {selectedFile.name}
            </button>
          )}
          {isUploading && (
            <div className="pod-progress-area">
              <p>
                Uploading:{" "}
                {uploadProgress > 0 ? `${uploadProgress}%` : "Please wait..."}
              </p>
              {/* For actual progress, Supabase client v2 upload doesn't directly expose onProgress for .upload()
                  You might need to use XHR or a different method if granular progress is essential.
                  For simplicity, this shows a static "Uploading..." message.
                  If supabase-js v2.x upload `onProgress` is available with fetch, you'd implement it.
                  Otherwise, this is a simple spinner or message.
              */}
            </div>
          )}
        </div>
      )}

      {currentProofUrl &&
        finalStatus !== "Delivered" &&
        assignmentDetails.status !== "Delivered" && ( // Ensure we don't show re-upload if already finalized
          <div className="pod-proof-display-section">
            <h4>Proof Uploaded:</h4>
            <img
              src={currentProofUrl}
              alt="Proof of delivery"
              className="pod-image-preview"
            />
            <p>
              <small>To change the proof, select a new image:</small>
            </p>
            <input
              type="file"
              accept="image/*"
              capture="environment" // <--- KEY ADDITION HERE (for re-upload)
              onChange={handleFileChange}
              className="pod-file-input"
              disabled={isUploading || isUpdatingStatus}
            />
            {previewUrl && selectedFile && !isUploading && (
              <button
                onClick={handleUploadProof}
                className="pod-button button-upload"
                disabled={isUploading}
              >
                Re-upload: {selectedFile.name}
              </button>
            )}
          </div>
        )}

      {currentProofUrl && !isUploading && (
        <div className="pod-actions">
          <button
            onClick={handleMarkDelivered}
            className="pod-button button-delivered"
            disabled={isUpdatingStatus}
          >
            {isUpdatingStatus ? "Saving..." : "Mark as Delivered"}
          </button>
        </div>
      )}
    </div>
  );
};

export default ProofOfDeliveryUploader;
