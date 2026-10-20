-- ══════════════════════════════════════════════════════════════════════
-- SOL · Migración 006 · PedidosYa
-- Todo lo que pasa en PedidosYa semana a semana: liquidaciones, ventas y
-- operación por local, pedidos con problemas, reclamos y rechazos que nos
-- cobraron, el informe semanal y lo que hay que reclamarle a PedidosYa.
-- Los datos los carga la tarea semanal (lee el portal de PedidosYa).
-- Se pega ENTERA en Supabase → SQL Editor → New query → Run.
-- Se puede correr más de una vez sin romper nada.
-- ══════════════════════════════════════════════════════════════════════

-- 1) LOCALES: cómo se llama cada local en PedidosYa y a qué unidad del SOL corresponde
create table if not exists peya_locales (
  nombre_peya text primary key,            -- como figura en PedidosYa (ej: "La Leñita Barrio Sur")
  unidad text,                             -- nombre de la unidad en el SOL (para cuadrar con Maxirest)
  sociedad text not null default 'Tres Leños',
  comision_pct numeric,                    -- comisión de PedidosYa (19, 18, 23…)
  activo boolean not null default true
);
insert into peya_locales (nombre_peya, unidad, comision_pct) values
  ('La Leñita Yerba Buena', 'Yerba Buena', 19),
  ('La Leñita Barrio Norte', 'Barrio Norte', 19),
  ('La Leñita Barrio Sur', 'Barrio Sur', 19),
  ('La Leñita Empanadas Tucumanas', 'Recoleta', 19),
  ('San Guchero - Recoleta', 'Recoleta', 18),
  ('Tocka Smash', 'Tocka', 23)
on conflict (nombre_peya) do nothing;

-- 2) LIQUIDACIONES: una por semana (lunes a domingo), tal cual el "Detalle de liquidación"
create table if not exists peya_liquidaciones (
  desde date primary key,                  -- lunes
  hasta date not null,                     -- domingo
  fecha_pago date,
  cuenta text,                             -- últimos 4 números de la cuenta donde se paga
  ventas numeric, ventas_app numeric, ventas_fuera numeric,
  servicio numeric,
  cargos_operativos numeric, cargo_pos numeric, cargo_plus numeric, cargo_reclamos numeric, cargo_cancelaciones numeric,
  publicidad numeric, gold_vip numeric, keywords numeric,
  reintegros numeric, reintegro_desc_peya numeric, reintegro_desc_comercial numeric, reintegro_retiro numeric, reintegro_cancelaciones numeric,
  ajustes numeric,
  impuestos numeric, iva_comisiones numeric, percepcion_iva numeric, percepcion_caba numeric, retencion_caba numeric,
  ingresos numeric, subtotal numeric, credito numeric, total numeric,
  detalle jsonb not null default '{}',     -- todas las líneas leídas (nombre → importe)
  fuente text,                             -- 'portal' o 'archivo'
  actualizado_en timestamptz not null default now()
);

-- 3) VENTAS POR LOCAL Y SEMANA
create table if not exists peya_ventas_local (
  desde date not null,
  local text not null,
  pedidos int,
  bruto numeric,                           -- valor de los productos, sin descuentos
  desc_local numeric,                      -- descuentos que paga el local
  neta numeric,
  comision numeric,
  plus numeric,
  efectivo_pct numeric,                    -- % de pedidos pagados en efectivo en el local
  fuente text,                             -- 'factura' (detalle de pedidos) o 'reporte' (Reportes > Ventas)
  actualizado_en timestamptz not null default now(),
  primary key (desde, local)
);

-- 4) OPERACIÓN POR LOCAL Y SEMANA (Reportes > Operaciones)
create table if not exists peya_operacion_local (
  desde date not null,
  local text not null,
  minutos_no_disponible numeric,
  cancelaciones_evitables_pct numeric,
  espera_evitable_pct numeric,
  preparacion_min numeric,
  reclamos_pct numeric,
  listos_pct numeric,
  actualizado_en timestamptz not null default now(),
  primary key (desde, local)
);

-- 5) VENTAS POR LOCAL Y DÍA (para cuadrar contra Maxirest)
create table if not exists peya_dia_local (
  fecha date not null,
  local text not null,
  pedidos int not null default 0,          -- pedidos realizados
  cancelados int not null default 0,
  bruto numeric not null default 0,
  neta numeric,
  fuente text,
  actualizado_en timestamptz not null default now(),
  primary key (fecha, local)
);

-- 6) PEDIDOS CON PROBLEMAS: cancelados, rechazados o con reclamo
create table if not exists peya_pedidos (
  nro text primary key,
  local text,
  fecha date,
  hora text,
  estado text,                             -- REALIZADOS / CANCELADOS / RECHAZADOS
  entrega text,                            -- 'Retiro en el local' o envío
  problema text,                           -- ej: PRODUCTO FALTANTE
  con_cargo boolean not null default false,
  monto numeric,
  actualizado_en timestamptz not null default now()
);
create index if not exists peya_pedidos_fecha on peya_pedidos (fecha);

-- 7) CARGOS Y REINTEGROS POR PEDIDO (reclamos, rechazos, cancelaciones)
create table if not exists peya_cargos (
  nro text not null,
  tipo text not null,                      -- 'reclamo', 'rechazo', 'reintegro'
  local text,
  fecha date,
  motivo text,
  monto_pedido numeric,
  monto numeric,                           -- negativo = nos cobraron; positivo = nos devolvieron
  semana date,                             -- lunes de la liquidación
  actualizado_en timestamptz not null default now(),
  primary key (nro, tipo)
);
create index if not exists peya_cargos_semana on peya_cargos (semana);

-- 8) INFORME SEMANAL (lo escribe la tarea de los lunes)
create table if not exists peya_informes (
  desde date primary key,
  resumen text,
  bueno jsonb not null default '[]',
  malo jsonb not null default '[]',
  por_local jsonb not null default '[]',   -- [{ "local": "...", "texto": "por qué subió o bajó" }]
  novedades jsonb not null default '[]',
  preguntas jsonb not null default '[]',   -- para Agustina (PedidosYa)
  acciones jsonb not null default '[]',    -- qué hacer para mejorar
  reclamar jsonb not null default '[]',    -- [{ "concepto": "...", "monto": 0, "detalle": "..." }]
  creado_en timestamptz not null default now()
);

-- Seguridad: solo el panel (con la clave de servicio) puede leer y escribir
alter table peya_locales enable row level security;
alter table peya_liquidaciones enable row level security;
alter table peya_ventas_local enable row level security;
alter table peya_operacion_local enable row level security;
alter table peya_dia_local enable row level security;
alter table peya_pedidos enable row level security;
alter table peya_cargos enable row level security;
alter table peya_informes enable row level security;
