import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  // La integración de Supabase en Vercel entrega SUPABASE_URL y SUPABASE_ANON_KEY, sin el prefijo
  // VITE_ que Vite exige para pasarlas al navegador. Se pasan solo estas dos, que son públicas.
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || env.SUPABASE_URL),
      'import.meta.env.VITE_SUPABASE_ANON_KEY':
        JSON.stringify(env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY),
    },
    test: { environment: 'node', include: ['tests/**/*.test.ts'] },
  };
});
