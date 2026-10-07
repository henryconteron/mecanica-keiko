import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import '../assets/pagina-modelo.js';
const model = globalThis.KEIKO_PAGE_MODEL;
const content = fields => ({ version: 1, fields });

test('el esquema no permite campos arbitrarios ni estructuras de código', () => {
  assert.deepEqual(model.validate(content({})), content({}));
  for (const invalid of [null, {}, { version: 2, fields: {} }, { version: 1, fields: [], otro: true }, content({ script: 'alert(1)' }), content({ nombre: { html: 'x' } }), content({ nombre: '' }), content({ portadaTitulo: 'x'.repeat(101) })]) assert.throws(() => model.validate(invalid));
  assert.deepEqual(model.validate(content({ portadaTitulo: '<script>alert(1)</script>' })), content({ portadaTitulo: '<script>alert(1)</script>' })); // Se representa con textContent, nunca HTML.
});
test('imágenes: solo archivos del sitio o referencias privadas seguras', () => {
  for (const value of ['javascript:alert(1)', 'data:image/svg+xml,a', 'https://externo.com/foto.jpg', 'assets/../secret.png', 'media:../../x.jpg', 'assets/a.svg']) assert.throws(() => model.validate(content({ logo: value })));
  for (const value of ['assets/marca/logo/logo.png', 'media:12345678-1234-1234-1234-123456789012.webp', '']) assert.doesNotThrow(() => model.validate(content({ logo: value })));
});

test('galerías opcionales: seis fotos del local y seis por servicio, sin imágenes inventadas', () => {
  assert.equal(model.fields.filter(field => /^localFoto/.test(field.key)).length, 6);
  assert.equal(model.fields.filter(field => /^servicio\dFoto/.test(field.key)).length, 30);
  assert.doesNotThrow(() => model.validate(content({localFoto0:'',servicio0Foto0:'media:12345678-1234-1234-1234-123456789012.jpg'})));
  assert.throws(() => model.validate(content({localFoto6:'assets/foto.jpg'})));
  assert.throws(() => model.validate(content({localFoto0:'https://externo.test/foto.jpg'})));
});
test('validación de contactos, coordenadas, horarios y colores', () => {
  for (const fields of [{ whatsapp: '098 938' }, { facebook: 'https://facebook.com.evil.com/' }, { facebook: 'https://u:p@facebook.com/' }, { latitud: '91' }, { longitud: 'NaN' }, { semanaAbre: '25:00' }, { semanaAbre: '17:00', semanaCierra: '08:00' }, { sabadoAbierto: 'yes' }, { colorRojo: 'red;display:none' }]) assert.throws(() => model.validate(content(fields)));
  assert.doesNotThrow(() => model.validate(content({ whatsapp: '593989381059', facebook: 'https://www.facebook.com/profile.php?id=123', latitud: '-0.9', longitud: '-77.8', semanaAbre: '09:00', colorRojo: '#123456' })));
});
test('horario automático usa exactamente la configuración editada', () => {
  const data = content({ semanaAbre: '09:00', semanaCierra: '16:00', sabadoAbierto: 'false', domingoAbierto: 'true' });
  assert.equal(model.isOpen(data, 'Mon', 539), false);
  assert.equal(model.isOpen(data, 'Mon', 540), true);
  assert.equal(model.isOpen(data, 'Fri', 960), false);
  assert.equal(model.isOpen(data, 'Sat', 600), false);
  assert.equal(model.isOpen(data, 'Sun', 600), true);
});
test('el esquema SQL mantiene la misma lista y límites que el editor', async () => {
  const sql = await readFile(new URL('../supabase/pagina-web.sql', import.meta.url), 'utf8');
  const spec = JSON.parse(sql.match(/v_spec constant jsonb := '([^']+)'/)[1]);
  assert.deepEqual(spec, Object.fromEntries(model.fields.map(field => [field.key, { type: field.type, max: field.type === 'image' ? 350 : field.max || 180, required: !!field.required }])));
  assert.match(sql, /revoke all on public\.pagina_publica, public\.pagina_borrador, public\.pagina_historial from anon, authenticated/);
  assert.match(sql, /m->>'method' = 'password'/);
  assert.match(sql, /where id = 1 and revision = p_revision/);
  assert.match(sql, /set search_path = ''/);
});
