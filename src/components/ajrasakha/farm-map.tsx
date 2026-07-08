import { useState, useEffect } from "react";
import { Map, Marker } from "@vis.gl/react-google-maps";
import { MapPin, Compass, Globe, Info, Navigation } from "lucide-react";
import { toast } from "sonner";

interface FarmMapProps {
  initialLat?: number;
  initialLng?: number;
  onLocationChange?: (lat: number, lng: number) => void;
}

export function FarmMap({
  initialLat = 12.9716, // Default to Bengaluru coordinates
  initialLng = 77.5946,
  onLocationChange,
}: FarmMapProps) {
  const [position, setPosition] = useState({ lat: initialLat, lng: initialLng });
  const [mounted, setMounted] = useState(false);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const triggerGeolocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setPosition({ lat, lng });
          if (onLocationChange) {
            onLocationChange(lat, lng);
          }
        },
        (err) => {
          console.warn("Geolocation lookup failed or denied:", err.message);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  };

  useEffect(() => {
    setMounted(true);
    triggerGeolocation();
  }, []);

  const handleLocateMe = () => {
    if (navigator.geolocation) {
      toast.info("Requesting your location...");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setPosition({ lat, lng });
          toast.success("Location centered on your current position!");
          if (onLocationChange) {
            onLocationChange(lat, lng);
          }
        },
        (err) => {
          console.warn("Geolocation lookup failed or denied:", err.message);
          if (err.code === 1) {
            toast.error("Location permission denied. Please allow location access in your browser settings (look for the lock icon in the address bar).");
          } else {
            toast.error(`Unable to find location: ${err.message}`);
          }
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      toast.error("Geolocation is not supported by your browser.");
    }
  };

  const handleMarkerDragEnd = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const newLat = e.latLng.lat();
      const newLng = e.latLng.lng();
      setPosition({ lat: newLat, lng: newLng });
      if (onLocationChange) {
        onLocationChange(newLat, newLng);
      }
    }
  };

  // Render a loading skeleton during server-side rendering and initial hydration tick
  if (!mounted) {
    return (
      <div className="relative w-full h-[350px] rounded-2xl border border-border/70 overflow-hidden bg-muted animate-pulse flex items-center justify-center">
        <p className="text-xs text-muted-foreground font-display">Loading Map Component...</p>
      </div>
    );
  }

  // Render a mock interactive preview if the API key is not configured
  if (!apiKey || apiKey.trim() === "") {
    return (
      <div className="relative w-full h-[350px] rounded-2xl border border-border/70 overflow-hidden bg-gradient-to-br from-muted/50 to-accent/25 flex flex-col items-center justify-center p-6 text-center">
        {/* Abstract grid lines to simulate a map */}
        <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px]" />
        
        {/* Animated mock marker */}
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute -inset-2 rounded-full bg-primary/20 blur-sm animate-ping" />
            <div className="grid size-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-md">
              <MapPin className="size-6" />
            </div>
          </div>

          <div className="max-w-xs space-y-2">
            <h3 className="font-display font-semibold text-sm sm:text-base">Google Maps API Key Required</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Add your <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono border border-border/70">VITE_GOOGLE_MAPS_API_KEY</code> to the <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono border border-border/70">.env</code> file to load the live interactive map.
            </p>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-xs bg-card/85 backdrop-blur border border-border/70 p-3 rounded-xl shadow-sm">
            <span className="flex items-center gap-1"><Compass className="size-3 text-primary animate-spin" /> Lat: {position.lat.toFixed(4)}</span>
            <span className="flex items-center gap-1"><Globe className="size-3 text-primary" /> Lng: {position.lng.toFixed(4)}</span>
          </div>
          
          <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
            <Info className="size-3 text-primary" /> Dragging the live marker will auto-sync field coordinates.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[350px] rounded-2xl border border-border/70 overflow-hidden shadow-inner">
      {/* Locate Me Button Overlay */}
      <button
        type="button"
        onClick={handleLocateMe}
        className="absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-background hover:bg-accent/80 text-foreground border border-border/70 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-md transition-all active:scale-95 cursor-pointer"
      >
        <Navigation className="size-3.5 text-primary" />
        Locate Me
      </button>

      <Map
        center={position}
        defaultZoom={15}
        gestureHandling="cooperative"
        disableDefaultUI={false}
      >
        <Marker
          position={position}
          draggable={true}
          onDragEnd={handleMarkerDragEnd}
        />
      </Map>

      {/* Floating coordinates indicator */}
      <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur border border-border px-3 py-1.5 rounded-lg text-xs shadow-sm font-mono flex items-center gap-2">
        <MapPin className="size-3.5 text-primary" />
        <span>Lat: {position.lat.toFixed(4)}</span>
        <span className="text-muted-foreground">|</span>
        <span>Lng: {position.lng.toFixed(4)}</span>
      </div>
    </div>
  );
}
