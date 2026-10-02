-- ══════════════════════════════════════════════════════════════════════
-- SOL · Migración 004 · La Rural de Palermo se lee de su sistema (HIOPOS)
-- Se pega ENTERA en Supabase → SQL Editor → New query → Run.
-- Se puede correr más de una vez sin romper nada.
-- ══════════════════════════════════════════════════════════════════════

-- 1) Número de nuestro puesto dentro de HIOPOS (en la cuenta de la feria hay muchos puestos)
alter table unidades add column if not exists hiopos_tienda int;

-- 2) La Rural: deja la planilla y pasa a leerse de HIOPOS (puesto 25 = "LA LEÑITA")
update unidades set fuente = 'hiopos', hiopos_tienda = 25, tipo = 'local', grupo = 'La Leñita', activa = true
  where nombre = 'Palermo / La Rural';

-- 3) Lo que hubiera quedado cargado a mano de La Rural por planilla se borra (ahora manda HIOPOS)
delete from ventas_planilla where unidad_id = (select id from unidades where nombre = 'Palermo / La Rural');
delete from ventas_diarias  where fuente = 'Planilla' and unidad_id = (select id from unidades where nombre = 'Palermo / La Rural');

-- 4) CONTROL: "Palermo / La Rural" debería decir fuente hiopos y tienda 25
select id, nombre, grupo, tipo, fuente, hiopos_tienda, maxirest_codigo from unidades order by id;
