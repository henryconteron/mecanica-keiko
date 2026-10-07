window.KEIKO_CONFIG = {
  supabaseUrl: "https://ktjzaockvsdlqshgqrmc.supabase.co",
  supabaseAnonKey: "sb_publishable_tkEEz6Ox2dmkTM5nolx3dw_NSIhfZZk"
};
// Asociación errónea confirmada visualmente. Se conserva el original para revisión,
// pero nunca se presenta como una fotografía de otro código. Una foto nueva no se bloquea.
window.KEIKO_PHOTOS = {
  approved(paths = []) { return paths.filter(path => path !== 'dcpr7e/1790025256071-01.png'); },
  notice(paths = []) { return paths.includes('dcpr7e/1790025256071-01.png') ? 'Foto pendiente de corregir: la etiqueta muestra BKR5E-11, no DCPR7E. Sube una foto real del código correcto; el original se conserva.' : ''; }
};
