-- Se borran los registros y colegas de prueba para empezar a usar la aplicación con la base
-- limpia; los códigos vuelven a empezar en HE-00001. Configuración, festivos y clave de
-- descarga se conservan. truncate no dispara el bloqueo de borrado, que es por fila.
truncate public.registros, public.colegas, privado.intentos_descarga restart identity;
