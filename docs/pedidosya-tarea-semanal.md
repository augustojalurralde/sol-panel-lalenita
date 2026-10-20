# PedidosYa · Tarea semanal (lunes)

Procedimiento fijo que sigue la tarea programada de los lunes. Lee el portal de PedidosYa en el Chrome
de Augusto (sesión ya iniciada por él), carga los datos en el SOL y escribe el informe de la semana.

**Reglas:** en el portal solo se LEE. No se toca nada (promociones, precios, horarios, menú, préstamos,
PeYa Wallet) y no se descargan archivos: todo se lee como texto de la pantalla. No se escriben contraseñas.
Si el portal o el panel piden iniciar sesión, la tarea se detiene y le avisa a Augusto.

## Qué semana

PedidosYa liquida cada semana (lunes a domingo) unos 8 días después. Por eso, cada lunes:

- **Semana del informe (S):** la que terminó hace 8 días (lunes de hace 2 semanas → domingo de hace 8 días).
  Ya tiene liquidación: el informe cuadra todo al peso.
- **Semana pasada (S+1):** se cargan ventas, operación y pedidos para tenerla lista; en el informe va solo
  un adelanto en "Novedades".

## Pasos

1. **Navegador.** Usar Claude in Chrome (navegador "Browser 1", la Mac de Augusto). Pestaña nueva.
2. **Liquidación de S.** Abrir
   `https://portal-app.pedidosya.com/finance-py/contracts/84486/account-statuses?page=1`, entrar a la
   semana S (o abrir directo `…/account-statuses/<base64>?isLast=0&showCreditTab=0`, donde `<base64>` es
   `WEEKLY#AR#BP#84486|<domingo de S>#ID#0|BDH` en base64) y copiar el texto de la página
   (`document.querySelector('main').innerText`). Cargar: `{ "tipo": "liquidacion", "texto": … }`.
3. **Ventas por local** de S y de S+1: `https://portal-app.pedidosya.com/reports?tab=sales&mode=page&from=<lunes>&to=<domingo>&prevFrom=<lunes-7>&prevTo=<domingo-7>`
   (esperar a que aparezcan los locales) → `{ "tipo": "ventas", "desde": "<lunes>", "texto": … }`.
4. **Operación por local** de S y de S+1: igual con `tab=ops` → `{ "tipo": "operaciones", … }`.
5. **Pedidos día por día** de S+1 (y de S si faltan): `https://portal-app.pedidosya.com/orders?from=<día>&to=<día>`.
   Apretar "Cargar más" hasta que no aparezca (de a tandas cortas: la página es lenta) y leer la lista con
   el lector de abajo → `{ "tipo": "pedidos", "fecha": "<día>", "pedidos": [...] }`.
6. **Cargar en el SOL.** En otra pestaña abrir `https://sol-panel-lalenita.vercel.app/pedidosya` y mandar
   cada envío con `fetch("/api/pedidosya", { method: "POST", headers: { "Content-Type": "application/json" }, body })`.
   Revisar que cada respuesta diga `"ok": true`.
7. **Leer todo junto:** `fetch("/api/pedidosya?semana=<lunes de S>")` devuelve liquidación, ventas y operación
   por local (con semana anterior y año anterior), pedidos con problemas, cargos, cuadre con Maxirest y lo
   que el panel ya detectó para reclamar.
8. **Escribir el informe** de S y cargarlo: `{ "tipo": "informe", "informe": { … } }` (ver abajo).
9. **Avisar a Augusto** con un resumen corto y el link a la sección.

## Lector de la lista de pedidos (se pega en la consola de la pestaña de Pedidos)

```js
const L = document.querySelector('main').innerText.replace(/[  ]/g, ' ').split('\n').map(s => s.trim()).filter(Boolean);
const P = new Map(); let cur = null, m;
for (const s of L) {
  if (/^\d{10}$/.test(s)) { cur = { nro: s, tags: [], extra: [], monto: null }; continue; }
  if (!cur) continue;
  if (!cur.fecha && (m = s.match(/^(\d{2}\/\d{2}|Hoy|Ayer),\s*(\d{2}:\d{2})$/))) { cur.fecha = m[1]; cur.hora = m[2]; continue; }
  if (!cur.fecha) { cur.tags.push(s); continue; }
  if (!cur.local) { cur.local = s.replace(/^\|\s*/, ''); continue; }
  if (cur.monto === null && (m = s.match(/^([\d.]+(?:,\d+)?)\s*\$$/))) { cur.monto = +m[1].replace(/\./g, '').replace(',', '.'); P.set(cur.nro, cur); continue; }
  if (/^[A-ZÁÉÍÓÚÑ ]{3,}$/.test(s)) cur.extra.push(s); else cur = null;
}
JSON.stringify([...P.values()].map(({ fecha, ...o }) => o))
```

## Cómo escribir el informe

Campos: `desde` (lunes de S), `resumen` (3-4 líneas), `bueno[]`, `malo[]`,
`por_local[]` (`{ local, texto }`: por qué subió o bajó cada local), `novedades[]` (incluye el adelanto de S+1 y
avisos del portal), `preguntas[]` (para Agustina, de PedidosYa), `acciones[]` (qué hacer para mejorar),
`reclamar[]` (`{ concepto, monto, detalle }`, solo lo que el panel no detecta solo).

Criterios:

- **Números exactos**, sacados de los datos. Nada inventado. Si algo no se puede saber, decirlo.
- **No afirmar causas como seguras.** "Bajó 12% y estuvo 9 h sin conexión: revisar" ✔ · "Bajó por estar sin conexión" ✘.
- Por local mirar: pedidos y ticket vs semana anterior y año anterior, horas sin conexión, espera evitable,
  reclamos, pedidos cancelados, descuentos del local, y diferencias contra Maxirest.
- En plata mirar: comisión, publicidad (tope 4%), Plus, reclamos, reintegros, impuestos, préstamo y lo que
  llegó al banco; cuenta de pago (contrato: 4181).
- **Para reclamar:** cargos que no son culpa del local, devoluciones de todo el pedido por un faltante, rechazos
  "cerrado / no atiende" con el local abierto, publicidad por encima del 4%, cargos sin detalle, semanas sin pagar.
- Castellano simple, frases cortas. Augusto no es contador ni programador.

## Si algo falla

- Chrome de la Mac apagado o sin la extensión: no se puede leer el portal. Avisar a Augusto y terminar.
- El portal pide iniciar sesión: avisar a Augusto para que entre él; no escribir contraseñas.
- El panel responde 401: Augusto tiene que abrir el panel en Chrome una vez con su clave.
- Falta la liquidación de S: cargar lo demás, escribir el informe sin la parte de plata y decirlo.
