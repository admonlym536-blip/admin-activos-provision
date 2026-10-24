"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  BellOff,
  CheckCircle2,
  CircleSlash,
  Database,
  ImageOff,
  MapPin,
  MessageSquareText,
  PackagePlus,
  RefreshCw,
  Undo2,
} from "lucide-react";
import { useDatos } from "@/src/lib/DatosContext";
import {
  cargarAlertas,
  FALTA_TABLA_ALERTAS,
  mensajeError,
  moverActivoAPunto,
  resolverAlerta,
} from "@/src/lib/datos";
import { AlertaActivo, EstadoAlerta } from "@/src/lib/tipos";
import { ActivoForm } from "@/src/components/ActivoForm";
import { Encabezado } from "@/src/components/Encabezado";
import {
  Alerta,
  Boton,
  Cargando,
  claseInput,
  Etiqueta,
  Modal,
  Tarjeta,
  useAvisos,
  Vacio,
} from "@/src/components/ui";

type Accion = "mover" | "devuelto" | "descartado";

const ACCIONES: Record<
  Accion,
  { titulo: string; boton: string; estado: Exclude<EstadoAlerta, "pendiente"> }
> = {
  mover: {
    titulo: "Mover el activo a este punto",
    boton: "Mover activo",
    estado: "reasignado",
  },
  devuelto: {
    titulo: "Dejar el activo en su punto registrado",
    boton: "Confirmar",
    estado: "devuelto",
  },
  descartado: {
    titulo: "Descartar alerta",
    boton: "Descartar",
    estado: "descartado",
  },
};

const ESTADOS: Record<
  Exclude<EstadoAlerta, "pendiente">,
  { texto: string; color: "verde" | "azul" | "gris" }
> = {
  reasignado: { texto: "Movido al punto", color: "verde" },
  devuelto: { texto: "Se deja en su punto", color: "azul" },
  descartado: { texto: "Descartada", color: "gris" },
};

function haceCuanto(fecha: string) {
  const min = Math.round((Date.now() - new Date(fecha).getTime()) / 60000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ayer" : `hace ${d} días`;
}

const punto = (
  razon: string | null,
  codigo: string | null,
  zona: string | null,
  dia: string | null
) =>
  [
    razon || "Sin cliente",
    codigo ? `Cliente ${codigo}` : null,
    zona,
    dia,
  ]
    .filter(Boolean)
    .join(" · ");

export default function AlertasPage() {
  const { email, refrescarAlertas, recargar } = useDatos();
  const avisar = useAvisos();

  const [alertas, setAlertas] = useState<AlertaActivo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vista, setVista] = useState<"pendientes" | "resueltas">("pendientes");

  const [enCurso, setEnCurso] = useState<{ alerta: AlertaActivo; accion: Accion } | null>(null);
  const [nota, setNota] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [creando, setCreando] = useState<AlertaActivo | null>(null);

  const cargar = useCallback(async () => {
    try {
      setAlertas(await cargarAlertas());
      setError(null);
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error && e.message === FALTA_TABLA_ALERTAS
          ? FALTA_TABLA_ALERTAS
          : mensajeError(e)
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const pendientes = useMemo(
    () => alertas.filter((a) => a.estado === "pendiente"),
    [alertas]
  );
  const resueltas = useMemo(
    () => alertas.filter((a) => a.estado !== "pendiente"),
    [alertas]
  );
  const lista = vista === "pendientes" ? pendientes : resueltas;

  const abrir = (alerta: AlertaActivo, accion: Accion) => {
    setNota("");
    setEnCurso({ alerta, accion });
  };

  const confirmar = async () => {
    if (!enCurso) return;
    const { alerta, accion } = enCurso;
    setProcesando(true);
    try {
      if (accion === "mover") await moverActivoAPunto(alerta);
      await resolverAlerta(alerta.id, ACCIONES[accion].estado, nota, email);
      avisar(
        accion === "mover"
          ? `Activo ${alerta.serial_encontrado} asignado a ${alerta.razon_social_visitada}`
          : "Alerta gestionada"
      );
      setEnCurso(null);
      await Promise.all([cargar(), refrescarAlertas()]);
      if (accion === "mover") await recargar();
    } catch (e) {
      avisar(mensajeError(e), "error");
    } finally {
      setProcesando(false);
    }
  };

  if (cargando) return <Cargando />;

  return (
    <>
      <Encabezado
        titulo="Alertas"
        subtitulo="Activos que los asesores encontraron en un punto que no corresponde"
        acciones={
          <Boton
            variante="secundario"
            icono={RefreshCw}
            onClick={() => {
              setCargando(true);
              cargar();
              refrescarAlertas();
            }}
          >
            Actualizar
          </Boton>
        }
      />

      {error === FALTA_TABLA_ALERTAS ? (
        <Alerta icono={Database}>
          Falta crear la tabla de alertas en Supabase. Ejecuta el archivo{" "}
          <code className="rounded bg-amber-100 px-1">
            supabase/alertas_activos.sql
          </code>{" "}
          en el SQL Editor y vuelve a cargar esta página.
        </Alerta>
      ) : error ? (
        <Alerta tipo="error" icono={AlertTriangle}>
          {error}
        </Alerta>
      ) : (
        <>
          <div className="mb-4 inline-flex rounded-lg bg-slate-100 p-0.5">
            {(
              [
                ["pendientes", `Pendientes (${pendientes.length})`],
                ["resueltas", `Resueltas (${resueltas.length})`],
              ] as const
            ).map(([v, t]) => (
              <button
                key={v}
                onClick={() => setVista(v)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  vista === v
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {lista.length === 0 ? (
            <Tarjeta>
              <Vacio
                icono={vista === "pendientes" ? CheckCircle2 : BellOff}
                texto={
                  vista === "pendientes"
                    ? "No hay alertas pendientes"
                    : "Aún no hay alertas resueltas"
                }
              />
            </Tarjeta>
          ) : (
            <div className="space-y-4">
              {lista.map((a) => (
                <TarjetaAlerta
                  key={a.id}
                  alerta={a}
                  onAccion={(acc) => abrir(a, acc)}
                  onCrear={() => setCreando(a)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ---------------- CONFIRMAR ACCIÓN ---------------- */}
      <Modal
        abierto={!!enCurso}
        titulo={enCurso ? ACCIONES[enCurso.accion].titulo : ""}
        descripcion={
          enCurso?.accion === "mover"
            ? `El activo ${enCurso.alerta.serial_encontrado} quedará asignado a ${punto(
                enCurso.alerta.razon_social_visitada,
                enCurso.alerta.codigo_cliente_visitado,
                enCurso.alerta.zona_visitada,
                enCurso.alerta.dia_visita
              )}.`
            : enCurso?.accion === "devuelto"
              ? "La asignación no cambia. Úsalo cuando el equipo se devuelva a su punto."
              : "Para lecturas erróneas o reportes que no aplican."
        }
        onCerrar={() => setEnCurso(null)}
        pie={
          <>
            <Boton variante="secundario" onClick={() => setEnCurso(null)}>
              Cancelar
            </Boton>
            <Boton
              variante={enCurso?.accion === "descartado" ? "peligro" : "primario"}
              cargando={procesando}
              onClick={confirmar}
            >
              {enCurso ? ACCIONES[enCurso.accion].boton : ""}
            </Boton>
          </>
        }
      >
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            Nota (opcional)
          </span>
          <textarea
            className={`${claseInput} h-24 py-2`}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Ej: Confirmado con el cliente, el equipo se queda aquí"
          />
        </label>
      </Modal>

      {/* ---------------- CREAR ACTIVO NO REGISTRADO ---------------- */}
      <ActivoForm
        abierto={!!creando}
        activo={null}
        inicial={
          creando
            ? {
                serial: creando.serial_encontrado,
                codigo_cliente: creando.codigo_cliente_visitado ?? "",
                razon_social: creando.razon_social_visitada ?? "",
                zona: creando.zona_visitada ?? "",
                dia_visita: creando.dia_visita ?? "",
              }
            : undefined
        }
        onCerrar={() => setCreando(null)}
        onGuardado={async () => {
          if (!creando) return;
          await resolverAlerta(
            creando.id,
            "reasignado",
            "Activo creado en el punto donde se encontró",
            email
          );
          await Promise.all([cargar(), refrescarAlertas()]);
        }}
      />
    </>
  );
}

// ==========================================================
// TARJETA DE ALERTA
// ==========================================================
function TarjetaAlerta({
  alerta: a,
  onAccion,
  onCrear,
}: {
  alerta: AlertaActivo;
  onAccion: (accion: Accion) => void;
  onCrear: () => void;
}) {
  const pendiente = a.estado === "pendiente";
  const noRegistrado = a.tipo === "no_registrado";

  return (
    <Tarjeta className="p-0">
      <div className="flex flex-col gap-5 p-5 sm:flex-row">
        {/* Foto */}
        {a.url_foto ? (
          <a
            href={a.url_foto}
            target="_blank"
            rel="noreferrer"
            className="shrink-0"
            title="Ver foto completa"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={a.url_foto}
              alt={`Foto del activo ${a.serial_encontrado}`}
              className="h-36 w-full rounded-lg object-cover ring-1 ring-slate-200 sm:w-36"
            />
          </a>
        ) : (
          <div className="flex h-36 w-full shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-300 ring-1 ring-slate-200 sm:w-36">
            <ImageOff className="h-8 w-8" />
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-base font-semibold text-slate-900">
                Activo{" "}
                <span className="tabular-nums">{a.serial_encontrado}</span>{" "}
                {noRegistrado ? "no registrado" : "en punto que no corresponde"}
              </div>
              <div className="text-xs text-slate-500">
                {haceCuanto(a.created_at)} ·{" "}
                {new Date(a.created_at).toLocaleString("es-CO", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
                {a.codigo_zona_asesor ? ` · Asesor zona ${a.codigo_zona_asesor}` : ""}
              </div>
            </div>
            {pendiente ? (
              <Etiqueta color={noRegistrado ? "rojo" : "amarillo"}>
                {noRegistrado ? "No registrado" : "Punto incorrecto"}
              </Etiqueta>
            ) : (
              <Etiqueta color={ESTADOS[a.estado as Exclude<EstadoAlerta, "pendiente">].color}>
                {ESTADOS[a.estado as Exclude<EstadoAlerta, "pendiente">].texto}
              </Etiqueta>
            )}
          </div>

          {/* Dónde se encontró vs dónde debería estar */}
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                Encontrado en
              </div>
              <div className="text-sm text-slate-900">
                {punto(
                  a.razon_social_visitada,
                  a.codigo_cliente_visitado,
                  a.zona_visitada,
                  a.dia_visita
                )}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Registrado en
              </div>
              <div className="text-sm text-slate-900">
                {noRegistrado
                  ? "No existe en el sistema"
                  : punto(
                      a.razon_social_registrada,
                      a.codigo_cliente_registrado,
                      a.zona_registrada,
                      null
                    )}
              </div>
            </div>
          </div>

          {a.serial_esperado && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <CircleSlash className="h-4 w-4 text-slate-400" />
              {a.esperado_no_esta
                ? `El activo esperado (${a.serial_esperado}) no estaba en el punto`
                : `El activo esperado (${a.serial_esperado}) sí estaba en el punto`}
            </div>
          )}

          {a.nota && (
            <div className="flex gap-2 rounded-lg border-l-2 border-marca bg-marca/[0.03] px-3 py-2 text-sm text-slate-700">
              <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-marca" />
              <span className="italic">“{a.nota}”</span>
            </div>
          )}

          {!pendiente && (
            <div className="text-xs text-slate-500">
              Gestionada por {a.resuelta_por ?? "—"}
              {a.resuelta_at
                ? ` el ${new Date(a.resuelta_at).toLocaleString("es-CO", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}`
                : ""}
              {a.nota_resolucion ? ` · “${a.nota_resolucion}”` : ""}
            </div>
          )}
        </div>
      </div>

      {/* Acciones */}
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
        {a.latitud != null && a.longitud != null && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${a.latitud},${a.longitud}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <MapPin className="h-4 w-4" /> Ver dónde se reportó
          </a>
        )}
        {pendiente && (
          <div className="ml-auto flex flex-wrap gap-2">
            <Boton variante="fantasma" onClick={() => onAccion("descartado")}>
              Descartar
            </Boton>
            {noRegistrado ? (
              <Boton icono={PackagePlus} onClick={onCrear}>
                Crear activo en este punto
              </Boton>
            ) : (
              <>
                <Boton
                  variante="secundario"
                  icono={Undo2}
                  onClick={() => onAccion("devuelto")}
                >
                  Dejar en su punto
                </Boton>
                <Boton
                  icono={ArrowRightLeft}
                  disabled={!a.razon_social_visitada && !a.codigo_cliente_visitado}
                  onClick={() => onAccion("mover")}
                >
                  Mover a {a.razon_social_visitada || "este punto"}
                </Boton>
              </>
            )}
          </div>
        )}
      </div>
    </Tarjeta>
  );
}
