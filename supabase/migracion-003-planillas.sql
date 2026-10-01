-- ══════════════════════════════════════════════════════════════════════
-- SOL · Migración 003 · Ventas que vienen de planillas de Google
-- (Molino Norte, Molino Sur, Tocka, La Rural de Palermo, Hipódromo de Palermo)
-- Se pega ENTERA en Supabase → SQL Editor → New query → Run.
-- Se puede correr más de una vez sin romper nada.
-- ══════════════════════════════════════════════════════════════════════

-- 1) DE DÓNDE SALE LA VENTA DE CADA UNIDAD: 'maxirest' o 'planilla'
alter table unidades add column if not exists fuente text;
update unidades set fuente = 'maxirest' where maxirest_codigo is not null and fuente is null;

-- 2) FERIAS: "Feria Buenos Aires" es el Hipódromo de Palermo. Ambas son de La Leñita.
update unidades set nombre = 'Hipódromo de Palermo' where nombre = 'Feria Buenos Aires';
update unidades set fuente = 'planilla', tipo = 'local', grupo = 'La Leñita'
  where nombre in ('Palermo / La Rural', 'Hipódromo de Palermo');

-- 3) MOLINOS Y TOCKA: locales con planilla, en un grupo aparte (no se suman a La Leñita)
insert into unidades (nombre, grupo, tipo, fuente, activa) values
  ('Molino Norte', 'Molinos y Tocka', 'local', 'planilla', true),
  ('Molino Sur',   'Molinos y Tocka', 'local', 'planilla', true),
  ('Tocka',        'Molinos y Tocka', 'local', 'planilla', true)
on conflict (nombre) do update set grupo = excluded.grupo, tipo = excluded.tipo, fuente = excluded.fuente, activa = true;

-- 4) VENTA POR TURNO Y FORMA DE COBRO, tal como viene de la planilla
create table if not exists ventas_planilla (
  unidad_id int not null references unidades(id),
  fecha date not null,
  turno text not null,                  -- 'Mediodía', 'Noche' o 'Día' (ferias)
  venta numeric not null default 0,     -- VENTAS TT
  efectivo numeric not null default 0,
  mp numeric not null default 0,        -- MP/TC, QR o Mercado Pago
  transferencia numeric not null default 0,
  pedidos_ya numeric not null default 0,
  banco numeric not null default 0,
  proveedores numeric not null default 0,  -- pagos a proveedores hechos con la caja
  gastos numeric not null default 0,
  dif numeric not null default 0,
  actualizado_en timestamptz not null default now(),
  primary key (unidad_id, fecha, turno)
);
create index if not exists ventas_planilla_fecha on ventas_planilla (fecha);
alter table ventas_planilla enable row level security;

-- 5) CONTROL: debería mostrar las 3 nuevas y las 2 ferias con fuente 'planilla'
select id, nombre, grupo, tipo, fuente, maxirest_codigo from unidades order by id;
