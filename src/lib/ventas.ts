import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { supabase } from "@/src/lib/supabase";
import { Activo } from "@/src/lib/tipos";

/** Fila de la tabla activos_ventas_diarias. */
export type VentaDiaria = {
  id: string;
  serial: string;
  fecha: string; // YYYY-MM-DD
  venta: number;
};

const LOTE = 1000;

// ==========================================================
// FECHAS
// ==========================================================
export const hoyISO = () => aISO(new Date());

export const aISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

/** Primer y último día del mes "YYYY-MM". */
export function rangoMes(mes: string) {
  const [y, m] = mes.split("-").map(Number);
  const dias = new Date(y, m, 0).getDate();
  return {
    desde: `${mes}-01`,
    hasta: `${mes}-${String(dias).padStart(2, "0")}`,
    dias,
  };
}

/** Acepta 2026-04-28, 28/04/2026, 28-04-2026 y 28/04/26 (día primero). */
export function parseFecha(v: string): string | null {
  const s = v.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return valida(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return valida(y, +m[2], +m[1]);
  }
  return null;
}

/** Número de serie de fecha de Excel (ej: 46140) → YYYY-MM-DD. */
export function fechaDeSerieExcel(n: number): string | null {
  const p = XLSX.SSF.parse_date_code(n);
  return p ? valida(p.y, p.m, p.d) : null;
}

function valida(y: number, mes: number, d: number) {
  const f = new Date(y, mes - 1, d);
  return f.getFullYear() === y && f.getMonth() === mes - 1 && f.getDate() === d
    ? aISO(f)
    : null;
}

/** "$ 107.262" / "107,262" / "107262.5" → número. */
export function parseMonto(v: string): number | null {
  let s = v.replace(/[^\d.,-]/g, "");
  if (!s) return null;
  const ultPunto = s.lastIndexOf(".");
  const ultComa = s.lastIndexOf(",");
  if (ultPunto >= 0 && ultComa >= 0) {
    // El último separador es el decimal
    const dec = ultPunto > ultComa ? "." : ",";
    const mil = dec === "." ? "," : ".";
    s = s.split(mil).join("").replace(dec, ".");
  } else if (/^-?\d{1,3}([.,]\d{3})+$/.test(s)) {
    // Solo separadores de miles (formato colombiano 107.262)
    s = s.replace(/[.,]/g, "");
  } else {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// ==========================================================
// LECTURA
// ==========================================================
export async function cargarVentasRango(
  desde: string,
  hasta: string
): Promise<VentaDiaria[]> {
  const filas: VentaDiaria[] = [];
  for (let i = 0; ; i += LOTE) {
    const { data, error } = await supabase
      .from("activos_ventas_diarias")
      .select("id, serial, fecha, venta")
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha")
      .range(i, i + LOTE - 1);
    if (error) throw error;
    for (const r of data ?? []) {
      filas.push({
        id: String(r.id),
        serial: String(r.serial ?? "").trim(),
        fecha: String(r.fecha),
        venta: Number(r.venta) || 0,
      });
    }
    if (!data || data.length < LOTE) break;
  }
  return filas;
}

/** Última fecha con ventas cargadas (para sugerir el siguiente día). */
export async function ultimaFechaCargada(): Promise<string | null> {
  const { data, error } = await supabase
    .from("activos_ventas_diarias")
    .select("fecha")
    .order("fecha", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0]?.fecha ?? null;
}

// ==========================================================
// CARGA DESDE EXCEL
// ==========================================================
const ALIAS: Record<string, "serial" | "fecha" | "venta"> = {
  serial: "serial",
  serie: "serial",
  codigo_activo: "serial",
  cod_activo: "serial",
  activo: "serial",
  codigo: "serial",
  fecha: "fecha",
  dia: "fecha",
  fecha_venta: "fecha",
  venta: "venta",
  ventas: "venta",
  valor: "venta",
  venta_dia: "venta",
  venta_diaria: "venta",
  total: "venta",
};

const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

/** Quita ceros a la izquierda para cruzar seriales. */
const claveSerial = (s: string) => s.trim().replace(/^0+(?=\d)/, "");

export type EstadoFilaVenta = "nueva" | "existe" | "error";

export type FilaVenta = {
  filas: number[]; // filas del Excel (varias si el serial se repite el mismo día)
  serial: string;
  fecha: string;
  venta: number;
  errores: string[];
  estado: EstadoFilaVenta;
  existente: VentaDiaria | null;
  activo: Activo | null;
};

export async function leerExcelVentas(
  archivo: File,
  fechaPorDefecto: string,
  activos: Activo[]
): Promise<{ filas: FilaVenta[]; tieneColumnaFecha: boolean }> {
  const libro = XLSX.read(await archivo.arrayBuffer());
  const hoja = libro.Sheets[libro.SheetNames[0]];
  // Texto: respeta ceros a la izquierda del serial
  const comoTexto = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, {
    defval: "",
    raw: false,
  });
  // Valores crudos: las celdas de fecha llegan como número de serie de Excel
  const crudas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, {
    defval: "",
    raw: true,
  });

  const porSerial = new Map(activos.map((a) => [claveSerial(a.serial), a]));
  let tieneColumnaFecha = false;

  // 1) Interpretar cada fila del Excel
  const leidas = comoTexto.map((original, i) => {
    let serial = "";
    let fechaTxt = "";
    let fechaCruda: unknown = "";
    let ventaTxt = "";
    let ventaCruda: unknown = "";
    for (const [col, valor] of Object.entries(original)) {
      const campo = ALIAS[normalizar(col)];
      const v = String(valor ?? "").trim();
      if (campo === "serial") serial = v;
      if (campo === "fecha") {
        tieneColumnaFecha = true;
        fechaTxt = v;
        fechaCruda = crudas[i]?.[col];
      }
      if (campo === "venta") {
        ventaTxt = v;
        ventaCruda = crudas[i]?.[col];
      }
    }

    const errores: string[] = [];
    if (!serial) errores.push("Falta el serial");

    // Celda de fecha de Excel → número de serie (sin problemas de zona horaria)
    const fecha =
      typeof fechaCruda === "number"
        ? fechaDeSerieExcel(fechaCruda)
        : fechaTxt
          ? parseFecha(fechaTxt)
          : fechaPorDefecto;
    if (!fecha) errores.push(`Fecha "${fechaTxt}" no válida`);

    const venta =
      typeof ventaCruda === "number" ? ventaCruda : parseMonto(ventaTxt);
    if (venta == null) errores.push(`Venta "${ventaTxt}" no válida`);
    else if (venta < 0) errores.push("La venta no puede ser negativa");

    const activo = serial ? porSerial.get(claveSerial(serial)) ?? null : null;
    if (serial && !activo) errores.push("El serial no existe en el sistema");

    return {
      fila: i + 2,
      serial: activo?.serial ?? serial,
      fecha: fecha ?? "",
      venta: venta ?? 0,
      errores,
      activo,
    };
  });

  // 2) Mismo serial y día repetido en el archivo → se suman
  const agrupadas = new Map<string, FilaVenta>();
  const conError: FilaVenta[] = [];
  for (const l of leidas) {
    if (l.errores.length) {
      conError.push({
        filas: [l.fila],
        serial: l.serial,
        fecha: l.fecha,
        venta: l.venta,
        errores: l.errores,
        estado: "error",
        existente: null,
        activo: l.activo,
      });
      continue;
    }
    const k = `${l.serial}|${l.fecha}`;
    const previa = agrupadas.get(k);
    if (previa) {
      previa.venta += l.venta;
      previa.filas.push(l.fila);
    } else {
      agrupadas.set(k, {
        filas: [l.fila],
        serial: l.serial,
        fecha: l.fecha,
        venta: l.venta,
        errores: [],
        estado: "nueva",
        existente: null,
        activo: l.activo,
      });
    }
  }

  // 3) ¿Ya hay venta cargada para ese serial ese día?
  const validas = [...agrupadas.values()];
  const fechas = [...new Set(validas.map((v) => v.fecha))].sort();
  if (fechas.length) {
    const actuales = await cargarVentasRango(fechas[0], fechas[fechas.length - 1]);
    const idx = new Map(actuales.map((v) => [`${v.serial}|${v.fecha}`, v]));
    for (const v of validas) {
      const e = idx.get(`${v.serial}|${v.fecha}`);
      if (e) {
        v.existente = e;
        v.estado = "existe";
      }
    }
  }

  return {
    filas: [...validas, ...conError].sort((a, b) => a.filas[0] - b.filas[0]),
    tieneColumnaFecha,
  };
}

export type ModoExistente = "reemplazar" | "sumar" | "omitir";

/** Guarda las ventas. Inserta en lotes; las existentes se actualizan una a una. */
export async function importarVentas(
  filas: FilaVenta[],
  modo: ModoExistente,
  onProgreso: (hechos: number) => void
) {
  const errores: { serial: string; fecha: string; error: string }[] = [];
  const nuevas = filas.filter((f) => f.estado === "nueva");
  const existentes =
    modo === "omitir" ? [] : filas.filter((f) => f.estado === "existe");
  let hechos = 0;

  for (let i = 0; i < nuevas.length; i += 500) {
    const lote = nuevas.slice(i, i + 500);
    const { error } = await supabase
      .from("activos_ventas_diarias")
      .insert(lote.map((f) => ({ serial: f.serial, fecha: f.fecha, venta: f.venta })));
    if (error) {
      for (const f of lote)
        errores.push({ serial: f.serial, fecha: f.fecha, error: error.message });
    }
    hechos += lote.length;
    onProgreso(hechos);
  }

  for (const f of existentes) {
    const venta = modo === "sumar" ? f.existente!.venta + f.venta : f.venta;
    const { data, error } = await supabase
      .from("activos_ventas_diarias")
      .update({ venta })
      .eq("id", f.existente!.id)
      .select("id");
    if (error || !data?.length) {
      errores.push({
        serial: f.serial,
        fecha: f.fecha,
        error: error?.message ?? "Sin permiso para actualizar (RLS)",
      });
    }
    hechos++;
    onProgreso(hechos);
  }

  return errores;
}

// ==========================================================
// EXCEL DE SALIDA
// ==========================================================
export function descargarPlantillaVentas() {
  const hoja = XLSX.utils.json_to_sheet([
    { serial: "249605", fecha: hoyISO(), venta: 125000 },
    { serial: "247672", fecha: hoyISO(), venta: 87500 },
  ]);
  hoja["!cols"] = [{ wch: 12 }, { wch: 12 }, { wch: 12 }];
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Ventas");
  guardar(libro, "plantilla_ventas_diarias.xlsx");
}

export type ResumenVentaActivo = {
  activo: Activo;
  venta: number;
  presupuesto: number;
  cumplimiento: number | null;
  proyeccion: number;
  diasConVenta: number;
  ultimaVenta: string | null;
  porDia: Map<string, number>;
};

export function exportarVentasMes(
  mes: string,
  resumen: ResumenVentaActivo[],
  dias: string[]
) {
  const hoja = XLSX.utils.json_to_sheet(
    resumen.map((r) => {
      const fila: Record<string, string | number | null> = {
        Serial: r.activo.serial,
        Cliente: r.activo.razon_social,
        "Código cliente": r.activo.codigo_cliente,
        Asesor: r.activo.zona,
        Tipo: r.activo.tipo,
        Presupuesto: r.presupuesto,
        "Venta mes": r.venta,
        "% Cumplimiento":
          r.cumplimiento == null ? null : Math.round(r.cumplimiento * 10) / 10,
        "Proyección cierre": Math.round(r.proyeccion),
        "Días con venta": r.diasConVenta,
      };
      for (const d of dias) fila[d.slice(8)] = r.porDia.get(d) ?? 0;
      return fila;
    })
  );
  hoja["!autofilter"] = { ref: hoja["!ref"] ?? "A1" };
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, `Ventas ${mes}`);
  guardar(libro, `ventas_activos_${mes}.xlsx`);
}

function guardar(libro: XLSX.WorkBook, nombre: string) {
  const buffer = XLSX.write(libro, { bookType: "xlsx", type: "array" });
  saveAs(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    nombre
  );
}
