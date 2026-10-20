-- ══════════════════════════════════════════════════════════════════════
-- SOL · Migración 005 · Pedidos de la tienda online (Tiendanube)
-- Cada compra de lalenitacongelados.mitiendanube.com entra acá,
-- se avisa al grupo de Telegram de la fábrica y se sigue su estado.
-- Se pega ENTERA en Supabase → SQL Editor → New query → Run.
-- Se puede correr más de una vez sin romper nada.
-- ══════════════════════════════════════════════════════════════════════

-- 1) PEDIDOS: uno por compra de la tienda
create table if not exists pedidos_web (
  id bigint primary key,                    -- número interno de Tiendanube (no se ve en la tienda)
  numero int,                               -- número de pedido que ve el cliente (#101, #102…)
  cliente text,
  telefono text,
  email text,
  items jsonb not null default '[]',        -- [{ "nombre": "...", "cantidad": 10, "precio": 8300, "sector": "Empanadas" }]
  total numeric not null default 0,
  pago text,                                -- 'pagado' o 'pendiente' (a convenir / sin acreditar)
  medio_pago text,
  retiro text,                              -- local o punto de retiro que eligió
  nota text,                                -- comentario del cliente
  estado text not null default 'pendiente', -- pendiente → confirmado → en_produccion → listo → entregado (o cancelado)
  fecha_compromiso timestamptz,             -- para cuándo tiene que estar listo
  telegram_mensaje_id bigint,               -- mensaje del grupo que se va actualizando
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists pedidos_web_estado on pedidos_web (estado, fecha_compromiso);

-- 2) HISTORIAL: quién cambió cada estado y cuándo
create table if not exists pedidos_web_eventos (
  id serial primary key,
  pedido_id bigint not null references pedidos_web(id) on delete cascade,
  estado text not null,
  quien text,
  creado_en timestamptz not null default now()
);

-- 3) CONEXIONES: acá el panel guarda solo la clave de Tiendanube al instalar la app
--    (nadie la tiene que copiar ni pegar)
create table if not exists integraciones (
  nombre text primary key,
  datos jsonb not null default '{}',
  actualizado_en timestamptz not null default now()
);

-- Seguridad: solo el panel (con la clave de servicio) puede leer y escribir
alter table pedidos_web enable row level security;
alter table pedidos_web_eventos enable row level security;
alter table integraciones enable row level security;
