import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { googleMapsUrl } from './bookingStore.js';

// Pin colours match the bistro palette in index.html.
const PIN_COLORS = {
  ranked: '#6F1D2A', // wine
  tried: '#5C4F44', // ink-soft
  want: '#A6814A', // brass
  follows: '#2F4A3B', // vert
};

// Builds DOM nodes with textContent rather than HTML strings, since place names and
// usernames come from other people.
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const pinIcon = (pin) => {
  const wrap = el('div', 'ts-pin');
  wrap.style.setProperty('--pin', PIN_COLORS[pin.kind]);
  wrap.appendChild(el('span', '', pin.label));
  return L.divIcon({ html: wrap, className: 'ts-pin-icon', iconSize: [34, 42], iconAnchor: [17, 40], popupAnchor: [0, -36] });
};

const popupContent = (pin) => {
  const box = el('div', 'ts-popup');
  box.appendChild(el('div', 'ts-popup-name', pin.name));
  if (pin.address) box.appendChild(el('div', 'ts-popup-address', pin.address));
  pin.details.forEach((line) => box.appendChild(el('div', 'ts-popup-line', line)));
  const link = el('a', 'ts-popup-link', 'Open in Google Maps');
  // A pin's key is the spot's Google place id when it has one, so Maps opens that exact listing.
  link.href = googleMapsUrl({ name: pin.name, address: pin.address, place_id: pin.key });
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  box.appendChild(link);
  return box;
};

// A map of one city, opening at center ([lat, lng]), with one pin per spot. Each pin is
// { key, lat, lng, kind: 'ranked' | 'tried' | 'want' | 'follows', label, name, address, details: [lines] }.
export default function PlacesMap({ center, pins }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const framedRef = useRef('');
  // The app rebuilds the pin list on every render; redrawing only when it really changes
  // keeps an open popup from closing.
  const signature = JSON.stringify(pins);

  useEffect(() => {
    const map = L.map(containerRef.current, { center, zoom: 12, scrollWheelZoom: false });
    // OpenStreetMap's free tiles need no key; they are toned down in index.html (.ts-map-tiles)
    // to suit the bistro palette.
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      className: 'ts-map-tiles',
      maxZoom: 19,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    let youAreHere = null;
    map.on('locationfound', (e) => {
      if (youAreHere) youAreHere.remove();
      youAreHere = L.circleMarker(e.latlng, { radius: 8, color: '#fff', weight: 3, fillColor: '#3B82F6', fillOpacity: 1 }).addTo(map);
    });

    // The map measures its box once when created; if the page layout settles afterwards
    // (styles loading, phone rotating) it needs to measure again or tiles stop short.
    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(containerRef.current);

    return () => {
      resize.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    // Draw the user's own spots last so they sit on top.
    const order = { follows: 0, want: 1, ranked: 2 };
    [...pins].sort((a, b) => order[a.kind] - order[b.kind]).forEach((pin) => {
      L.marker([pin.lat, pin.lng], { icon: pinIcon(pin), title: pin.name, zIndexOffset: order[pin.kind] * 1000 })
        .bindPopup(() => popupContent(pin), { closeButton: false, maxWidth: 260 })
        .addTo(layer);
    });

    // Zoom to fit the pins when a different set is shown, not on every save.
    const framing = pins.map(p => p.key).sort().join('|');
    if (framing === framedRef.current) return;
    framedRef.current = framing;
    if (pins.length === 1) map.setView([pins[0].lat, pins[0].lng], 15);
    else if (pins.length > 1) map.fitBounds(pins.map(p => [p.lat, p.lng]), { padding: [40, 40], maxZoom: 15 });
  }, [signature]);

  const locate = () => mapRef.current?.locate({ setView: true, maxZoom: 15 });

  return (
    <div className="relative">
      <div ref={containerRef} style={{ height: '70vh', minHeight: 420 }} className="w-full rounded-sm border border-line z-0" aria-label="Map of spots" />
      <button
        onClick={locate}
        className="absolute bottom-4 right-4 z-[500] bg-card border border-line rounded-sm px-3 py-2 text-xs uppercase tracking-wider font-semibold text-ink-soft hover:text-wine shadow-sm"
      >
        Near me
      </button>
    </div>
  );
}
