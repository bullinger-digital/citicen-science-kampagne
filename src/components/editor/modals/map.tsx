import { LatLngExpression } from "leaflet";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
import { useEffect, useMemo, useRef } from "react";

let DefaultIcon = L.icon({
  iconUrl: icon.src,
  shadowUrl: iconShadow.src,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const CH_COORDS: LatLngExpression = [46.8182, 8.2275];

L.Marker.prototype.options.icon = DefaultIcon;

export const LeafletMap = ({
  latitude,
  longitude,
  setPosition,
  readOnly,
}: {
  latitude?: number | null;
  longitude?: number | null;
  setPosition: (pos: [lat: number, lng: number]) => void;
  readOnly: boolean;
}) => {
  const markerRef = useRef<L.Marker<any>>(null);
  const mapRef = useRef<L.Map>(null);
  const eventHandlers = useMemo(
    () => ({
      dragend() {
        if (readOnly) {
          alert(
            "Änderungen an den Koordinaten sind nicht möglich, wenn ein Geonames-Eintrag verknüpft ist."
          );
          return;
        }
        const marker = markerRef.current;
        if (marker != null) {
          const position = marker.getLatLng();
          setPosition([position.lat, position.lng]);
        }
      },
    }),
    [setPosition, readOnly]
  );

  const position: LatLngExpression | undefined = useMemo(
    () => (latitude && longitude ? [latitude, longitude] : undefined),
    [latitude, longitude]
  );

  return (
    <div key={position?.join(",")}>
      <MapContainer
        center={position || CH_COORDS}
        zoom={position ? 13 : 7}
        scrollWheelZoom={false}
        style={{ height: "400px" }}
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker
          position={position || CH_COORDS}
          ref={markerRef}
          draggable={true}
          eventHandlers={eventHandlers}
        >
          <Popup>Ortschaft</Popup>
        </Marker>
      </MapContainer>
      {!position && (
        <span className="text-sm">
          Bewegen Sie den Marker, um eine Position zu setzen.
        </span>
      )}
    </div>
  );
};
