import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import styles from "./MapView.module.css";

// Fix bundler issue: leaflet default icons reference files that bundlers can't resolve
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export interface Location {
  name: string;
  lat: number;
  lng: number;
}

function FitBounds({ locations }: { locations: Location[] }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (fitted.current) return;
    fitted.current = true;

    if (locations.length === 1) {
      map.setView([locations[0].lat, locations[0].lng], 13);
    } else if (locations.length > 1) {
      const bounds = L.latLngBounds(
        locations.map((l) => [l.lat, l.lng] as [number, number])
      );
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [map, locations]);

  return null;
}

function FlyTo({ location }: { location: Location | null }) {
  const map = useMap();

  useEffect(() => {
    if (!location) return;
    map.flyTo([location.lat, location.lng], 14, { duration: 0.7 });
  }, [map, location]);

  return null;
}

interface Props {
  locations: Location[];
  focusLocation?: Location | null;
}

export default function MapView({ locations, focusLocation = null }: Props) {
  const center = locations[0] ?? { lat: 20, lng: 0 };

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={5}
      className={styles.map}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds locations={locations} />
      <FlyTo location={focusLocation} />
      {locations.map((loc, i) => (
        <Marker key={i} position={[loc.lat, loc.lng]}>
          <Popup>
            <strong>{loc.name}</strong>
            <br />
            <span className={styles.popupCoords}>
              {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
            </span>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
