-- ══════════════════════════════════════════════════════════════════════
-- SOL · Migración 002 · Detalle de ventas (turnos, tickets, cobros, artículos)
-- Se pega ENTERA en Supabase → SQL Editor → New query → Run.
-- Se puede correr más de una vez sin romper nada.
-- ══════════════════════════════════════════════════════════════════════

-- 1) TIPO DE UNIDAD: local o fábrica ───────────────────────────────────
-- La fábrica (Central, Maxirest 29979) va siempre aparte y nunca se compara con locales.
-- La cuenta 26621 "La Lenita YB Fabrica" es el LOCAL Yerba Buena (no la fábrica).
alter table unidades add column if not exists tipo text not null default 'local';
alter table unidades drop constraint if exists unidades_tipo_check;
alter table unidades add constraint unidades_tipo_check check (tipo in ('local', 'fabrica'));
update unidades set tipo = 'fabrica' where maxirest_codigo = '29979';
update unidades set tipo = 'local'   where maxirest_codigo = '26621';


-- 2) TURNOS (configurables) ────────────────────────────────────────────
-- Los tickets se asignan a un turno por su HORA DE ENTRADA.
-- Si "hasta" es menor que "desde", el turno cruza la medianoche (la madrugada
-- ya viene anotada por Maxirest en el día anterior). Lo que no cae en ningún
-- turno se muestra como "Fuera de turno".
create table if not exists turnos_config (
  id serial primary key,
  tipo_unidad text not null check (tipo_unidad in ('local', 'fabrica')),
  nombre text not null,
  desde time not null,
  hasta time not null,
  orden int not null default 1,
  unique (tipo_unidad, nombre)
);
insert into turnos_config (tipo_unidad, nombre, desde, hasta, orden) values
  ('local',   'Mediodía',    '10:30', '15:30', 1),
  ('local',   'Noche',       '19:30', '06:00', 2),
  ('fabrica', 'Turno único', '06:00', '16:00', 1)
on conflict (tipo_unidad, nombre) do nothing;


-- 3) EQUIVALENCIAS DE EMPANADAS (editable) ─────────────────────────────
-- Cuántas empanadas trae cada artículo. Lo que no está en esta tabla NO cuenta
-- como empanada (pizzas, wraps, tartas, bebidas…).
-- OJO: los códigos son de cada Maxirest. Estos son los de la FÁBRICA;
-- en los locales los mismos números son otros artículos (por eso "tipo_unidad").
create table if not exists equivalencias_empanadas (
  tipo_unidad text not null check (tipo_unidad in ('local', 'fabrica')),
  codigo int not null,
  descripcion text,
  empanadas numeric not null,
  primary key (tipo_unidad, codigo)
);
insert into equivalencias_empanadas (tipo_unidad, codigo, descripcion, empanadas)
select 'fabrica', c, d, e from (
  select unnest(array[10,11,12,13,14,15,18,19,21]) c, 'Tabla Tucumán' d, 42 e
  union all select 16, 'Tabla Sfijas', 36
  union all select unnest(array[45,46,47,48,49,51,53,59]), 'Caja *120', 120
  union all select 1445, 'Caja emp 90gr a mano', 175
  union all select unnest(array[70,71,72]), 'Caja 80gr *160', 160
  union all select generate_series(1, 9), 'Docena', 12
  union all select unnest(array[64,1456]), 'Docena', 12
  union all select generate_series(1448, 1455), 'Paquete x6', 6
  union all select generate_series(80, 99), 'Suelta', 1
  union all select unnest(array[1415,1418]), 'Suelta', 1
) x
on conflict (tipo_unidad, codigo) do nothing;


-- 3b) CLIENTES DE LA FÁBRICA QUE SON LOCALES PROPIOS (editable) ────────
-- En la fábrica, las ventas a nuestros propios locales aparecen en Maxirest con el
-- local como "forma de pago" (ej: "Bn", "Yb", "Bs"). Las que estén acá con
-- es_local_propio = true van al concepto "Ventas a locales propios" y NO se suman a Mayorista.
-- Para agregar un local nuevo: Table Editor → clientes_locales_propios → Insert row.
-- Las mayúsculas y minúsculas no importan.
create table if not exists clientes_locales_propios (
  forma_pago text primary key,          -- como aparece en Maxirest (ej: "Bn")
  descripcion text,
  es_local_propio boolean not null default true
);
insert into clientes_locales_propios (forma_pago, descripcion, es_local_propio) values
  ('Bn', 'Barrio Norte', true),
  ('Yb', 'Yerba Buena', true),
  ('Bs', 'Barrio Sur', true),
  -- Aparecen en Maxirest pero falta confirmar si son locales propios: poner true si corresponde
  ('Bsas', 'A confirmar (¿Buenos Aires?)', false),
  ('Sm/sm salon', 'A confirmar', false),
  ('Molino sur', 'A confirmar', false)
on conflict (forma_pago) do nothing;


-- 4) TICKETS (un renglón por comprobante) ──────────────────────────────
-- Un pago dividido viene de Maxirest en dos renglones con el total repetido:
-- acá se guarda UNA vez, con las formas de pago juntas ("Efectivo + Qr mp").
create table if not exists ventas_tickets (
  unidad_id int not null references unidades(id),
  fecha date not null,                -- día comercial de Maxirest
  comprobante text not null,
  turno_maxirest smallint,            -- 1 = Mañana (Mediodía), 2 = Noche
  hora_entrada time,
  hora_salida time,
  concepto text,                      -- Mostrador, Delivery, Pedidos ya / Mayorista, De fábrica, V. menor
  mozo int,
  mesa text,
  cubiertos int not null default 0,
  descuento numeric not null default 0,
  total numeric not null default 0,
  formas_pago text,
  pago_dividido boolean not null default false,
  actualizado_en timestamptz not null default now(),
  primary key (unidad_id, fecha, comprobante)
);
create index if not exists ventas_tickets_fecha on ventas_tickets (fecha);


-- 5) FORMAS DE COBRO por día y turno de Maxirest ───────────────────────
create table if not exists ventas_cobros (
  unidad_id int not null references unidades(id),
  fecha date not null,
  turno smallint not null,            -- turno de Maxirest (1 = Mediodía, 2 = Noche)
  forma text not null,
  codigo_tipo text,
  cantidad int not null default 0,
  total numeric not null default 0,
  actualizado_en timestamptz not null default now(),
  primary key (unidad_id, fecha, turno, forma)
);
create index if not exists ventas_cobros_fecha on ventas_cobros (fecha);


-- 6) ARTÍCULOS VENDIDOS por día y turno de Maxirest ────────────────────
create table if not exists ventas_articulos (
  unidad_id int not null references unidades(id),
  fecha date not null,
  turno smallint not null,            -- turno de Maxirest (1 = Mediodía, 2 = Noche)
  codigo int not null,
  nombre text not null,
  rubro text not null default 'Sin Rubro',
  unidades numeric not null default 0,
  venta numeric not null default 0,
  actualizado_en timestamptz not null default now(),
  primary key (unidad_id, fecha, turno, codigo)
);
create index if not exists ventas_articulos_fecha on ventas_articulos (fecha);


-- 7) SEGURIDAD: igual que las tablas anteriores (solo el panel, con su llave secreta)
alter table turnos_config enable row level security;
alter table equivalencias_empanadas enable row level security;
alter table clientes_locales_propios enable row level security;
alter table ventas_tickets enable row level security;
alter table ventas_cobros enable row level security;
alter table ventas_articulos enable row level security;


-- 8) CONTROL: al final debería mostrar la fábrica con tipo "fabrica" y el resto "local"
select id, nombre, maxirest_codigo, tipo from unidades order by id;
