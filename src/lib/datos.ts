import { supabase } from "@/src/lib/supabase";
import {
  Activo,
  ActivoEditable,
  AlertaActivo,
  EstadoAlerta,
  EjecucionZona,
  ESTADO_ACTIVO,
  ESTADO_RETIRADO,
  Zona,
} from "@/src/lib/tipos";

type Fila = Record<string, unknown>;

const LOTE = 1000;

const txt = (v: unknown) => (v == null ? "" : String(v).trim());
const num = (v: unknown) => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Mensaje entendible para errores de Supabase. */
export function mensajeError(e: unknown): string {
  const err = e as { code?: string; message?: string };
  if (err?.code === "42501" || /row-level security/i.test(err?.message ?? "")) {
    return "No tienes permiso para hacer este cambio (revisa las políticas RLS en Supabase).";
  }
  if (err?.code === "23505") return "Ya existe un registro con ese serial.";
  return err?.message || "Ocurrió un error inesperado.";
}

/** Trae todas las filas de una tabla/vista paginando de 1000 en 1000. */
async function traerTodo(
  tabla: string,
  columnas: string,
  orden?: { columna: string; ascendente: boolean }
): Promise<Fila[]> {
  const filas: Fila[] = [];
  for (let desde = 0; ; desde += LOTE) {
    let q = supabase.from(tabla).select(columnas);
    if (orden) q = q.order(orden.columna, { ascending: orden.ascendente });
    const { data, error } = await q.range(desde, desde + LOTE - 1);
    if (error) throw error;
    filas.push(...((data ?? []) as unknown as Fila[]));
    if (!data || data.length < LOTE) break;
  }
  return filas;
}

// ==========================================================
// LECTURA
// ==========================================================

export async function cargarActivos(): Promise<Activo[]> {
  const [activos, agenda, coords, resumen, historico] = await Promise.all([
    traerTodo(
      "activos",
      "serial, tipo, descripcion, empresa, estado, presupuesto",
      { columna: "serial", ascendente: true }
    ),
    traerTodo(
      "activos_agenda",
      "serial, codigo_cliente, razon_social, zona, dia_visita"
    ),
    // Más reciente primero: se queda con la primera de cada serial
    traerTodo("activos_coordenadas_oficiales", "serial, latitud, longitud", {
      columna: "created_at",
      ascendente: false,
    }),
    traerTodo(
      "v_activo_resumen_app",
      "serial, venta_mes, porcentaje_cumplimiento, semaforo"
    ),
    traerTodo("historico_activos", "serial, estado_fisico, created_at", {
      columna: "created_at",
      ascendente: false,
    }),
  ]);

  const primeraPorSerial = (filas: Fila[]) => {
    const m = new Map<string, Fila>();
    for (const f of filas) {
      const s = txt(f.serial);
      if (s && !m.has(s)) m.set(s, f);
    }
    return m;
  };

  const agendaM = primeraPorSerial(agenda);
  const coordsM = primeraPorSerial(coords);
  const resumenM = primeraPorSerial(resumen);
  const histM = primeraPorSerial(historico);

  return activos.map((a) => {
    const serial = txt(a.serial);
    const ag = agendaM.get(serial);
    const c = coordsM.get(serial);
    const r = resumenM.get(serial);
    const h = histM.get(serial);

    return {
      serial,
      tipo: txt(a.tipo),
      descripcion: txt(a.descripcion),
      empresa: txt(a.empresa),
      estado: txt(a.estado) || ESTADO_ACTIVO,
      presupuesto: num(a.presupuesto),

      asignado: !!ag,
      codigo_cliente: txt(ag?.codigo_cliente),
      razon_social: txt(ag?.razon_social),
      zona: txt(ag?.zona),
      dia_visita: txt(ag?.dia_visita),

      lat: num(c?.latitud),
      lng: num(c?.longitud),

      venta_mes: num(r?.venta_mes),
      cumplimiento: num(r?.porcentaje_cumplimiento),
      semaforo: txt(r?.semaforo),

      ultima_visita: h ? txt(h.created_at) : null,
      ultimo_estado: h ? txt(h.estado_fisico) : null,
    };
  });
}

export async function cargarZonas(): Promise<Zona[]> {
  // Nunca pedir la columna "pin"
  const { data, error } = await supabase
    .from("zonas")
    .select("codigo_zona, nombre_zona, activa")
    .order("nombre_zona");
  if (error) throw error;
  return (data ?? []).map((z) => ({
    codigo_zona: txt(z.codigo_zona),
    nombre_zona: txt(z.nombre_zona),
    activa: !!z.activa,
  }));
}

export async function cargarEjecucionHoy(): Promise<EjecucionZona[]> {
  const { data, error } = await supabase
    .from("v_dashboard_zona_dia")
    .select("zona, total_dia, realizados");
  if (error) throw error;
  return (data ?? []).map((z) => ({
    zona: txt(z.zona),
    total_dia: num(z.total_dia) ?? 0,
    realizados: num(z.realizados) ?? 0,
  }));
}

export type Visita = {
  serial: string;
  estado_fisico: string;
  tipo_usuario: string;
  created_at: string;
};

export async function cargarUltimasVisitas(limite = 10): Promise<Visita[]> {
  const { data, error } = await supabase
    .from("historico_activos")
    .select("serial, estado_fisico, tipo_usuario, created_at")
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return (data ?? []).map((v) => ({
    serial: txt(v.serial),
    estado_fisico: txt(v.estado_fisico),
    tipo_usuario: txt(v.tipo_usuario),
    created_at: txt(v.created_at),
  }));
}

// ==========================================================
// ESCRITURA
// ==========================================================

/**
 * Supabase no devuelve error cuando RLS bloquea un UPDATE/DELETE:
 * simplemente no afecta filas. Por eso verificamos cuántas cambió.
 */
function verificarFilas(
  data: unknown[] | null,
  esperadas: number,
  accion: string
) {
  if ((data?.length ?? 0) < esperadas) {
    throw new Error(
      `No se pudo ${accion}: Supabase no aplicó el cambio. ` +
        "Revisa las políticas RLS de la tabla."
    );
  }
}

async function guardarAgenda(
  serial: string,
  d: Pick<
    ActivoEditable,
    "tipo" | "codigo_cliente" | "razon_social" | "zona" | "dia_visita"
  >,
  existe: boolean
) {
  const fila = {
    tipo: d.tipo || null,
    codigo_cliente: d.codigo_cliente || null,
    razon_social: d.razon_social || null,
    zona: d.zona || null,
    dia_visita: d.dia_visita || null,
  };

  if (existe) {
    const { data, error } = await supabase
      .from("activos_agenda")
      .update(fila)
      .eq("serial", serial)
      .select("serial");
    if (error) throw error;
    verificarFilas(data, 1, "actualizar la asignación");
  } else {
    const { error } = await supabase
      .from("activos_agenda")
      .insert({ serial, ...fila });
    if (error) throw error;
  }
}

async function existeAgenda(serial: string) {
  const { data, error } = await supabase
    .from("activos_agenda")
    .select("serial")
    .eq("serial", serial)
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

async function existeActivo(serial: string) {
  const { data, error } = await supabase
    .from("activos")
    .select("serial")
    .eq("serial", serial)
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/** Crea o actualiza un activo y su asignación. */
export async function guardarActivo(
  d: ActivoEditable,
  esNuevo: boolean,
  emailUsuario: string | null
) {
  const serial = d.serial.trim();
  if (!serial) throw new Error("El serial es obligatorio.");

  const datosActivo = {
    tipo: d.tipo || null,
    descripcion: d.descripcion || null,
    empresa: d.empresa || null,
    presupuesto: d.presupuesto,
  };

  if (esNuevo) {
    if (await existeActivo(serial)) {
      throw new Error(`Ya existe un activo con el serial ${serial}.`);
    }
    const { error } = await supabase.from("activos").insert({
      serial,
      ...datosActivo,
      estado: ESTADO_ACTIVO,
      fecha_registro: new Date().toISOString(),
      registrado_por_email: emailUsuario,
    });
    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from("activos")
      .update(datosActivo)
      .eq("serial", serial)
      .select("serial");
    if (error) throw error;
    verificarFilas(data, 1, "actualizar el activo");
  }

  // Solo se crea asignación si tiene asesor (zona)
  const agendaExiste = await existeAgenda(serial);
  if (d.zona || agendaExiste) {
    await guardarAgenda(serial, d, agendaExiste);
  }
}

/** Asigna varios activos a un asesor (zona) y/o día. */
export async function asignarActivos(
  activos: Activo[],
  cambios: { zona?: string; dia_visita?: string }
) {
  const fila: Record<string, string> = {};
  if (cambios.zona) fila.zona = cambios.zona;
  if (cambios.dia_visita) fila.dia_visita = cambios.dia_visita;
  if (Object.keys(fila).length === 0) return;

  const conAgenda = activos.filter((a) => a.asignado).map((a) => a.serial);
  const sinAgenda = activos.filter((a) => !a.asignado);

  if (conAgenda.length) {
    const { data, error } = await supabase
      .from("activos_agenda")
      .update(fila)
      .in("serial", conAgenda)
      .select("serial");
    if (error) throw error;
    verificarFilas(data, conAgenda.length, "asignar los activos");
  }

  if (sinAgenda.length) {
    const { error } = await supabase.from("activos_agenda").insert(
      sinAgenda.map((a) => ({
        serial: a.serial,
        tipo: a.tipo || null,
        ...fila,
      }))
    );
    if (error) throw error;
  }
}

/** Retira activos: estado RETIRADO y se quitan de la agenda de los asesores. */
export async function darDeBaja(seriales: string[]) {
  const { data, error } = await supabase
    .from("activos")
    .update({ estado: ESTADO_RETIRADO })
    .in("serial", seriales)
    .select("serial");
  if (error) throw error;
  verificarFilas(data, seriales.length, "dar de baja los activos");

  const { error: errAgenda } = await supabase
    .from("activos_agenda")
    .delete()
    .in("serial", seriales);
  if (errAgenda) throw errAgenda;
}

export async function reactivar(seriales: string[]) {
  const { data, error } = await supabase
    .from("activos")
    .update({ estado: ESTADO_ACTIVO })
    .in("serial", seriales)
    .select("serial");
  if (error) throw error;
  verificarFilas(data, seriales.length, "reactivar los activos");
}

/** Celdas vacías del Excel conservan el valor actual del activo. */
const combinar = (base: Activo, f: ActivoEditable): ActivoEditable => ({
  serial: f.serial,
  tipo: f.tipo || base.tipo,
  descripcion: f.descripcion || base.descripcion,
  empresa: f.empresa || base.empresa,
  presupuesto: f.presupuesto ?? base.presupuesto,
  codigo_cliente: f.codigo_cliente || base.codigo_cliente,
  razon_social: f.razon_social || base.razon_social,
  zona: f.zona || base.zona,
  dia_visita: f.dia_visita || base.dia_visita,
});

/** Importa filas validadas (nuevas y actualizaciones). */
export async function importarActivos(
  filas: ActivoEditable[],
  actuales: Map<string, Activo>,
  emailUsuario: string | null,
  onProgreso: (hechos: number) => void
) {
  const errores: { serial: string; error: string }[] = [];
  let hechos = 0;

  for (const f of filas) {
    const base = actuales.get(f.serial);
    try {
      await guardarActivo(base ? combinar(base, f) : f, !base, emailUsuario);
    } catch (e) {
      errores.push({ serial: f.serial, error: mensajeError(e) });
    }
    hechos++;
    onProgreso(hechos);
  }

  return errores;
}

// ==========================================================
// ALERTAS (activo en punto que no corresponde)
// ==========================================================

/** Error cuando aún no se ejecutó supabase/alertas_activos.sql */
export const FALTA_TABLA_ALERTAS = "FALTA_TABLA_ALERTAS";

function esTablaFaltante(e: unknown) {
  const err = e as { code?: string; message?: string };
  return (
    err?.code === "42P01" ||
    err?.code === "PGRST205" ||
    /alertas_activos/.test(err?.message ?? "")
  );
}

export async function cargarAlertas(): Promise<AlertaActivo[]> {
  const { data, error } = await supabase
    .from("alertas_activos")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    if (esTablaFaltante(error)) throw new Error(FALTA_TABLA_ALERTAS);
    throw error;
  }
  return (data ?? []).map((a) => ({
    ...(a as AlertaActivo),
    serial_encontrado: txt(a.serial_encontrado),
    latitud: num(a.latitud),
    longitud: num(a.longitud),
  }));
}

export async function contarAlertasPendientes(): Promise<number> {
  const { count, error } = await supabase
    .from("alertas_activos")
    .select("id", { count: "exact", head: true })
    .eq("estado", "pendiente");
  if (error) return 0;
  return count ?? 0;
}

export async function resolverAlerta(
  id: string,
  estado: Exclude<EstadoAlerta, "pendiente">,
  nota: string,
  emailUsuario: string | null
) {
  const { data, error } = await supabase
    .from("alertas_activos")
    .update({
      estado,
      nota_resolucion: nota.trim() || null,
      resuelta_por: emailUsuario,
      resuelta_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id");
  if (error) throw error;
  verificarFilas(data, 1, "actualizar la alerta");
}

/** Reasigna el activo encontrado al punto donde lo vio el asesor. */
export async function moverActivoAPunto(a: AlertaActivo) {
  const cambios: Record<string, string> = {};
  if (a.codigo_cliente_visitado) cambios.codigo_cliente = a.codigo_cliente_visitado;
  if (a.razon_social_visitada) cambios.razon_social = a.razon_social_visitada;
  if (a.zona_visitada) cambios.zona = a.zona_visitada;
  if (a.dia_visita) cambios.dia_visita = a.dia_visita;

  if (!cambios.razon_social && !cambios.codigo_cliente) {
    throw new Error("La alerta no tiene los datos del punto visitado.");
  }

  if (await existeAgenda(a.serial_encontrado)) {
    const { data, error } = await supabase
      .from("activos_agenda")
      .update(cambios)
      .eq("serial", a.serial_encontrado)
      .select("serial");
    if (error) throw error;
    verificarFilas(data, 1, "reasignar el activo");
  } else {
    const { error } = await supabase
      .from("activos_agenda")
      .insert({ serial: a.serial_encontrado, ...cambios });
    if (error) throw error;
  }
}
