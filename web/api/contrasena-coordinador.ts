// El director asigna la contraseña de un coordinador de su línea. Corre en Vercel, no en el
// navegador: aquí vive la service_role. Quién puede lo decide la base, con la sesión del director
// (public.autorizar_contrasena_coordinador); esta función solo crea o cambia la cuenta.
import { createClient } from '@supabase/supabase-js';

const URL_SUPABASE = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const CLAVE_PUBLICA = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const CLAVE_SERVICIO = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const MINIMO = 8;

const responder = (estado: number, cuerpo: object) => Response.json(cuerpo, { status: estado });
const fallo = (estado: number, mensaje: string) => responder(estado, { ok: false, mensaje });

export async function POST(request: Request): Promise<Response> {
  if (!URL_SUPABASE || !CLAVE_PUBLICA || !CLAVE_SERVICIO) {
    console.error('Faltan SUPABASE_URL, SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY en Vercel.');
    return fallo(500, 'El servidor no está configurado para asignar contraseñas.');
  }

  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return fallo(401, 'Inicie sesión de nuevo.');

  const cuerpo = await request.json().catch(() => null);
  const id: unknown = cuerpo?.id;
  const contrasena: unknown = cuerpo?.contrasena;
  if (typeof id !== 'string' || typeof contrasena !== 'string') return fallo(400, 'Solicitud inválida.');
  if (contrasena.length < MINIMO) return fallo(400, `La contraseña debe tener al menos ${MINIMO} caracteres.`);

  const comoDirector = createClient(URL_SUPABASE, CLAVE_PUBLICA, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: permiso, error: errorPermiso } = await comoDirector.rpc('autorizar_contrasena_coordinador', { p_id: id });
  if (errorPermiso) {
    const sinPermiso = errorPermiso.code === '42501' || errorPermiso.details === 'HE_SIN_PERMISO';
    return fallo(sinPermiso ? 403 : 500, sinPermiso ? errorPermiso.message : 'No se pudo revisar el permiso.');
  }
  if (!permiso.ok) return fallo(400, permiso.mensaje);

  const admin = createClient(URL_SUPABASE, CLAVE_SERVICIO, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const usuarioId: string | null = permiso.usuario_id;
  const { error } = usuarioId
    ? await admin.auth.admin.updateUserById(usuarioId, { password: contrasena, email_confirm: true })
    : await admin.auth.admin.createUser({ email: permiso.correo, password: contrasena, email_confirm: true });
  if (error) {
    console.error('Supabase Auth rechazó la contraseña:', error.message);
    return fallo(400, error.message);
  }

  if (usuarioId) {
    const { error: errorSesiones } = await admin.rpc('cerrar_sesiones', { p_usuario: usuarioId });
    if (errorSesiones) console.error('No se cerraron las sesiones:', errorSesiones.message);
  }
  return responder(200, { ok: true });
}
