# DECISIONS.md

> Este documento explica **por qué** el sistema está construido así. Cada decisión
> incluye la alternativa que descarté y el motivo. Las decisiones que dejé fuera
> por tiempo están al final, marcadas como tales.

---

## Contexto y restricciones

Construí un sistema de ingesta y visualización de eventos. Esa restricción explica la mayoría de las decisiones de abajo. En la mayoría la opción elegida es la más simple que resuelve el problema y no la más escalable.

El sistema tiene 2 perfiles de carga muy distintos.

- **Escritura**: muchos eventos pequeños, llegando de forma concurrente donde lo que importa es aceptar rápido y no perder datos.
- **Lectura**: pocos usuarios mirando el dashboard, filtrando y paginando.

Esa asimetría guía el diseño del esquema de la API.

---

## 1. TypeScript en todo el stack

**Decisión:** TypeScript tanto en la API como en el frontend, con los tipos del evento definidos una sola vez y compartidos entre ambos.

**Por qué:**

- Con 72 horas, el costo de cambiar de contexto entre dos lenguajes es real. Un solo runtime, un solo gestor de paquetes, un solo conjunto de herramientas de test y lint.
- El contrato de la API (la forma del evento) está definido una única vez con Zod. Del mismo esquema salgo con el tipo de TypeScript y con la validación en runtime. Si cambio el esquema, el frontend deja de compilar. Eso es exactamente lo que quiero que pase.
- Es el lenguaje donde más rápido escribo código que entiendo. En una prueba donde voy a tener que defender cada línea en video, eso pesa más que la elegancia.

**Alternativa descartada — Go:**

Go es la mejor opción para un servicio de ingesta real: mejor manejo de concurrencia, y compila a un binario único, lo que simplifica muchísimo el deploy. Lo descarté porque mi nivel de Go me habría obligado a gastar tiempo aprendiendo en lugar de construyendo, y el cuello de botella de este proyecto no es el rendimiento de la API, es el tiempo disponible.

**Cuándo cambiaría de opinión:** si el volumen de ingesta creciera a un punto donde el runtime de Node fuera el límite, extraería solo el endpoint de ingesta a un servicio en Go y dejaría el resto igual. La API de lectura no necesita moverse.

---

## 2. PostgreSQL en lugar de una base de datos de series temporales

**Decisión:** PostgreSQL en RDS.

**Por qué:**

- Los datos son eventos con timestamp, pero las consultas que necesita el dashboard son relacionales normales: filtrar por nivel, buscar texto, paginar. Postgres hace todo eso bien.
- El campo `metadata` es `jsonb`, lo que me da la flexibilidad de un documento sin renunciar a los índices ni a las consultas estructuradas del resto de columnas.
- Es lo que el enunciado recomienda y lo que RDS soporta sin fricción.

**Alternativa descartada — ClickHouse o TimescaleDB:**

Serían mejores para agregaciones sobre cientos de millones de filas. A esta escala la ventaja es teórica y el costo operativo es inmediato. Postgres aguanta cómodamente el orden de magnitud de este proyecto con los índices correctos.

---

## 3. Dos timestamps por evento: `timestamp` y `received_at`

**Decisión:** cada evento guarda dos marcas de tiempo distintas.

- `timestamp` — cuándo **ocurrió** el evento. Lo envía el cliente.
- `received_at` — cuándo **llegó** al servidor. Lo pone la API, el cliente no puede tocarlo.

**Por qué:**

Esta es la decisión de la que estoy más convencido. Un cliente que estuvo sin conexión y hace buffer de sus eventos los va a enviar todos juntos media hora después. Si solo guardara la hora de llegada, el dashboard mostraría un pico inexistente y perdería la hora real del incidente. Si solo guardara la hora del cliente, un reloj mal configurado o un cliente malicioso podría insertar eventos en el futuro o en el pasado y romper el orden.

Con los dos campos:

- El **usuario** filtra por `timestamp` (rango de fechas), que es la verdad del dominio: quiere ver "los errores del martes", no "lo que llegó el martes".
- El **orden del feed y la paginación** usan `received_at`, que es monótono desde el punto de vista del servidor y por lo tanto seguro como cursor. El feed siempre se recorre en el mismo orden en que los eventos llegaron al servidor, incluso cuando el usuario está filtrando por la fecha en que ocurrieron. Si ordenara por `timestamp` en vez de `received_at`, el cursor dejaría de ser monótono en cuanto un cliente offline entregara un lote de eventos viejos: esas filas "viejas" aparecerían intercaladas en medio de páginas ya recorridas.

**Validación asociada:** si el `timestamp` del cliente viene con una desviación mayor a un margen razonable respecto al reloj del servidor, lo registro pero no rechazo el evento. Perder un evento es peor que guardarlo con una hora dudosa.

---

## 4. Paginación por cursor, no por offset

**Decisión:** `GET /events` pagina con un cursor opaco basado en `(received_at, id)`, no con `?page=2&limit=50`.

**Por qué:**

Con offset, en un sistema donde entran eventos constantemente, el usuario ve registros duplicados. Cuando pide la página 2, los eventos nuevos ya empujaron todo hacia abajo, y las filas que estaban al final de la página 1 reaparecen al principio de la página 2. Es un bug silencioso: nadie reporta "vi el mismo error dos veces", simplemente el dashboard deja de ser confiable.

El cursor apunta a una posición estable en el conjunto de datos. Además evita el problema de rendimiento de `OFFSET` alto, donde la base de datos tiene que descartar filas una por una antes de llegar a las que quieres.

El desempate por `id` es necesario porque dos eventos pueden compartir el mismo `received_at` con precisión de microsegundos. Sin él, un evento puede saltarse o repetirse justo en el borde de la página.

**Costo aceptado:** no puedo mostrar "página 5 de 20" ni saltar a una página arbitraria. Para un feed de eventos donde el usuario filtra y hace scroll, no es una pérdida real.

---

## 5. Polling en lugar de WebSockets

**Decisión:** el frontend consulta la API cada 5 segundos, y pausa el polling cuando la pestaña no está visible.

**Por qué:**

- El requisito es que el usuario vea eventos nuevos sin recargar. Un intervalo de 5 segundos cumple eso de sobra para un dashboard de monitoreo que una persona mira, no una máquina.
- Un WebSocket introduce estado en el servidor: reconexión, heartbeats, y el problema de qué pasa con los mensajes perdidos durante una desconexión. Ninguno de esos problemas existe con polling, porque cada request es independiente y el cursor le dice al servidor exactamente desde dónde continuar.
- La API se mantiene sin estado, lo que significa que puedo escalar horizontalmente poniendo instancias detrás de un balanceador sin ninguna consideración especial.

**La pausa en background importa:** sin ella, veinte pestañas olvidadas generan tráfico constante contra la base de datos sin que nadie esté mirando.

**Cuándo cambiaría de opinión:** si el requisito pasara de "el dashboard se actualiza" a "alertas con latencia sub-segundo", polling deja de servir y toca WebSocket o SSE. SSE sería mi siguiente paso antes que WebSocket, porque el flujo aquí es unidireccional del servidor al cliente.

---

## 6. Validación con Zod y un formato de error único

**Decisión:** toda entrada pasa por un esquema Zod, y todos los errores de la API salen con la misma forma.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "El campo 'level' no es válido",
    "details": [{ "field": "level", "issue": "debe ser uno de: debug, info, warning, error, fatal" }]
  }
}
```

**Por qué:**

- Un cliente que consume esta API necesita poder distinguir errores programáticamente. Un `code` estable lo permite; un mensaje en prosa que puede cambiar, no.
- El mismo esquema Zod genera el tipo de TypeScript, así que la validación en runtime y los tipos en compilación no pueden divergir.
- Nunca devuelvo el error interno crudo al cliente. El detalle completo va al log con un identificador; el cliente recibe ese identificador y un mensaje genérico. Filtrar mensajes de error de la base de datos hacia afuera es una fuga de información sobre la estructura interna.

---

## 7. Deploy en Lightsail + RDS + S3/CloudFront

**Decisión:** la API corre en una instancia de Lightsail, la base de datos en RDS PostgreSQL en red privada, y el frontend es estático en S3 detrás de CloudFront.

**Por qué:**

- Lightsail me da una IP pública y un servidor accesible sin tener que diseñar una VPC, subredes y un balanceador. En una prueba de 72 horas, el tiempo que ECS me habría costado en configuración vale más que la capacidad de autoescalado que me da.
- El frontend es estático: no hay razón para servirlo desde un servidor. S3 más CloudFront cuesta prácticamente nada y da CDN y HTTPS.
- **RDS no es públicamente accesible.** Su security group solo acepta conexiones desde el security group de la instancia de la API, en el puerto 5432. Una base de datos con IP pública es el error de configuración más común y más caro de esta clase de proyecto.
- **La API también queda detrás de CloudFront**, con la instancia de Lightsail como origen personalizado. El frontend se sirve en HTTPS; si la API respondiera solo en HTTP sobre la IP de Lightsail, el navegador bloquearía las peticiones del dashboard por contenido mixto en cuanto intentara llamarla, aunque `curl` contra esa misma URL funcione perfectamente. Poner una segunda distribución de CloudFront delante evita instalar y renovar un certificado en la instancia: el dominio `*.cloudfront.net` ya sirve en HTTPS sin dominio propio ni ACM. El tramo CloudFront → Lightsail queda en HTTP dentro de la red de AWS; el tramo público, que es el que importa, es HTTPS de punta a punta.

**Alternativa descartada — Lambda:**

Encaja bien con una carga de ingesta irregular, pero los cold starts contra RDS son un problema conocido: cada instancia nueva abre su propia conexión y agota el pool de la base de datos. Resolverlo bien requiere RDS Proxy, que es otra pieza más que configurar.

---

## 8. Rate limiting por IP en el endpoint de ingesta

**Decisión:** límite por ventana deslizante sobre `POST /events`, en memoria.

**Por qué:**

Un endpoint de ingesta público y sin autenticación es, sin protección, una forma de llenarle a alguien la base de datos. El límite es la mitigación mínima razonable.

**Limitación que reconozco:** el contador vive en la memoria del proceso. Con varias instancias, cada una lleva su propia cuenta y el límite efectivo se multiplica. La solución correcta es un contador compartido en Redis, o mover el rate limiting al borde. Con una sola instancia el enfoque actual funciona; lo dejo documentado porque es lo primero que rompe al escalar.

---

## 9. Autenticación básica con clave compartida

**Decisión:** todo endpoint salvo `GET /health` exige la cabecera `Authorization: Bearer <API_KEY>`. `API_KEY` es un único secreto generado una vez y guardado como variable de entorno, no una tabla de usuarios ni de claves por cliente. El frontend la pide una sola vez por una pantalla simple y la guarda en `localStorage` para adjuntarla en cada request, incluido el polling.

**Por qué:**

- El enunciado pide "autenticación básica", no un sistema de cuentas. En esta prueba hay un solo evaluador consumiendo el dashboard y un solo emisor de eventos: una clave compartida resuelve el problema real, que es que la API y el dashboard no queden abiertos a cualquiera que encuentre la URL de CloudFront.
- La comparo con `crypto.timingSafeEqual`, nunca con `===`. Una comparación de strings normal corta en el primer carácter distinto, lo que filtra por temporización cuánto de la clave acertó quien la está probando. Evitarlo no cuesta tiempo adicional, así que no hay razón para no hacerlo bien.
- No creo una tabla de claves con hash bcrypt. Con una sola clave, sin necesidad de revocar una clave individual sin afectar a las demás, esa tabla es una capa que no se usa.

**Alternativa descartada — login de usuario con sesión (JWT o cookies):**

Es lo que construiría para un producto real con varios usuarios y permisos distintos entre ellos. Aquí no hay ni lo uno ni lo otro, así que un formulario de usuario/contraseña con manejo de sesión es complejidad sin un problema que resolver.

**Cuándo cambiaría de opinión:** si el sistema necesitara identificar de qué cliente viene cada evento (multi-tenant), pasaría a una tabla de claves por proyecto, cada una con su propio hash. Con un solo consumidor, esa tabla no se justifica todavía.

---

## 10. Estrategia de tests

**Decisión:** cobertura concentrada en la lógica que puede fallar de forma silenciosa, no repartida uniformemente.

Lo que sí está testeado:

- **Validación de entrada**, con foco en los casos inválidos: campos faltantes, nivel inexistente, timestamp malformado, metadata con tipos raros. El happy path es el caso menos interesante.
- **Paginación por cursor**, incluyendo el caso del borde donde dos eventos comparten `received_at`. Es el bug que el desempate por `id` existe para prevenir.
- **Composición de filtros**, verificando que combinar nivel, rango de fechas y búsqueda produce la consulta correcta.
- **Manejo de errores**, comprobando que un fallo interno no filtra detalle al cliente.
- **Autenticación**, cubriendo los tres casos: sin cabecera, con clave incorrecta y con la clave correcta; y confirmando que `GET /health` es la única ruta que no la exige.

Lo que deliberadamente no testeé: código de configuración, wiring de rutas y componentes de presentación sin lógica. Subirían el porcentaje sin aumentar la confianza en el sistema.

---

## 11. Logging estructurado en JSON

**Decisión:** logs en JSON a stdout y a archivo, con un identificador de request que atraviesa toda la petición.

**Por qué:**

Un log en prosa es legible por una persona y por nadie más. En JSON puedo filtrar por nivel, por ruta o por identificador de request sin escribir expresiones regulares. Cuando el sistema esté en CloudWatch, esos campos son directamente consultables.

El identificador de request es lo que permite ir del error que vio el usuario a la traza completa en el servidor.

---

## Lo que dejé fuera a propósito

Estas no son cosas que se me olvidaron. Son decisiones de no hacerlas ahora:

**Agrupación de eventos por huella.** Es la característica que hace útil a Sentry de verdad: colapsar diez mil ocurrencias del mismo error en un grupo con contador. Requiere una tabla de grupos, una función de huella estable y una decisión sobre qué hace que dos errores sean "el mismo". Es un día de trabajo bien hecho y no cabía.

**Retención y archivado.** Una tabla de eventos crece sin límite. En producción haría falta particionar por tiempo y una política de borrado o de movimiento a almacenamiento frío. Sin eso, la tabla eventualmente degrada las consultas.

**Tests E2E.** Los tests unitarios y de integración cubren la lógica; el recorrido completo del navegador lo verifiqué a mano. Con más tiempo, un solo test E2E del flujo crítico (enviar evento, verlo aparecer) valdría más que veinte tests superficiales.

**Integración con Sentry o CloudWatch.** El enunciado la lista como bonus dentro de observabilidad. El logging estructurado en JSON (sección 11) ya da la mayor parte del valor práctico — filtrar por `request_id`, nivel o ruta — sin depender de un servicio externo ni de credenciales adicionales que gestionar en 72 horas. Es la primera integración que añadiría con más tiempo.

**WebSocket para tiempo real.** Ya está razonado en la sección 5: polling con pausa en background cumple el requisito real de este dashboard sin el estado adicional de mantener conexiones abiertas y reconectarlas.

---

## Uso de IA

Fui explícito sobre esto porque el enunciado lo pide.

**Dónde la usé:** scaffolding inicial del proyecto, configuración de la GitHub Action, depuración de la conexión a RDS y los security groups, y consulta de detalles de API que habría buscado en documentación de todos modos.

**Dónde no:** el diseño del esquema, la decisión de los dos timestamps, la paginación por cursor y la estrategia de tests son razonamiento propio. Son también las partes que puedo explicar línea por línea, que es la prueba real de si algo es tuyo.
