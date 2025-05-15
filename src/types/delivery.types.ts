// src/types/driverApp.types.ts

// Represents the structure of each stop object within the 'optimized_order_sequence'
// (fetched from the 'optimized_daily_routes' table)
export interface OptimizedStopData {
  id: string; // This is the daily_assignment_id (from driver_assignments table)
  order_id: string;
  coordinates: [number, number]; // [longitude, latitude]
  customer_name: string | null;
  full_delivery_address: string | null;
  package_name: string | null;
  user_phone?: string | null;
  delivery_city?: string | null;
  // Include any other fields you denormalized into 'optimized_order_sequence'
  // when saving the optimized route from the admin panel
}

// Represents a delivery task as displayed in the driver's dashboard
export interface DriverDeliveryTask extends OptimizedStopData {
  delivery_status: string; // The current status from the 'driver_assignments' table
}
