-- =====================================================================
-- ALERTAS DE ACTIVOS
-- El asesor reporta desde la app un activo que encontró en un punto que
-- no corresponde (o que no existe en el sistema). El administrador las
-- gestiona desde el panel web (sección "Alertas").
--
-- Ejecutar una sola vez en Supabase → SQL Editor.
-- =====================================================================

create table if not exists public.alertas_activos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  tipo text not null
    check (tipo in ('punto_incorrecto', 'no_registrado')),
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'reasignado', 'devuelto', 'descartado')),

  -- Activo escaneado y el que se esperaba en el punto
  serial_encontrado text not null,
  serial_esperado text,
  esperado_no_esta boolean not null default false,

  -- Punto que visitaba el asesor (donde se encontró el activo)
  codigo_cliente_visitado text,
  razon_social_visitada text,
  zona_visitada text,
  dia_visita text,

  -- Dónde estaba registrado el activo encontrado
  codigo_cliente_registrado text,
  razon_social_registrada text,
  zona_registrada text,

  -- Evidencia del asesor
  nota text,
  url_foto text,
  latitud double precision,
  longitud double precision,
  codigo_zona_asesor text,

  -- Gestión del administrador
  resuelta_por text,
  resuelta_at timestamptz,
  nota_resolucion text
);

create index if not exists alertas_activos_estado_idx
  on public.alertas_activos (estado, created_at desc);

alter table public.alertas_activos enable row level security;

-- La app del asesor (sin sesión de Supabase) solo puede CREAR alertas
drop policy if exists "asesores crean alertas" on public.alertas_activos;
create policy "asesores crean alertas" on public.alertas_activos
  for insert to anon, authenticated
  with check (estado = 'pendiente');

-- Solo administradores (con sesión) pueden verlas y gestionarlas
drop policy if exists "admins leen alertas" on public.alertas_activos;
create policy "admins leen alertas" on public.alertas_activos
  for select to authenticated using (true);

drop policy if exists "admins gestionan alertas" on public.alertas_activos;
create policy "admins gestionan alertas" on public.alertas_activos
  for update to authenticated using (true) with check (true);
