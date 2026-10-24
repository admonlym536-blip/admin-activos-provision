"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Info, Map as MapIcon, UserX, Users } from "lucide-react";
import { useDatos } from "@/src/lib/DatosContext";
import { cargarEjecucionHoy } from "@/src/lib/datos";
import {
  colorAvance,
  DIAS,
  EjecucionZona,
  ESTADO_RETIRADO,
} from "@/src/lib/tipos";
import { Encabezado } from "@/src/components/Encabezado";
import {
  Alerta,
  Buscador,
  Cargando,
  Etiqueta,
  Tarjeta,
  Vacio,
} from "@/src/components/ui";

export default function AsesoresPage() {
  const { activos, zonas, cargando } = useDatos();
  const [hoy, setHoy] = useState<EjecucionZona[]>([]);
  const [zonaSel, setZonaSel] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [soloActivas, setSoloActivas] = useState(true);

  useEffect(() => {
    cargarEjecucionHoy().then(setHoy).catch(console.error);
  }, []);

  const enUso = useMemo(
    () => activos.filter((a) => a.estado !== ESTADO_RETIRADO),
    [activos]
  );

  const sinAsignar = enUso.filter((a) => !a.asignado || !a.zona).length;

  // Nombres de zona únicos (varios asesores pueden compartir nombre)
  const nombresZona = useMemo(() => {
    const m = new Map<string, number>();
    for (const z of zonas) {
      if (soloActivas && !z.activa) continue;
      m.set(z.nombre_zona, (m.get(z.nombre_zona) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [zonas, soloActivas]);

  const codigosPorNombre = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const z of zonas) {
      m.set(z.nombre_zona, [...(m.get(z.nombre_zona) ?? []), z.codigo_zona]);
    }
    return m;
  }, [zonas]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return zonas.filter(
      (z) =>
        (!soloActivas || z.activa) &&
        (!zonaSel || z.nombre_zona === zonaSel) &&
        (!q ||
          z.nombre_zona.toLowerCase().includes(q) ||
          z.codigo_zona.toLowerCase().includes(q))
    );
  }, [zonas, zonaSel, busqueda, soloActivas]);

  const chip = (activo: boolean) =>
    `inline-flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition ${
      activo
        ? "border-marca bg-marca text-white"
        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
    }`;

  if (cargando) return <Cargando />;

  return (
    <>
      <Encabezado
        titulo="Asesores"
        subtitulo="Carga de activos por asesor y avance de la agenda de hoy"
      />

      {sinAsignar > 0 && (
        <div className="mb-6">
          <Alerta
            icono={UserX}
            accion={
              <Link
                href="/dashboard/activos?zona=__sin_asignar__"
                className="inline-flex items-center gap-1 font-medium text-amber-900 underline-offset-2 hover:underline"
              >
                Asignarlos <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          >
            Hay <b>{sinAsignar}</b> activos en uso sin asesor. No aparecen en
            ninguna agenda.
          </Alerta>
        </div>
      )}

      {/* ---------------- FILTRO POR ZONA ---------------- */}
      <Tarjeta className="mb-6 space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Buscador
            className="w-full sm:w-72"
            placeholder="Buscar zona o código"
            value={busqueda}
            onChange={setBusqueda}
          />
          <label className="inline-flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              className="h-4 w-4 accent-marca"
              checked={soloActivas}
              onChange={(e) => setSoloActivas(e.target.checked)}
            />
            Solo zonas activas
          </label>
          <span className="ml-auto text-sm text-slate-500">
            {visibles.length} de {zonas.length} asesores
          </span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button onClick={() => setZonaSel("")} className={chip(!zonaSel)}>
            Todas las zonas
          </button>
          {nombresZona.map(([nombre, n]) => {
            const activos = enUso.filter((a) => a.zona === nombre).length;
            return (
              <button
                key={nombre}
                onClick={() => setZonaSel(zonaSel === nombre ? "" : nombre)}
                className={chip(zonaSel === nombre)}
              >
                {nombre}
                <span
                  className={`rounded px-1.5 text-xs tabular-nums ${
                    zonaSel === nombre
                      ? "bg-white/20"
                      : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {activos}
                </span>
                {n > 1 && (
                  <Users
                    className="h-3.5 w-3.5 opacity-70"
                    aria-label={`${n} asesores`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </Tarjeta>

      {visibles.length === 0 && (
        <Tarjeta>
          <Vacio icono={Users} texto="No hay asesores con este filtro" />
        </Tarjeta>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibles.map((z) => {
          const suyos = enUso.filter((a) => a.zona === z.nombre_zona);
          const porDia = DIAS.map((d) => ({
            dia: d,
            total: suyos.filter((a) => a.dia_visita === d).length,
          }));
          const max = Math.max(1, ...porDia.map((p) => p.total));
          const conUbic = suyos.filter((a) => a.lat != null).length;
          const ejec = hoy.find((h) => h.zona === z.nombre_zona);
          const pctHoy =
            ejec && ejec.total_dia > 0
              ? Math.round((ejec.realizados / ejec.total_dia) * 100)
              : null;
          const comparten = (codigosPorNombre.get(z.nombre_zona) ?? []).filter(
            (c) => c !== z.codigo_zona
          );
          const iniciales = z.nombre_zona
            .split(/\s+/)
            .map((p) => p[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();

          return (
            <Tarjeta key={z.codigo_zona} className="flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-marca/10 text-sm font-semibold text-marca">
                  {iniciales}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-slate-900">
                    {z.nombre_zona}
                  </div>
                  <div className="text-xs tabular-nums text-slate-500">
                    Zona {z.codigo_zona}
                  </div>
                </div>
                <Etiqueta color={z.activa ? "verde" : "gris"}>
                  {z.activa ? "Activa" : "Inactiva"}
                </Etiqueta>
              </div>

              {comparten.length > 0 && (
                <div className="-mt-2 flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Comparte nombre con la zona {comparten.join(", ")}: las
                    cifras incluyen los activos de ambas.
                  </span>
                </div>
              )}

              <dl className="grid grid-cols-3 divide-x divide-slate-100 rounded-lg border border-slate-200">
                {[
                  { k: "Activos", v: suyos.length },
                  { k: "Con ubicación", v: conUbic },
                  {
                    k: "Hoy",
                    v: ejec ? `${ejec.realizados}/${ejec.total_dia}` : "—",
                  },
                ].map((d) => (
                  <div key={d.k} className="px-3 py-2.5">
                    <dt className="text-xs text-slate-500">{d.k}</dt>
                    <dd className="text-lg font-semibold tabular-nums text-slate-900">
                      {d.v}
                    </dd>
                  </div>
                ))}
              </dl>

              {pctHoy != null && (
                <div>
                  <div className="mb-1.5 flex justify-between text-xs text-slate-500">
                    <span>Agenda de hoy</span>
                    <span className="tabular-nums">{pctHoy}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pctHoy}%`,
                        background: colorAvance(pctHoy),
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Activos por día */}
              <div>
                <div className="mb-2 text-xs text-slate-500">
                  Activos por día de visita
                </div>
                <div className="flex h-16 items-end gap-1.5">
                  {porDia.map((p) => (
                    <div
                      key={p.dia}
                      className="flex flex-1 flex-col items-center gap-1"
                      title={`${p.dia}: ${p.total}`}
                    >
                      <span className="text-[10px] font-medium tabular-nums text-slate-500">
                        {p.total || ""}
                      </span>
                      <div
                        className="w-full rounded-sm bg-marca/80"
                        style={{
                          height: `${Math.max(2, (p.total / max) * 36)}px`,
                          opacity: p.total ? 1 : 0.15,
                        }}
                      />
                      <span className="text-[10px] text-slate-400">
                        {p.dia.slice(0, 3)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-auto flex gap-2 border-t border-slate-100 pt-4">
                <Link
                  href={`/dashboard/activos?zona=${encodeURIComponent(z.nombre_zona)}`}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-marca px-3 py-2 text-sm font-medium text-white hover:bg-marca-oscuro"
                >
                  Ver activos <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/dashboard/mapa"
                  title="Ver en el mapa"
                  className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-slate-600 hover:bg-slate-50"
                >
                  <MapIcon className="h-4 w-4" />
                </Link>
              </div>
            </Tarjeta>
          );
        })}
      </div>
    </>
  );
}
