# Instagram @estudio.qr

Contenido automático para Instagram, publicado vía Metricool (marca `estudio.qr`, blogId 7542656).
Esta carpeta no forma parte del sitio: `.slugignore` la excluye del deploy de Heroku.

- `plan.md`: temas, reglas y registro de lo publicado.
- `generar.py`: genera la imagen (1080×1350) desde un JSON. Ver ayuda dentro del archivo.
- `posts/`: imágenes publicadas (`AAAA-MM-DD-slug.jpg`). Metricool las toma desde
  `https://raw.githubusercontent.com/yony-bentancor/ESTUDIOQR/main/instagram/posts/<archivo>`.
- `capturas/`: capturas de pantalla de los sitios (`<slug>.png`, idealmente 1440 px de ancho).
  Si existe la del proyecto, el post la muestra dentro de un navegador.
