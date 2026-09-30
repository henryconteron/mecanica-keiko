import assert from "node:assert/strict";
import { correccionVerificada } from "../scripts/verificacion-manual-inventario.mjs";

const row = { codigo: "D831C", nombre: "Pastillas", marca: "Double Link", descripcion: "Texto anterior", cantidad: 5, precio: 20 };
const review = {
  codigo: "D831C",
  inventario_base: { nombre: "Pastillas", marca: "Double Link", descripcion: "Texto anterior" },
  descripcion_corta: "Cerámicas según empaque.", descripcion: "Referencia base D831; confirmar medidas.",
  compatibilidad: ["Toyota Yaris P1, según sistema de freno"], referencias: ["FMSI D831-7704"],
  fuentes: [{ url: "https://www.qytauto.com/d831.html" }], confianza: "Media",
  cantidad: 999, precio: 0, publicado: true
};
const correction = correccionVerificada(row, [review]);
assert.equal(correction.descripcion, review.descripcion);
assert.equal(correction.fuentes, review.fuentes[0].url);
for (const field of ["cantidad", "precio", "publicado", "codigo", "marca", "nombre"]) assert.equal(Object.hasOwn(correction, field), false);
assert.deepEqual(correccionVerificada({ ...row, descripcion: "Nueva descripción del usuario" }, [review]), {});
assert.deepEqual(correccionVerificada({ ...row, marca: "Otra marca" }, [review]), {});
assert.deepEqual(correccionVerificada({ ...row, codigo: "D832C" }, [review]), {});
assert.equal(correccionVerificada({ ...row, cantidad: 2, precio: 15 }, [review]).descripcion, review.descripcion);
assert.deepEqual(correccionVerificada(row, []), {});
assert.throws(() => correccionVerificada(row, [{ ...review, fuentes: [{ url: "javascript:alert(1)" }] }]), /fuentes válidas/);
assert.throws(() => correccionVerificada(row, [{ ...review, referencias: null }]), /inválida/);
console.log("Verificación manual: conserva correcciones, respeta nuevas ediciones y no modifica inventario ni publicación.");
