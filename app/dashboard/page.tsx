"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  CalendarCheck,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  UserX,
} from "lucide-react";
import { useDatos } from "@/src/lib/DatosContext";
import {
  cargarEjecucionHoy,
  cargarUltimasVisitas,
  Visita,
} from "@/src/lib/datos";
import {
  colorAvance,
  COLORES,
  EjecucionZona,
  ESTADO_RETIRADO,
} from "@/src/lib/tipos";
import { Encabezado } from "@/src/components/Encabezado";
import {
  Alerta,
  Boton,
  Cargando,
  Etiqueta,
  Kpi,
  Tarjeta,
  TituloTarjeta,
} from "@/src/components/ui";

const enlace =
  "inline-flex items-center gap-1 text-sm font-medium text-marca hover:underline";

export default function ResumenPage() {
  const router = useRouter();
  const { activos, cargando, error, recargar, alertasPendientes } = useDatos();
  const [hoy, setHoy] = useState<EjecucionZona[]>([]);
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [recargando, setRecargando] = useState(false);

  useEffect(() => {
    cargarEjecucionHoy().then(setHoy).catch(console.error);
    cargarUltimasVisitas(8).then(setVisitas).catch(console.error);
  }, []);

  const m = useMemo(() => {
    const enUso = activos.filter((a) => a.estado !== ESTADO_RETIRADO);
    return {
      total: enUso.length,
      retirados: activos.length - enUso.length,
      sinAsignar: enUso.filter((a) => !a.asignado || !a.zona).length,
      conUbicacion: enUso.filter((a) => a.lat != null).length,
      verde: enUso.filter((a) => a.semaforo === "Verde").length,
      amarillo: enUso.filter((a) => a.semaforo === "Amarillo").length,
      rojo: enUso.filter((a) => a.semaforo === "Rojo").length,
    };
  }, [activos]);

  const clientePorSerial = useMemo(
    () => new Map(activos.map((a) => [a.serial, a.razon_social])),
    [activos]
  );

  const hoyTotal = hoy.reduce((s, z) => s + z.total_dia, 0);
  const hoyHechos = hoy.reduce((s, z) => s + z.realizados, 0);

  const actualizar = async () => {
    setRecargando(true);
    await recargar();
    setRecargando(false);
  };

  if (cargando) return <Cargando />;

  const pctUbic = m.total ? Math.round((m.conUbicacion / m.total) * 100) : 0;
  const pct = (n: number) => (m.total ? (n / m.total) * 100 : 0);

  return (
    <>
      <Encabezado
        titulo="Resumen"
        subtitulo="Estado general de los activos y la operación de hoy"
        acciones={
          <>
            <Boton
              variante="secundario"
              icono={RefreshCw}
              cargando={recargando}
              onClick={actualizar}
            >
              Actualizar
            </Boton>
            <Link href="/dashboard/activos?nuevo=1">
              <Boton icono={Plus}>Nuevo activo</Boton>
            </Link>
          </>
        }
      />

      {error && (
        <div className="mb-4">
          <Alerta tipo="error" icono={AlertTriangle}>
            {error}
          </Alerta>
        </div>
      )}

      {alertasPendientes > 0 && (
        <div className="mb-4">
          <Alerta
            icono={BellRing}
            accion={
              <Link href="/dashboard/alertas" className={enlace}>
                Revisar <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          >
            Hay <b>{alertasPendientes}</b>{" "}
            {alertasPendientes === 1 ? "activo reportado" : "activos reportados"}{" "}
            en un punto que no corresponde.
          </Alerta>
        </div>
      )}

      {/* ---------------- KPIs ---------------- */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icono={Package}
          titulo="Activos en uso"
          valor={m.total}
          detalle={
            m.retirados ? `${m.retirados} dados de baja` : "Ninguno dado de baja"
          }
          onClick={() => router.push("/dashboard/activos")}
        />
        <Kpi
          icono={UserX}
          titulo="Sin asesor"
          valor={m.sinAsignar}
          color={m.sinAsignar ? COLORES.amarillo : COLORES.verde}
          detalle={m.sinAsignar ? "Pendientes por asignar" : "Todos asignados"}
          onClick={() => router.push("/dashboard/activos?zona=__sin_asignar__")}
        />
        <Kpi
          icono={MapPin}
          titulo="Con ubicación"
          valor={m.conUbicacion}
          detalle={`${pctUbic}% del total`}
          color={COLORES.verde}
          onClick={() => router.push("/dashboard/mapa")}
        />
        <Kpi
          icono={CalendarCheck}
          titulo="Visitas de hoy"
          valor={hoyTotal ? `${hoyHechos} / ${hoyTotal}` : "—"}
          detalle={
            hoyTotal
              ? `${Math.round((hoyHechos / hoyTotal) * 100)}% de la agenda`
              : "Sin agenda programada"
          }
          onClick={() => router.push("/dashboard/asesores")}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ---------------- SEMÁFORO ---------------- */}
        <Tarjeta>
          <TituloTarjeta>Cumplimiento comercial</TituloTarjeta>

          {/* Barra apilada */}
          <div className="mb-5 flex h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div style={{ width: `${pct(m.verde)}%`, background: COLORES.verde }} />
            <div style={{ width: `${pct(m.amarillo)}%`, background: COLORES.amarillo }} />
            <div style={{ width: `${pct(m.rojo)}%`, background: COLORES.rojo }} />
          </div>

          <div className="grid grid-cols-3 divide-x divide-slate-100">
            {[
              { label: "Verde", n: m.verde, c: COLORES.verde },
              { label: "Amarillo", n: m.amarillo, c: COLORES.amarillo },
              { label: "Rojo", n: m.rojo, c: COLORES.rojo },
            ].map((s) => (
              <button
                key={s.label}
                className="px-4 text-left first:pl-0"
                onClick={() => router.push("/dashboard/mapa")}
              >
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.c }} />
                  {s.label}
                </div>
                <div className="mt-1 text-2xl font-semibold text-slate-900">
                  {s.n}
                </div>
                <div className="text-xs text-slate-400">
                  {Math.round(pct(s.n))}% de los activos
                </div>
              </button>
            ))}
          </div>
        </Tarjeta>

        {/* ---------------- HOY POR ASESOR ---------------- */}
        <Tarjeta>
          <TituloTarjeta
            accion={
              <Link href="/dashboard/asesores" className={enlace}>
                Ver asesores <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          >
            Avance de hoy por asesor
          </TituloTarjeta>
          {hoy.length === 0 ? (
            <p className="text-sm text-slate-500">No hay agenda para hoy.</p>
          ) : (
            <div className="space-y-3.5">
              {hoy.map((z) => {
                const p = z.total_dia
                  ? Math.round((z.realizados / z.total_dia) * 100)
                  : 0;
                return (
                  <div key={z.zona}>
                    <div className="mb-1.5 flex justify-between text-sm">
                      <span className="font-medium text-slate-700">{z.zona}</span>
                      <span className="tabular-nums text-slate-500">
                        {z.realizados}/{z.total_dia}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${p}%`, background: colorAvance(p) }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Tarjeta>

        {/* ---------------- ÚLTIMAS VISITAS ---------------- */}
        <Tarjeta className="p-0 lg:col-span-2">
          <div className="px-5 pt-5">
            <TituloTarjeta>Últimas visitas</TituloTarjeta>
          </div>
          {visitas.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-slate-500">Aún no hay visitas.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-y border-slate-100 bg-slate-50 text-left text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-5 py-2.5">Cliente</th>
                  <th className="px-5 py-2.5">Serial</th>
                  <th className="px-5 py-2.5">Estado</th>
                  <th className="px-5 py-2.5 text-right">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visitas.map((v, i) => (
                  <tr key={`${v.serial}-${i}`}>
                    <td className="px-5 py-3 font-medium text-slate-900">
                      {clientePorSerial.get(v.serial) || "Sin cliente"}
                    </td>
                    <td className="px-5 py-3 tabular-nums text-slate-500">
                      {v.serial}
                    </td>
                    <td className="px-5 py-3">
                      {v.estado_fisico ? (
                        <Etiqueta
                          color={v.estado_fisico === "Óptimo" ? "verde" : "rojo"}
                        >
                          {v.estado_fisico}
                        </Etiqueta>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-500">
                      {new Date(v.created_at).toLocaleString("es-CO", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Tarjeta>
      </div>
    </>
  );
}
