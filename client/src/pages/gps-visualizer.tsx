import { Info } from "lucide-react";
import logoBlack from "@/assets/logo-black.png";
import logoWhite from "@/assets/logo-white.png";
import TripDetector from "@/components/trip-detector";
import { useTheme } from "@/components/theme-provider";
import GitHubButton from "react-github-btn";

export default function TripDetectionPage() {
  const { theme } = useTheme();

  return (
    <div className="min-h-screen bg-background" data-testid="trip-detection">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-2">
              <img
                src={theme === "dark" ? logoWhite : logoBlack}
                alt="DIMO Logo"
                className="h-8 w-auto"
              />
              <span className="text-xl font-bold">Trip Detection</span>
            </div>
          </div>
        </div>
      </div>

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