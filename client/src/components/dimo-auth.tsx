import {
  ShareVehiclesWithDimo,
  LogoutWithDimo,
  useDimoAuthState,
} from "@dimo-network/login-with-dimo";
import { Button } from "@/components/ui/button";
import { User, LogOut, Car } from "lucide-react";
import { useCachedDimoAuth } from "@/hooks/use-cached-auth";
import { useEffect } from "react";
import { useQueryClient } from '@tanstack/react-query';

export default function DimoAuth() {
  const { isAuthenticated, email, walletAddress, isFromCache } =
    useCachedDimoAuth();
  const dimoSdkState = useDimoAuthState();
  const queryClient = useQueryClient();

  // Handle authentication state changes after redirect
  useEffect(() => {
    if (dimoSdkState?.isAuthenticated && dimoSdkState?.walletAddress) {
      
      // Cache wallet address
      localStorage.setItem("dimo_cached_wallet_address", dimoSdkState.walletAddress);
      
      // Cache email if available
      if (dimoSdkState.email) {
        localStorage.setItem("dimo_cached_email", dimoSdkState.email);
      }
      
      // Try to get and cache the JWT
      if (dimoSdkState.getValidJWT) {
        try {
          const jwt = dimoSdkState.getValidJWT();
          if (jwt) {
            localStorage.setItem("dimo_cached_token", jwt);
          }
        } catch (error) {
          // JWT caching failed, continue without it
        }
      }
      
      // Force re-render
      window.dispatchEvent(new Event("storage"));
      
      // Retry vehicle loading with smart retry logic (DIMO permissions need time to propagate)
      
      let retryCount = 0;
      let retryTimeouts: NodeJS.Timeout[] = [];
      const maxRetries = 3;
      const retryDelays = [3000, 8000, 15000]; // 3s, 8s, 15s
      
      const cancelRetries = () => {
        retryTimeouts.forEach(timeout => clearTimeout(timeout));
        retryTimeouts = [];
      };
      
      const scheduleRetry = () => {
        if (retryCount >= maxRetries) {
          return;
        }
        
        const delay = retryDelays[retryCount];
        retryCount++;
        
        const timeout = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/dimo/vehicles"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dimo/vehicles", dimoSdkState.walletAddress] });
          
          // Schedule next retry if we haven't reached max
          if (retryCount < maxRetries) {
            scheduleRetry();
          }
        }, delay);
        
        retryTimeouts.push(timeout);
      };
      
      // Listen for successful vehicle loading to cancel retries
      const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
        if (event.type === 'updated' && 
            event.query.queryKey[0] === '/api/dimo/vehicles' && 
            event.query.state.data && 
            (event.query.state.data as any)?.vehicles?.length > 0) {
          cancelRetries();
          unsubscribe();
        }
      });
      
      scheduleRetry();
    }
  }, [dimoSdkState?.isAuthenticated, dimoSdkState?.walletAddress, dimoSdkState?.email, queryClient]);

  const handleShareSuccess = (authData: any) => {
    // Cache wallet address and token directly from authData
    if (authData?.walletAddress) {
      localStorage.setItem(
        "dimo_cached_wallet_address",
        authData.walletAddress,
      );
    }

    if (authData?.token) {
      localStorage.setItem("dimo_cached_token", authData.token);
    }

    // Force re-render by triggering a storage event
    window.dispatchEvent(new Event("storage"));
    
    // Retry vehicle loading after a delay (DIMO permissions need time to propagate)
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/dimo/vehicles"] });
      if (authData?.walletAddress) {
        queryClient.invalidateQueries({ queryKey: ["/api/dimo/vehicles", authData.walletAddress] });
      }
    }, 2000);
  };

  const handleShareError = (error: any) => {
    console.error("DIMO vehicle sharing failed:", error);
  };

  const handleLogoutSuccess = () => {
    // Clear cached wallet address on logout
    if (typeof window !== "undefined") {
      localStorage.removeItem("dimo_cached_wallet_address");
      localStorage.removeItem("dimo_cached_email");
    }
  };

  const handleLogoutError = (error: any) => {
    console.error("DIMO logout failed:", error);
  };

  // Calculate expiration date 1 month from now
  const expirationDate = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  if (isAuthenticated) {
    return (
      <div className="flex items-start space-x-3">
        <div className="flex items-center space-x-2 text-sm">
          <User className="text-blue-600" size={16} />
          <div className="flex flex-col">
            <div
              className="font-medium text-slate-900"
              data-testid="user-email"
            >
              {email || "DIMO User"}
            </div>
            {walletAddress && (
              <div className="text-xs text-slate-500" data-testid="user-wallet">
                {`${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`}
                {isFromCache && (
                  <span className="ml-1 text-orange-500">(cached)</span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-end justify-end sm:space-y-0 sm:space-x-2 space-y-2 space-x-0">
          <ShareVehiclesWithDimo
            mode="redirect"
            permissionTemplateId={2}
            expirationDate={expirationDate}
            unAuthenticatedLabel="Show My Vehicles"
            authenticatedLabel="Manage"
            onSuccess={handleShareSuccess}
            onError={handleShareError}
          >
            <Button
              variant="default"
              size="sm"
              className="flex items-center space-x-2"
              data-testid="button-share-vehicles"
            >
              <Car size={14} />
              <span className="hidden sm:inline">Share Vehicles</span>
              <span className="sm:hidden">Share</span>
            </Button>
          </ShareVehiclesWithDimo>
          <LogoutWithDimo
            mode="redirect"
            onSuccess={handleLogoutSuccess}
            onError={handleLogoutError}
          >
            <Button
              variant="outline"
              size="sm"
              className="flex items-center space-x-1"
              data-testid="button-logout"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </LogoutWithDimo>
        </div>
      </div>
    );
  }

  return (
    <ShareVehiclesWithDimo
      mode="redirect"
      permissionTemplateId={2}
      expirationDate={expirationDate}
      unAuthenticatedLabel="Show My Vehicles"
      authenticatedLabel="Manage"
      onSuccess={handleShareSuccess}
      onError={handleShareError}
    >
      <Button
        variant="default"
        size="sm"
        className="flex items-center space-x-2"
        data-testid="button-share-vehicles"
      >
        <Car size={14} />
        <span className="hidden sm:inline">Share Vehicles</span>
        <span className="sm:hidden">Share</span>
      </Button>
    </ShareVehiclesWithDimo>
  );
}
