import { Info } from "lucide-react";
import TripDetector from "@/components/trip-detector";

export default function TripDetectionPage() {

  return (
    <div className="min-h-screen bg-background" data-testid="trip-detection">
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Trip Detection - Full Width */}
        <div className="w-full">
          <TripDetector />
        </div>

        {/* Info Section */}
        <div className="mt-8 p-4 bg-muted rounded-lg">
          <div className="flex items-start space-x-3">
            <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-1">About Trip Detection</p>
              <p>
                This page automatically detects trips using your vehicle's ignition signals and GPS data. 
                Select a vehicle and date range to analyze your driving patterns and generate mileage reports.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}