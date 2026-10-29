-- Se borran los registros y colegas de prueba antes de empezar a usar la aplicación; los
-- códigos vuelven a empezar en HE-00001. Configuración, festivos y clave se conservan.
-- truncate no dispara el bloqueo de borrado, que es por fila.
truncate public.registros, public.colegas, privado.intentos_descarga restart identity;
