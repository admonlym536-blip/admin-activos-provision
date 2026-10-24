import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { Activo, ActivoEditable, DIAS, Zona } from "@/src/lib/tipos";

// ==========================================================
// COLUMNAS RECONOCIDAS (sin tildes, minúsculas, "_" en vez de espacio)
// ==========================================================
const ALIAS: Record<string, keyof ActivoEditable> = {
  serial: "serial",
  serie: "serial",
  tipo: "tipo",
  tipo_activo: "tipo",
  descripcion: "descripcion",
  empresa: "empresa",
  presupuesto: "presupuesto",
  codigo_cliente: "codigo_cliente",
  codigo: "codigo_cliente",
  cod_cliente: "codigo_cliente",
  razon_social: "razon_social",
  cliente: "razon_social",
  nombre_cliente: "razon_social",
  zona: "zona",
  asesor: "zona",
  vendedor: "zona",
  dia_visita: "dia_visita",
  dia: "dia_visita",
};

const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

/** "miercoles" → "Miércoles" */
export function normalizarDia(valor: string): string | null {
  if (!valor.trim()) return "";
  const n = normalizar(valor);
  return DIAS.find((d) => normalizar(d) === n) ?? null;
}

/** Acepta nombre o código de zona; devuelve el nombre de zona. */
export function normalizarZona(valor: string, zonas: Zona[]): string | null {
  if (!valor.trim()) return "";
  const n = normalizar(valor);
  const z = zonas.find(
    (z) => normalizar(z.nombre_zona) === n || normalizar(z.codigo_zona) === n
  );
  return z?.nombre_zona ?? null;
}

export type FilaImportada = {
  fila: number; // número de fila en Excel
  datos: ActivoEditable;
  errores: string[];
  esNuevo: boolean;
};

export async function leerExcel(
  archivo: File,
  zonas: Zona[],
  existentes: Set<string>
): Promise<FilaImportada[]> {
  const libro = XLSX.read(await archivo.arrayBuffer());
  const hoja = libro.Sheets[libro.SheetNames[0]];

  // raw:false → el serial llega como texto (respeta ceros a la izquierda)
  const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, {
    defval: "",
    raw: false,
  });

  const vistos = new Map<string, number>();

  return filas.map((original, i) => {
    const d: ActivoEditable = {
      serial: "",
      tipo: "",
      descripcion: "",
      empresa: "",
      presupuesto: null,
      codigo_cliente: "",
      razon_social: "",
      zona: "",
      dia_visita: "",
    };

    for (const [col, valor] of Object.entries(original)) {
      const campo = ALIAS[normalizar(col)];
      if (!campo) continue;
      const v = String(valor ?? "").trim();
      if (campo === "presupuesto") {
        const n = Number(v.replace(/[^\d.-]/g, ""));
        d.presupuesto = v && Number.isFinite(n) ? n : null;
      } else {
        d[campo] = v;
      }
    }

    const errores: string[] = [];
    const numFila = i + 2; // fila 1 = encabezados

    if (!d.serial) errores.push("Falta el serial");

    if (d.serial) {
      const previa = vistos.get(d.serial);
      if (previa) errores.push(`Serial repetido (fila ${previa})`);
      else vistos.set(d.serial, numFila);
    }

    const zona = normalizarZona(d.zona, zonas);
    if (zona === null) errores.push(`El asesor/zona "${d.zona}" no existe`);
    else d.zona = zona;

    const dia = normalizarDia(d.dia_visita);
    if (dia === null) errores.push(`Día "${d.dia_visita}" no válido`);
    else d.dia_visita = dia;

    if (d.zona && !d.dia_visita && !existentes.has(d.serial))
      errores.push("Falta el día de visita");

    return {
      fila: numFila,
      datos: d,
      errores,
      esNuevo: !existentes.has(d.serial),
    };
  });
}

export function descargarPlantilla() {
  const hoja = XLSX.utils.json_to_sheet([
    {
      serial: "123456",
      tipo: "Nevera",
      descripcion: "NEVERA GOLOSINAS MEDIANA",
      empresa: "PROVISION LYM",
      presupuesto: 300000,
      codigo_cliente: "0000012345",
      razon_social: "Tienda Ejemplo",
      zona: "Pasacaballos",
      dia_visita: "Lunes",
    },
  ]);
  hoja["!cols"] = [10, 14, 30, 16, 12, 16, 28, 16, 12].map((wch) => ({ wch }));
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Activos");
  guardar(libro, "plantilla_activos.xlsx");
}

/**
 * Todos los activos del sistema con las MISMAS columnas de la plantilla,
 * para cruzar con lo que se va a montar (o editar y volver a subir).
 */
export function descargarActivosSistema(activos: Activo[]) {
  const ordenados = [...activos].sort((a, b) =>
    a.serial.localeCompare(b.serial, "es", { numeric: true })
  );
  const hoja = XLSX.utils.json_to_sheet(
    ordenados.map((a) => ({
      serial: a.serial,
      tipo: a.tipo,
      descripcion: a.descripcion,
      empresa: a.empresa,
      presupuesto: a.presupuesto,
      codigo_cliente: a.codigo_cliente,
      razon_social: a.razon_social,
      zona: a.zona,
      dia_visita: a.dia_visita,
      estado: a.estado,
      con_ubicacion: a.lat != null ? "Sí" : "No",
    }))
  );
  hoja["!cols"] = [10, 14, 30, 16, 12, 16, 28, 16, 12, 11, 13].map((wch) => ({
    wch,
  }));
  hoja["!autofilter"] = { ref: hoja["!ref"] ?? "A1" };
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Activos");
  const fecha = new Date().toISOString().slice(0, 10);
  guardar(libro, `activos_sistema_${fecha}.xlsx`);
}

/** Resultado de cruzar un archivo contra el sistema, fila por fila. */
export function descargarCruce(
  filas: FilaImportada[],
  actuales: Map<string, Activo>,
  nombreArchivo: string
) {
  const hoja = XLSX.utils.json_to_sheet(
    filas.map((f) => {
      const s = actuales.get(f.datos.serial);
      const resultado = f.errores.length
        ? "Error"
        : !s
          ? "Nuevo"
          : s.estado === "RETIRADO"
            ? "Ya existe (dado de baja)"
            : "Ya existe";
      return {
        "Fila archivo": f.fila,
        Serial: f.datos.serial,
        Resultado: resultado,
        Detalle: f.errores.join(" · "),
        "Tipo (archivo)": f.datos.tipo,
        "Cliente (archivo)": f.datos.razon_social,
        "Asesor (archivo)": f.datos.zona,
        "Día (archivo)": f.datos.dia_visita,
        "Cliente en sistema": s?.razon_social ?? "",
        "Código cliente en sistema": s?.codigo_cliente ?? "",
        "Asesor en sistema": s?.zona ?? "",
        "Día en sistema": s?.dia_visita ?? "",
        "Estado en sistema": s?.estado ?? "",
      };
    })
  );
  hoja["!cols"] = [8, 10, 22, 30, 14, 26, 16, 10, 26, 18, 16, 10, 12].map(
    (wch) => ({ wch })
  );
  hoja["!autofilter"] = { ref: hoja["!ref"] ?? "A1" };
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Cruce");
  const base = nombreArchivo.replace(/\.[^.]+$/, "") || "archivo";
  guardar(libro, `cruce_${base}.xlsx`);
}

export function exportarActivos(activos: Activo[]) {
  const hoja = XLSX.utils.json_to_sheet(
    activos.map((a) => ({
      Serial: a.serial,
      Tipo: a.tipo,
      Descripción: a.descripcion,
      Empresa: a.empresa,
      Estado: a.estado,
      Presupuesto: a.presupuesto,
      "Código cliente": a.codigo_cliente,
      "Razón social": a.razon_social,
      "Asesor / Zona": a.zona,
      "Día visita": a.dia_visita,
      Latitud: a.lat,
      Longitud: a.lng,
      "Venta mes": a.venta_mes,
      "% Cumplimiento": a.cumplimiento,
      Semáforo: a.semaforo,
      "Última visita": a.ultima_visita,
      "Último estado": a.ultimo_estado,
    }))
  );
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, "Activos");
  const fecha = new Date().toISOString().slice(0, 10);
  guardar(libro, `activos_${fecha}.xlsx`);
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
