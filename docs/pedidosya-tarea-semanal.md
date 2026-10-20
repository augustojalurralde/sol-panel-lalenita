# PedidosYa · Tarea semanal (lunes)

Procedimiento fijo que sigue la tarea programada de los lunes. Lee el portal de PedidosYa en el Chrome
de la oficina (sesión ya iniciada por Augusto), carga los datos en el SOL y escribe el informe de la semana.

**Reglas:** en el portal solo se LEE. No se toca nada (promociones, precios, horarios, menú, préstamos,
PeYa Wallet) y no se descargan archivos: todo se lee como texto de la pantalla. No se escriben contraseñas.
Si el portal o el panel piden iniciar sesión, la tarea se detiene y le avisa a Augusto.

## Qué semana

PedidosYa liquida cada semana (lunes a domingo) unos 8 días después. Por eso, cada lunes:

- **Semana del informe (S):** la que terminó hace 8 días (lunes de hace 2 semanas → domingo de hace 8 días).
  Ya tiene liquidación: el informe cuadra todo al peso.
- **Semana pasada (S+1):** se cargan ventas y operación del portal; en el informe va solo un adelanto en "Novedades".

## Pasos

Augusto autorizó que la tarea use el botón "Descargar estado de cuenta" de cada semana: el lector lo abre
dentro del navegador y no guarda nada en la compu.

1. **Navegador.** Claude in Chrome en la compu de la oficina (Windows, deviceId `7c6dc411-ccb1-4222-a507-64ef976b619a`).
   Pestaña nueva.
2. **Panel.** Abrir `https://sol-panel-lalenita.vercel.app/pedidosya` una vez (así Chrome tiene la clave del panel).
   Si pide usuario y contraseña, avisar a Augusto y terminar.
3. **Estado de cuenta de S** (todos los pedidos de los 6 locales, reclamos y reintegros). En
   `https://portal-app.pedidosya.com/finance-py/contracts/84486/account-statuses?page=1`:
   pegar el PASO 1 de `docs/pedidosya-lector-estado-de-cuenta.js`, apretar el botón "Descargar estado de cuenta"
   (ícono de documento) de la fila de S, pegar el PASO 2 y mandar el resultado al SOL con `enviar()` (abajo):
   `enviar({ tipo: "estado_de_cuenta", ...resultado })`. Controlar que la venta neta y la comisión del resultado
   (`controles`) sean iguales a la liquidación.
4. **Liquidación de S.** En la misma lista, "Ver detalle" de la semana S → `enviar({ tipo: "liquidacion", texto: document.querySelector('main').innerText })`.
5. **Operación por local** de S y S+1: `https://portal-app.pedidosya.com/reports?tab=ops&mode=page&from=<lunes>&to=<domingo>&prevFrom=<lunes-7>&prevTo=<domingo-7>`
   (esperar a que aparezcan los locales) → `enviar({ tipo: "operaciones", desde: "<lunes>", texto: document.querySelector('main').innerText })`.
6. **Adelanto de S+1:** `…/reports?tab=sales&…` de S+1 → `enviar({ tipo: "ventas", desde: "<lunes de S+1>", texto: … })`.
7. **Leer todo junto:** abrir `https://sol-panel-lalenita.vercel.app/api/pedidosya?semana=<lunes de S>` en la pestaña del
   panel y leer el JSON: liquidación, ventas y operación por local (con semana anterior y año anterior), cargos,
   cuadre con Maxirest y lo que el panel ya detectó para reclamar.
8. **Escribir el informe** de S y cargarlo: `enviar({ tipo: "informe", informe: { … } })` (ver abajo).
9. **Avisar a Augusto** con un resumen corto y el link a la sección.

`enviar()` se pega en la pestaña del portal (manda los datos al SOL con la clave que Chrome ya tiene):

```js
const enviar = (cuerpo) => fetch("https://sol-panel-lalenita.vercel.app/api/pedidosya", {
  method: "POST", credentials: "include", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(cuerpo),
}).then((r) => r.json());
```

Cada respuesta tiene que decir `"ok": true`. Si dice 401, Chrome no tiene la clave del panel: abrir el panel (paso 2).

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

- Chrome de la oficina cerrado o sin la extensión: no se puede leer el portal. Avisar a Augusto y terminar.
- El portal pide iniciar sesión: avisar a Augusto para que entre él; no escribir contraseñas.
- El panel responde 401: Augusto tiene que abrir el panel en Chrome una vez con su clave.
- Falta la liquidación de S: cargar lo demás, escribir el informe sin la parte de plata y decirlo.
