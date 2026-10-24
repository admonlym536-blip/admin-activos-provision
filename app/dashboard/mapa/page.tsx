"use client";

import { Suspense, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useDatos } from "@/src/lib/DatosContext";
import { Activo, colorSemaforo, ESTADO_RETIRADO } from "@/src/lib/tipos";
import { ActivoForm } from "@/src/components/ActivoForm";
import { Encabezado } from "@/src/components/Encabezado";
import { ArrowRight, MapPinOff } from "lucide-react";
import {
  Alerta,
  Buscador,
  Cargando,
  claseInput,
  Tarjeta,
} from "@/src/components/ui";

// Leaflet usa "window": solo en el navegador
const MapaActivos = dynamic(() => import("@/src/components/MapaActivos"), {
  ssr: false,
  loading: () => <Cargando />,
});

export default function MapaPage() {
  return (
    <Suspense fallback={<Cargando />}>
      <Mapa />
    </Suspense>
  );
}

function Mapa() {
  const { activos, zonas, cargando } = useDatos();
  const params = useSearchParams();

  const [zona, setZona] = useState("");
  const [semaforo, setSemaforo] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [enfocadoSerial, setEnfocadoSerial] = useState(
    params.get("serial") ?? ""
  );
  const [editando, setEditando] = useState<Activo | null>(null);

  const enUso = useMemo(
    () => activos.filter((a) => a.estado !== ESTADO_RETIRADO),
    [activos]
  );

  const conUbicacion = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return enUso.filter(
      (a) =>
        a.lat != null &&
        a.lng != null &&
        (!zona || a.zona === zona) &&
        (!semaforo || a.semaforo === semaforo) &&
        (!q ||
          `${a.serial} ${a.razon_social} ${a.codigo_cliente}`
            .toLowerCase()
            .includes(q))
    );
  }, [enUso, zona, semaforo, busqueda]);

  const sinUbicacion = enUso.filter((a) => a.lat == null).length;
  const enfocado =
    conUbicacion.find((a) => a.serial === enfocadoSerial) ?? null;

  if (cargando) return <Cargando />;

  return (
    <>
      <Encabezado
        titulo="Mapa de activos"
        subtitulo={`${conUbicacion.length} activos en el mapa`}
      />

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        {/* ---------------- PANEL LATERAL ---------------- */}
        <div className="space-y-4">
          <Tarjeta className="space-y-3">
            <Buscador
              placeholder="Buscar serial o cliente"
              value={busqueda}
              onChange={(v) => {
                setBusqueda(v);
                setEnfocadoSerial("");
              }}
            />
            <select
              className={claseInput}
              value={zona}
              onChange={(e) => {
                setZona(e.target.value);
                setEnfocadoSerial("");
              }}
            >
              <option value="">Todos los asesores</option>
              {zonas.map((z) => (
                <option key={z.codigo_zona} value={z.nombre_zona}>
                  {z.nombre_zona}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap gap-2">
              {["", "Verde", "Amarillo", "Rojo"].map((s) => (
                <button
                  key={s || "todos"}
                  onClick={() => {
                    setSemaforo(s);
                    setEnfocadoSerial("");
                  }}
                  className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                    semaforo === s
                      ? "border-marca bg-marca text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {s && (
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: colorSemaforo(s) }}
                    />
                  )}
                  {s || "Todos"}
                </button>
              ))}
            </div>
          </Tarjeta>

          {sinUbicacion > 0 && (
            <Alerta icono={MapPinOff}>
              <b>{sinUbicacion}</b> activos aún sin ubicación. Se registra
              cuando el asesor los escanea con GPS.
              <Link
                href="/dashboard/activos?ubicacion=sin"
                className="mt-1 flex items-center gap-1 font-medium underline-offset-2 hover:underline"
              >
                Ver cuáles son <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Alerta>
          )}

          {/* Lista rápida */}
          <Tarjeta className="max-h-[420px] overflow-y-auto p-2">
            {conUbicacion.length === 0 ? (
              <p className="p-3 text-sm text-slate-500">
                No hay activos con ubicación para estos filtros.
              </p>
            ) : (
              conUbicacion.map((a) => (
                <button
                  key={a.serial}
                  onClick={() => setEnfocadoSerial(a.serial)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${
                    enfocadoSerial === a.serial
                      ? "bg-marca/[0.06]"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ background: colorSemaforo(a.semaforo) }}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-900">
                      {a.razon_social || "Sin cliente"}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {a.serial} · {a.zona || "Sin asignar"}
                    </span>
                  </span>
                </button>
              ))
            )}
          </Tarjeta>
        </div>

        {/* ---------------- MAPA ---------------- */}
        <div className="h-[70vh] min-h-[420px] overflow-hidden rounded-xl border border-slate-200 bg-white lg:h-[calc(100vh-10rem)]">
          <MapaActivos
            activos={conUbicacion}
            enfocado={enfocado}
            onEditar={setEditando}
          />
        </div>
      </div>

      <ActivoForm
        abierto={!!editando}
        activo={editando}
        onCerrar={() => setEditando(null)}
      />
    </>
  );
}
