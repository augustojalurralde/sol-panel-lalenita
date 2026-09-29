@AGENTS.md

# Panel SOL — La Leñita

- Especificación funcional completa: `docs/SOL-especificacion.md`. Respetarla siempre.
- Lo marcado **NO DEFINIDO** no se inventa: se muestra "Sin definir" y se deja configurable.
- Umbrales de semáforos: todos en `lib/config.ts` (nunca fijos dentro de las pantallas). Sin color naranja hasta que se defina.
- Datos de prueba en `lib/mockData.ts`. Más adelante vendrán de Supabase (cargados con n8n); las pantallas no deben saber de Maxirest/bancos.
- El usuario (Augusto, CEO) no es programador: explicar en castellano simple, paso a paso.
