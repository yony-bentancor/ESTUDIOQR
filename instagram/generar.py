#!/usr/bin/env python3
"""
Generador de imágenes para el Instagram de Estudio QR (@estudio.qr).

Uso:
    python3 instagram/generar.py <spec.json> <salida.jpg>

El spec.json tiene un campo "plantilla" y los textos. Plantillas:

  "proyecto"  -> muestra un sitio desarrollado.
      {"plantilla":"proyecto","etiqueta":"SITIO WEB","titulo":"Dulce 29",
       "subtitulo":"Tienda online con panel de administración",
       "puntos":["Catálogo y pedidos","Panel para el dueño","Adaptado a celular"],
       "captura":"instagram/capturas/dulce29.png",   (opcional: si existe, va en un marco de navegador)
       "url":"dulce29"}                              (texto que aparece en la barra del navegador)

  "consejo"   -> idea útil para negocios (atrae clientes potenciales).
      {"plantilla":"consejo","etiqueta":"CONSEJO","titulo":"¿Tu negocio aparece en Google?",
       "puntos":["...","...","..."],"cierre":"Te ayudamos a hacerlo."}

  "oferta"    -> llamado directo a la acción.
      {"plantilla":"oferta","etiqueta":"ESTUDIO QR","titulo":"Tu negocio merece una web propia.",
       "destacado":"web propia.", "puntos":["..."],"cierre":"Escribinos por WhatsApp"}

Formato: 1080x1350 (vertical 4:5), estilo del sitio: fondo crema, negro y dorado.
"""
import json, os, random, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

AQUI = os.path.dirname(os.path.abspath(__file__))
FUENTES = os.path.join(AQUI, 'fonts')
W, H = 1080, 1350
INK = (8, 8, 8); GOLD = (181, 137, 85); BG = (251, 250, 247)
MUTED = (154, 150, 144); LINE = (207, 202, 195); TEXT = (40, 40, 40)
M = 80  # margen


def fuente(peso, tam):
    return ImageFont.truetype(os.path.join(FUENTES, f'Inter-{peso}.otf'), tam)


def espaciado(d, x, y, t, f, color, sp):
    for ch in t:
        d.text((x, y), ch, font=f, fill=color)
        x += d.textlength(ch, font=f) + sp
    return x


def ancho_espaciado(d, t, f, sp):
    return sum(d.textlength(ch, font=f) + sp for ch in t) - sp


def envolver(d, texto, f, ancho):
    lineas, actual = [], ''
    for palabra in texto.split():
        prueba = (actual + ' ' + palabra).strip()
        if d.textlength(prueba, font=f) <= ancho:
            actual = prueba
        else:
            if actual:
                lineas.append(actual)
            actual = palabra
    if actual:
        lineas.append(actual)
    return lineas


def titulo_ajustado(d, texto, ancho, max_lineas, tam_max=118, tam_min=64):
    tam = tam_max
    while tam >= tam_min:
        f = fuente('ExtraBold', tam)
        lineas = envolver(d, texto, f, ancho)
        if len(lineas) <= max_lineas:
            return f, lineas, tam
        tam -= 4
    f = fuente('ExtraBold', tam_min)
    return f, envolver(d, texto, f, ancho), tam_min


def motivo_qr(d, x, y, c, n, semilla=3, fondo=BG):
    random.seed(semilla)

    def finder(px, py):
        d.rectangle((px, py, px + 7 * c - 1, py + 7 * c - 1), fill=INK)
        d.rectangle((px + c, py + c, px + 6 * c - 1, py + 6 * c - 1), fill=fondo)
        d.rectangle((px + 2 * c, py + 2 * c, px + 5 * c - 1, py + 5 * c - 1), fill=GOLD)
    for i in range(n):
        for j in range(n):
            if (i < 8 and j < 8) or (i < 8 and j >= n - 8) or (i >= n - 8 and j < 8):
                continue
            if random.random() < .5:
                d.rectangle((x + i * c, y + j * c, x + (i + 1) * c - 2, y + (j + 1) * c - 2),
                            fill=INK if random.random() < .82 else GOLD)
    finder(x, y); finder(x + (n - 7) * c, y); finder(x, y + (n - 7) * c)


def marco(d):
    x = espaciado(d, M, 80, 'ESTUDIO', fuente('ExtraBold', 34), INK, 10)
    d.text((x + 8, 74), 'QR', font=fuente('SemiBold', 40), fill=GOLD)
    d.line((M, 150, W - M, 150), fill=LINE, width=2)
    d.line((M, H - 110, W - M, H - 110), fill=LINE, width=2)
    d.text((M, H - 85), 'estudioqr.com.uy', font=fuente('SemiBold', 30), fill=INK)
    f = fuente('Medium', 24); t = 'MONTEVIDEO · URUGUAY'
    espaciado(d, W - M - ancho_espaciado(d, t, f, 4), H - 80, t, f, MUTED, 4)


def etiqueta(d, y, texto):
    espaciado(d, M, y, texto.upper(), fuente('Medium', 24), MUTED, 5)


def puntos(d, y, items, tam=38, ancho=W - 2 * M - 40, paso=None):
    f = fuente('Medium', tam)
    paso = paso or int(tam * 1.32)
    for it in items:
        lineas = envolver(d, it, f, ancho)
        d.rectangle((M, y + tam * .37, M + 14, y + tam * .37 + 14), fill=GOLD)
        for k, l in enumerate(lineas):
            d.text((M + 40, y + k * paso), l, font=f, fill=TEXT)
        y += paso * len(lineas) + int(tam * .45)
    return y


def dibujar_titulo(d, y, texto, destacado=None, max_lineas=3, ancho=W - 2 * M):
    f, lineas, tam = titulo_ajustado(d, texto, ancho, max_lineas)
    alto = int(tam * 1.1)
    dest = (destacado or '').strip().lower()
    for k, l in enumerate(lineas):
        color = GOLD if (dest and (l.lower() in dest or dest in l.lower()) and k == len(lineas) - 1) or (not dest and k == len(lineas) - 1 and len(lineas) > 1) else INK
        d.text((M - 4, y + k * alto), l, font=f, fill=color)
    return y + alto * len(lineas)


def navegador(im, caja, captura, url):
    """Dibuja una ventana de navegador con la captura (o un placeholder) dentro de caja=(x0,y0,x1,y1)."""
    x0, y0, x1, y1 = caja
    sombra = Image.new('RGBA', im.size, (0, 0, 0, 0))
    ImageDraw.Draw(sombra).rounded_rectangle((x0 + 6, y0 + 16, x1 + 6, y1 + 16), 22, fill=(0, 0, 0, 60))
    sombra = sombra.filter(ImageFilter.GaussianBlur(18))
    im.paste(sombra, (0, 0), sombra)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle(caja, 22, fill=(255, 255, 255), outline=LINE, width=2)
    barra = 64
    d.rounded_rectangle((x0, y0, x1, y0 + barra), 22, fill=(238, 235, 230))
    d.rectangle((x0, y0 + barra - 22, x1, y0 + barra), fill=(238, 235, 230))
    for i, col in enumerate([(232, 107, 94), (240, 190, 80), (98, 190, 110)]):
        d.ellipse((x0 + 26 + i * 30, y0 + 24, x0 + 42 + i * 30, y0 + 40), fill=col)
    d.rounded_rectangle((x0 + 140, y0 + 16, x1 - 30, y0 + 48), 16, fill=(255, 255, 255))
    d.text((x0 + 162, y0 + 21), url, font=fuente('Medium', 20), fill=MUTED)
    area = (x0 + 2, y0 + barra, x1 - 2, y1 - 2)
    aw, ah = area[2] - area[0], area[3] - area[1]
    if captura and os.path.exists(captura):
        cap = Image.open(captura).convert('RGB')
        esc = max(aw / cap.width, ah / cap.height)
        cap = cap.resize((int(cap.width * esc) + 1, int(cap.height * esc) + 1), Image.LANCZOS)
        cx = (cap.width - aw) // 2
        cap = cap.crop((cx, 0, cx + aw, ah))
        mascara = Image.new('L', (aw, ah), 0)
        ImageDraw.Draw(mascara).rounded_rectangle((0, -30, aw, ah), 20, fill=255)
        lienzo = Image.new('RGB', (aw, ah), (255, 255, 255)); lienzo.paste(cap, (0, 0))
        im.paste(lienzo, (area[0], area[1]), mascara)
    else:
        # Sin captura: maqueta abstracta del sitio.
        d.rectangle((area[0] + 30, area[1] + 30, area[0] + 230, area[1] + 52), fill=INK)
        for i in range(4):
            d.rectangle((area[2] - 120 - i * 110, area[1] + 34, area[2] - 50 - i * 110, area[1] + 48), fill=LINE)
        d.rectangle((area[0] + 30, area[1] + 90, area[2] - 30, area[1] + 90 + ah * .38), fill=(244, 240, 233))
        motivo_qr(d, int(area[2] - 60 - 21 * 7), int(area[1] + 90 + (ah * .38 - 21 * 7) / 2), 7, 21, 11, (244, 240, 233))
        d.rectangle((area[0] + 60, area[1] + 130, area[0] + 360, area[1] + 160), fill=INK)
        d.rectangle((area[0] + 60, area[1] + 175, area[0] + 300, area[1] + 205), fill=GOLD)
        yy = area[1] + 120 + ah * .38
        cw = (aw - 60 - 40) / 3
        for i in range(3):
            cx = area[0] + 30 + i * (cw + 20)
            d.rounded_rectangle((cx, yy, cx + cw, area[3] - 30), 10, outline=LINE, width=2)
            d.rectangle((cx + 20, yy + 24, cx + cw - 20, yy + 34), fill=LINE)


def plantilla_proyecto(s):
    im = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(im)
    marco(d)
    etiqueta(d, 200, s.get('etiqueta', 'PROYECTO'))
    f = fuente('ExtraBold', 92)
    d.text((M - 4, 240), s['titulo'], font=f, fill=INK)
    sub = envolver(d, s.get('subtitulo', ''), fuente('Medium', 34), W - 2 * M)
    for k, l in enumerate(sub[:2]):
        d.text((M, 352 + k * 44), l, font=fuente('Medium', 34), fill=GOLD)
    top = 352 + 44 * len(sub[:2]) + 36
    navegador(im, (M, top, W - M, top + 520), s.get('captura'), s.get('url', 'estudioqr.com.uy'))
    d = ImageDraw.Draw(im)
    puntos(d, top + 520 + 50, s.get('puntos', [])[:3], tam=32)
    return im


def plantilla_consejo(s, oferta=False):
    im = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(im)
    marco(d)
    etiqueta(d, 220, s.get('etiqueta', 'CONSEJO'))
    y = dibujar_titulo(d, 270, s['titulo'], s.get('destacado'), max_lineas=4, ancho=W - 2 * M)
    d.line((M, y + 30, M + 140, y + 30), fill=GOLD, width=4)
    y = puntos(d, y + 80, s.get('puntos', [])[:4], tam=36, ancho=W - 2 * M - 300)
    if s.get('cierre'):
        f = fuente('Bold', 36)
        tw = d.textlength(s['cierre'], font=f)
        yb = max(y + 30, H - 110 - 150)
        d.rounded_rectangle((M, yb, M + tw + 70, yb + 78), 39, fill=INK)
        d.text((M + 35, yb + 18), s['cierre'], font=f, fill=BG)
    motivo_qr(d, W - M - 21 * 11, H - 110 - 40 - 21 * 11 - (110 if s.get('cierre') else 0), 11, 21, hash(s['titulo']) % 100)
    return im


def generar(spec, salida):
    p = spec.get('plantilla', 'consejo')
    if p == 'proyecto':
        im = plantilla_proyecto(spec)
    elif p == 'oferta':
        im = plantilla_consejo(spec, oferta=True)
    else:
        im = plantilla_consejo(spec)
    os.makedirs(os.path.dirname(os.path.abspath(salida)), exist_ok=True)
    im.save(salida, quality=92)
    return salida


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print(__doc__); sys.exit(1)
    with open(sys.argv[1], encoding='utf-8') as fh:
        generar(json.load(fh), sys.argv[2])
    print('OK', sys.argv[2])
