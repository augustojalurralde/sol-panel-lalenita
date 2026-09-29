-- Esquema de la base de datos del SOL (ya ejecutado en Supabase el 29/09/2026)
create table unidades (
  id serial primary key,
  nombre text not null unique,
  grupo text not null default 'La Leñita',
  maxirest_codigo text unique,
  activa boolean not null default true
);
insert into unidades (nombre, maxirest_codigo) values
  ('Barrio Norte', '29978'), ('Barrio Sur', '26592'), ('Yerba Buena', '26621'),
  ('Recoleta', '25851'), ('Fábrica Central', '29979'),
  ('Palermo / La Rural', null), ('Feria Buenos Aires', null);
create table ventas_diarias (
  unidad_id int not null references unidades(id),
  fecha date not null,
  salon numeric not null default 0,
  mostrador numeric not null default 0,
  delivery numeric not null default 0,
  total numeric not null default 0,
  cantidad_ventas int not null default 0,
  cubiertos int not null default 0,
  fuente text not null default 'Maxirest',
  actualizado_en timestamptz not null default now(),
  primary key (unidad_id, fecha)
);
create table registro_cargas (
  id serial primary key,
  fuente text not null,
  unidad_id int references unidades(id),
  fecha_dato date,
  estado text not null,
  mensaje text,
  creado_en timestamptz not null default now()
);
alter table unidades enable row level security;
alter table ventas_diarias enable row level security;
alter table registro_cargas enable row level security;
