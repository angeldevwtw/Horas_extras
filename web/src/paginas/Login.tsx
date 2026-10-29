import { useState, type FormEvent } from 'react';
import { Aviso, Boton, Campo, claseEntrada } from '../componentes/ui';
import { mensajeDeError, supabase } from '../lib/supabase';

export function Login() {
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function pedirCodigo(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError('');
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase() });
    setEnviando(false);
    if (error) setError(mensajeDeError(error));
    else setCodigoEnviado(true);
  }

  async function verificarCodigo(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError('');
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: codigo.trim(),
      type: 'email',
    });
    setEnviando(false);
    if (error) setError('El código no es válido o ya venció. Pida uno nuevo.');
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-borde bg-blanco p-6">
        <h1 className="text-xl font-semibold text-primario">Horas extras</h1>
        <p className="mb-6 text-sm text-texto-suave">Ingrese con su correo corporativo.</p>

        {!codigoEnviado ? (
          <form onSubmit={pedirCodigo} className="flex flex-col gap-4">
            <Campo etiqueta="Correo" htmlFor="email">
              <input id="email" type="email" required autoComplete="email" value={email}
                onChange={(e) => setEmail(e.target.value)} className={claseEntrada} />
            </Campo>
            <Boton type="submit" disabled={enviando || !email}>
              {enviando ? 'Enviando…' : 'Enviarme un código'}
            </Boton>
          </form>
        ) : (
          <form onSubmit={verificarCodigo} className="flex flex-col gap-4">
            <p className="text-sm">Enviamos un código a <strong>{email}</strong>.</p>
            <Campo etiqueta="Código" htmlFor="codigo">
              <input id="codigo" inputMode="numeric" autoComplete="one-time-code" required
                value={codigo} onChange={(e) => setCodigo(e.target.value)}
                className={`${claseEntrada} tracking-widest`} />
            </Campo>
            <Boton type="submit" disabled={enviando || codigo.trim().length < 6}>
              {enviando ? 'Verificando…' : 'Entrar'}
            </Boton>
            <Boton type="button" variante="borde"
              onClick={() => { setCodigoEnviado(false); setCodigo(''); setError(''); }}>
              Usar otro correo
            </Boton>
          </form>
        )}

        {error && <div className="mt-4"><Aviso tipo="error">{error}</Aviso></div>}
      </div>
    </main>
  );
}
