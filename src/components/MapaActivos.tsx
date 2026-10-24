"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import type { LatLngBoundsExpression, CircleMarker as LCircle } from "leaflet";
import { Navigation, Pencil } from "lucide-react";
import { Activo, colorSemaforo } from "@/src/lib/tipos";

const CENTRO_CARTAGENA: [number, number] = [10.39, -75.48];

function Encuadrar({
  activos,
  enfocado,
}: {
  activos: Activo[];
  enfocado: Activo | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (enfocado?.lat != null && enfocado.lng != null) {
      map.setView([enfocado.lat, enfocado.lng], 17);
      return;
    }
    const puntos = activos.map((a) => [a.lat!, a.lng!] as [number, number]);
    if (puntos.length === 1) map.setView(puntos[0], 16);
    else if (puntos.length > 1)
      map.fitBounds(puntos as LatLngBoundsExpression, { padding: [40, 40] });
    // Solo re-encuadrar cuando cambia el conjunto filtrado o el enfocado
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activos.length, enfocado?.serial, map]);

  return null;
}

const dinero = (v: number | null) =>
  v == null ? "—" : `$${Math.round(v).toLocaleString("es-CO")}`;

export default function MapaActivos({
  activos,
  enfocado,
  onEditar,
}: {
  activos: Activo[];
  enfocado: Activo | null;
  onEditar: (a: Activo) => void;
}) {
  return (
    <MapContainer
      center={CENTRO_CARTAGENA}
      zoom={12}
      className="h-full w-full"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Encuadrar activos={activos} enfocado={enfocado} />

      {activos.map((a) => {
        const c = colorSemaforo(a.semaforo);
        const esEnfocado = enfocado?.serial === a.serial;
        return (
          <CircleMarker
            key={a.serial}
            center={[a.lat!, a.lng!]}
            radius={esEnfocado ? 13 : 9}
            pathOptions={{
              color: "#fff",
              weight: 2.5,
              fillColor: c,
              fillOpacity: 0.95,
            }}
            ref={(m: LCircle | null) => {
              if (m && esEnfocado) setTimeout(() => m.openPopup(), 300);
            }}
          >
            {/* Al pasar el mouse */}
            <Tooltip direction="top" offset={[0, -8]}>
              <b>{a.razon_social || "Sin cliente"}</b>
              <br />
              {a.serial} · {a.tipo}
            </Tooltip>

            {/* Al hacer clic */}
            <Popup minWidth={240}>
              <div className="space-y-1.5 text-[13px] text-slate-700">
                <div className="text-sm font-semibold text-slate-900">
                  {a.razon_social || "Sin cliente"}
                </div>
                {a.codigo_cliente && (
                  <div className="-mt-1 text-xs text-slate-500">
                    Cliente {a.codigo_cliente}
                  </div>
                )}
                <div>
                  <b>Serial:</b> {a.serial}
                </div>
                <div>
                  <b>Tipo:</b> {a.tipo || "—"}
                  {a.descripcion ? ` · ${a.descripcion}` : ""}
                </div>
                <div>
                  <b>Asesor:</b> {a.zona || "Sin asignar"}
                  {a.dia_visita ? ` · ${a.dia_visita}` : ""}
                </div>
                <div>
                  <b>Venta mes:</b> {dinero(a.venta_mes)} de{" "}
                  {dinero(a.presupuesto)}
                </div>
                {a.semaforo && (
                  <div className="flex items-center gap-1.5 font-medium">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: c }}
                    />
                    {a.semaforo}
                    {a.cumplimiento != null
                      ? ` · ${Math.round(a.cumplimiento)}%`
                      : ""}
                  </div>
                )}
                {a.ultima_visita && (
                  <div className="text-xs text-slate-500">
                    Última visita:{" "}
                    {new Date(a.ultima_visita).toLocaleDateString("es-CO")}
                    {a.ultimo_estado ? ` · ${a.ultimo_estado}` : ""}
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => onEditar(a)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-[#0c3b75] px-2.5 py-1.5 text-xs font-medium text-white"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </button>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${a.lat},${a.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium !text-slate-700"
                  >
                    <Navigation className="h-3.5 w-3.5" /> Cómo llegar
                  </a>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
