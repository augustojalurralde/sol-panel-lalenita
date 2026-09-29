# SOL — Sistema Operativo La Leñita
## Especificación funcional del panel web (consolidada)

> Donde dice **NO DEFINIDO** no se inventa nada: queda configurable.

### 0. Principios
- Sistema de decisión para Dirección, no un tablero lleno de datos. Resumen primero, detalle después.
- Cada número tiene fuente identificable y responsable. Si un dato está desactualizado se muestra explícitamente.
- Los indicadores importantes deben permitir entrar al detalle con un clic.
- Semáforos basados en reglas configurables (no fijas en el código).
- Soportar al menos 15 unidades sin rediseñar.
- El motor de decisiones prioriza y sugiere qué revisar, pero **no inventa causalidad** ("Revisar canal PedidosYa" ✔ / "Las ventas cayeron por PedidosYa" ✘).
- La IA redacta/prioriza sobre datos ya calculados; nunca inventa cifras.
- El color **naranja no tiene regla definida**: no usarlo.
- Arquitectura: Maxirest / Excel / Bancos / Mercado Pago / cargas manuales → Supabase → n8n → modelo de negocio → motor de decisiones → panel web.

### 1. Unidades
**La Leñita gastronómica:** Barrio Norte, Barrio Sur, Yerba Buena, Recoleta (locales); Palermo / La Rural (local/evento); Feria Buenos Aires (feria/evento); Fábrica Central (fábrica + venta).
- Fábrica Central **vende realmente** (Maxirest) a locales propios y a mayoristas terceros. Campo `TipoCliente`: Local propio / Mayorista tercero.
- Eliminación de ventas intercompañía: NO DEFINIDA para el MVP.

**Ecosistema externo:** Molino Barrio Norte y Molino Barrio Sur (forrajería, Augusto + madre), Tocka (hamburguesería, Augusto + Joaquín). Visibles en SOL pero **no consolidan por defecto** con La Leñita; debe existir un selector para incluirlas.

### 2. Responsables
| Persona | Función |
|---|---|
| Augusto | Director General. Ve todo. Define objetivos, prioridades, permisos, umbrales. |
| Pablo | Encargado de Fábrica. Planifica producción. Supervisión general de fábrica. |
| Iván | Registra producción, inventarios, check-in diario, entradas/compras y ventas/pedidos en Maxirest. |
| Flor | Administración, compras, tesorería, pagos, cobros, ventas mayoristas. |
| Romina | Información de ventas / consolidación comercial. |

Ventas → Romina · Producción → Pablo planifica, Iván registra · Check-in → Iván · Inventarios → cada área cuenta, Iván consolida · Compras → Flor compra, Iván registra ingreso · Tesorería/pagos/cobros → Flor · Mayoristas → Flor vende, Iván registra · Escalamiento final → Augusto.

### 3. Inicio / Centro de Dirección
**Pregunta:** ¿Cómo está la empresa hoy y qué necesita mi atención? (entenderse en < 5 minutos)
- "Venta hoy" en tiempo real (comparación NO DEFINIDA) + "Venta ayer" cerrada vs mismo día semana anterior.
- Venta acumulada mes (vs mes anterior / presupuesto cuando exista), ticket promedio, disponible total.
- Estado de actualización por fuente: Fuente / Último dato / Estado (OK, Pendiente, Atrasado) / Responsable / Escalamiento. "No hubo ventas" ≠ "No llegaron los datos".
- Orden de bloques: Estado de datos → Resumen ejecutivo → Ventas → Operaciones → Tesorería → Alertas.
- Resumen ejecutivo en una frase (ej: "La operación general está estable. Revisar Barrio Sur por caída de ventas y comprar nalga por cobertura crítica.").
- No mostrar alertas menores que no requieran acción.
- Decisión: Inicio no repite los 11 indicadores; producción/personal/despachos viven en Fábrica y suben a Inicio solo como alerta.
- Ranking de artículos vendidos: pendiente (requiere datos de Maxirest).
- Mercado Pago cuenta como dinero disponible en el MVP.

### 4. Comparativo de Locales
**Pregunta:** ¿Qué local necesita atención y por qué? Una sola tabla, el que más necesita atención primero.
Columnas: Prioridad · Local · Venta ayer · Venta mes · Variación (vs mismo día semana anterior) · Ticket promedio · Área principal · Tendencia · Responsable · Última novedad · Recomendación. Clic para ver detalle (pendiente).
- Motor de prioridad: Severidad 50% + Plazo 30% + Impacto 20%. Umbral de rojo NO DEFINIDO (configurable). Pendiente de datos reales.
- Tendencia: últimos 3 días vs 3 anteriores. Margen de "estable" NO DEFINIDO.
- Última novedad: manual (Local / Fecha / Texto / Cargado por).
- Recomendaciones por regla: venta baja + ticket baja → "Revisar ticket promedio"; stock bajo → "Comprar [insumo], cobertura crítica"; pago en 48 h → "Cubrir [obligación]"; canal → "Revisar canal X". Nunca afirmar causas.

### 5. Estado de la Fábrica
**Pregunta:** ¿La fábrica está preparada para abastecer correctamente a toda la empresa hoy?
- Producción: planificada, realizada, % cumplimiento (objetivo 100%), pendiente de fabricar, lista para despachar, despachada. Pablo planifica, Iván registra.
- Stock crítico: Materia prima · Stock actual · Consumo promedio diario · Días cobertura (stock/consumo) · Estado · Compra realizada · Responsable · Fecha prevista ingreso. **No alarmar si ya fue comprado y está en camino.**
- Personal: esperada, presentes, ausentes, diferencia; ausentes con puesto y si es persona clave (destacar).
- Check-in diario (Iván, temprano): realizado, quién, hora, novedades de personal, maquinaria, materia prima, producción, problemas.
- Compras: cantidad pendiente, monto, MP críticas asociadas, responsable (Flor compra, Iván registra).
- Gráfico posible: producción real vs planificada. Otros NO DEFINIDOS.
- Selector de unidad preparado; Molinos/Tocka no usan lógica de fábrica.

### 6. Tesorería
**Pregunta:** ¿Tenemos dinero suficiente y qué obligaciones requieren atención inmediata?
- Disponible total = Caja Administración + Caja Fábrica + BBVA + Macro + Mercado Pago (con desglose).
- Pagos: Proveedor · Concepto · Monto · Vencimiento · Días restantes · Estado · Responsable. Rojo hoy/mañana; amarillo 2–7 días; verde > 7.
- Cobros: Cliente · Monto · Vencimiento · Días · Estado · Responsable. Rojo vencido; amarillo 0–7 días; verde > 7.
- Flujo proyectado (mostrar la cuenta): Disponible + cobros 7 días − pagos 7 días = saldo proyectado.
- Cobertura de liquidez: gasto neto diario promedio = (pagos − cobros) últimos 14 días / 14; días = disponible / gasto neto diario. Umbrales propuestos 10/5 días **A CONFIRMAR** (no usar como regla).
- Cuentas corrientes: total nos deben / total debemos.
- Responsable: Flor. Actualización diaria.

### 7. Estado de Resultados
**Pregunta:** ¿La empresa está generando dinero y dónde ganamos o perdemos rentabilidad?
- Cuadro: Ventas; − Costo mercadería; = Margen bruto; − Personal; − Gastos operativos; − Administración; − Comerciales; − Financieros; = Resultado operativo. Cada línea en $ y % sobre venta, con variación vs mes anterior.
- Presupuesto vs real: Categoría · Presupuesto · Real · Desvío $ (Real − Presupuesto) · Desvío % (Desvío / Presupuesto). Se carga al inicio de cada mes. Metas NO DEFINIDAS.
- Rentabilidad por unidad: Unidad · Venta · Resultado · Resultado % · Semáforo (umbrales NO DEFINIDOS), de mayor a menor. Ecosistema externo no consolida por defecto.
- Fábrica usa sus ventas reales de Maxirest (precio de transferencia DESCARTADO).
- Gráfico de línea: resultado/margen últimos 12 meses; tendencia con promedio móvil de 3 meses (umbral de estabilidad NO DEFINIDO).
- Fuentes: ventas Maxirest; costo mercadería cálculo mensual Pablo/Flor; gastos Flor. Frecuencia mensual.
- El resumen debe dar una conclusión, no repetir la tabla.

### 8. Objetivos y Dirección
**Pregunta:** ¿Qué debe hacer el Director hoy, esta semana y este mes para cumplir los objetivos?
- Horizonte: Hoy / Mañana / Esta semana / Próxima semana / Mes.
- Objetivos: Objetivo · Horizonte · Métrica · Meta · Actual · Cumplimiento % · Responsable · Estado (En curso / Riesgo / Cumplido). Historial cumplidos/incumplidos.
- Proyectos: Proyecto · Estado (En curso / Atrasado / Completado / Pausado) · Inicio · Fin esperado · Responsable · Objetivo asociado.
- Tareas: Tarea · Responsable · Vencimiento · Estado (Pendiente / Vencida / Completada) · Proyecto.
- Indicadores estratégicos reutilizados: venta vs objetivo, resultado, margen, unidades con pérdida, objetivos cumplidos, proyectos atrasados, tareas vencidas.
- 100% carga manual. Si pasan 7 días sin actualizar: 🔴 "Dirección Estratégica desactualizada".
- Decisión: la "Agenda del Director" con horarios NO se construye (duplica el calendario); a futuro se puede mostrar Google Calendar.

### 9–10. Sectores y personas
Sectores: Dirección, Administración, Tesorería, Compras, Ventas, Venta mayorista, Locales, Fábrica/Producción, Inventarios, Despacho, Personal/asistencia, Mantenimiento, Rentabilidad/costos, Objetivos/proyectos/tareas.
Personas Fábrica: Pablo, Lucas, Myriam, Carlos, Rodrigo, Romina, Ramón, Iván. Locales: Ale, Leo; managers Mariana, Ivo, Andrea, Naim. Asignación a local/turno NO DEFINIDA (no inventar organigrama).

### 11. Metas
Definidas: ~15 unidades; producción 100% del plan; ventas vs mismo día semana anterior; stock >4 / 2–4 / <2 días.
NO DEFINIDAS: meta mensual de ventas (general y por local), ticket objetivo, margen bruto y operativo objetivo, resultado mínimo por local, cobertura mínima de tesorería, ausentismo, productividad de fábrica, objetivos estratégicos concretos.

### 12. Permisos
Augusto: todo. Romina: ventas. Pablo: producción/fábrica/stock. Flor: administración/compras/tesorería. Iván: check-in, registros operativos. Encargado de local: su local. Matriz definitiva NO DEFINIDA. Un usuario no recibe información que no tiene permiso para ver.

### 13. Fuentes
| Información | Fuente | Responsable | Frecuencia |
|---|---|---|---|
| Ventas / ranking artículos | Maxirest | Romina | Diaria |
| Producción | Plan Pablo + registro Iván | Pablo/Iván | Diaria |
| Stock MP | Conteos por área + Iván | Área/Iván | Diaria |
| Compras | Flor + registro Iván | Flor/Iván | Al movimiento |
| Mayoristas | Flor + registro Iván | Flor/Iván | Al pedido |
| Check-in / asistencia | Manual | Iván | Diaria |
| BBVA / Macro / Mercado Pago / Caja | Bancos / manual | Flor | Diaria |
| Costos / gastos | Administración | Pablo/Flor | Mensual |
| Objetivos / tareas / proyectos | Manual | Augusto / cada responsable | Semanal |

### 14. Semáforos maestros
| Indicador | Verde | Amarillo | Rojo |
|---|---|---|---|
| Venta vs mismo día semana anterior | ≥ −5% | −5% a −10% | < −10% |
| Stock MP (días) | > 4 | 2–4 | < 2 |
| Pago | > 7 días | 2–7 días | hoy/mañana |
| Cobro | > 7 días | 0–7 días | vencido |
| Rentabilidad / Liquidez / Objetivos | NO DEFINIDO | NO DEFINIDO | NO DEFINIDO |
| Actualización estratégica | actualizado | NO DEFINIDO | > 7 días |
Naranja: NO DEFINIDO en todos.

### 15. Motor de decisiones
Severidad 50% + Urgencia 30% + Impacto 20% → Problema · Prioridad · Responsable · Recomendación · Última novedad · Tendencia. Inicio dice dónde mirar; después se entra al detalle.

### 16. Orden de trabajo
Conservar Inicio, Comparativo y Fábrica (ajustar, no rehacer). Construir en orden: Tesorería → Estado de Resultados → Objetivos y Dirección. Luego conectar Inicio con todo. No agregar pantallas nuevas antes de terminar estas seis.
