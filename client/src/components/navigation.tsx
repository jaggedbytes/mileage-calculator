import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Car, MapPin, Navigation } from "lucide-react";
import logoBlack from "@/assets/logo-black.png";
import logoWhite from "@/assets/logo-white.png";
import DimoAuth from "./dimo-auth";
import { useTheme } from "./theme-provider";

export default function AppNavigation() {
  const [location] = useLocation();
  const { theme } = useTheme();

  const navItems = [
    {
      href: "/",
      label: "Mileage Calculator",
      icon: Navigation,
      description: "Trip detection and mileage tracking"
    },
    {
      href: "/shared-vehicles",
      label: "My Vehicles",
      icon: Car,
      description: "View shared vehicles and location data"
    }
  ];

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Auth */}
        <div className="flex h-16 items-center justify-end">
          <DimoAuth />
        </div>
        <div className="flex h-16 items-center">
          {/* Navigation */}
          <div className="flex items-center space-x-8">
            <img
              src={theme === "dark" ? logoWhite : logoBlack}
              alt="DIMO Logo"
              className="h-8 w-auto"
            />
            <nav className="hidden lg:flex space-x-6">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.href;
                
                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={isActive ? "default" : "ghost"}
                      className="flex items-center space-x-2"
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Button>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="lg:hidden pb-4">
          <nav className="flex space-x-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    className="flex items-center space-x-2"
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Button>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}

