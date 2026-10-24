export const DIAS = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const;

export const ESTADO_ACTIVO = "ACTIVO";
export const ESTADO_RETIRADO = "RETIRADO";

/** Activo con su asignación, ubicación y resultado comercial ya unidos. */
export type Activo = {
  serial: string;
  tipo: string;
  descripcion: string;
  empresa: string;
  estado: string;
  presupuesto: number | null;

  // Asignación (activos_agenda)
  asignado: boolean;
  codigo_cliente: string;
  razon_social: string;
  zona: string;
  dia_visita: string;

  // Ubicación oficial (activos_coordenadas_oficiales)
  lat: number | null;
  lng: number | null;

  // Comercial (v_activo_resumen_app)
  venta_mes: number | null;
  cumplimiento: number | null;
  semaforo: string;

  // Última visita (historico_activos)
  ultima_visita: string | null;
  ultimo_estado: string | null;
};

export type Zona = {
  codigo_zona: string;
  nombre_zona: string;
  activa: boolean;
};

export type EjecucionZona = {
  zona: string;
  total_dia: number;
  realizados: number;
};

export type EstadoAlerta = "pendiente" | "reasignado" | "devuelto" | "descartado";

/** Reporte del asesor: activo en un punto que no corresponde. */
export type AlertaActivo = {
  id: string;
  created_at: string;
  tipo: "punto_incorrecto" | "no_registrado";
  estado: EstadoAlerta;
  serial_encontrado: string;
  serial_esperado: string | null;
  esperado_no_esta: boolean;
  codigo_cliente_visitado: string | null;
  razon_social_visitada: string | null;
  zona_visitada: string | null;
  dia_visita: string | null;
  codigo_cliente_registrado: string | null;
  razon_social_registrada: string | null;
  zona_registrada: string | null;
  nota: string | null;
  url_foto: string | null;
  latitud: number | null;
  longitud: number | null;
  codigo_zona_asesor: string | null;
  resuelta_por: string | null;
  resuelta_at: string | null;
  nota_resolucion: string | null;
};

/** Datos editables de un activo (formulario y carga masiva). */
export type ActivoEditable = {
  serial: string;
  tipo: string;
  descripcion: string;
  empresa: string;
  presupuesto: number | null;
  codigo_cliente: string;
  razon_social: string;
  zona: string;
  dia_visita: string;
};

export const COLORES = {
  marca: "#0c3b75",
  verde: "#15803d",
  amarillo: "#d97706",
  rojo: "#dc2626",
};

/** Verde ≥ 100%, amarillo ≥ 70%, rojo por debajo. */
export const colorAvance = (pct: number) =>
  pct >= 100 ? COLORES.verde : pct >= 70 ? COLORES.amarillo : COLORES.rojo;

export const colorSemaforo =(s?: string | null) => {
  switch (s?.trim().toLowerCase()) {
    case "verde":
      return COLORES.verde;
    case "amarillo":
      return COLORES.amarillo;
    case "rojo":
      return COLORES.rojo;
    default:
      return "#94a3b8";
  }
};
