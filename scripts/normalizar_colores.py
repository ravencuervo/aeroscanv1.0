"""
Normaliza los colores del frontend de AeroScan a la paleta oficial.

Reemplaza los colores sueltos (celestes, cianes, grises azulados y variantes de
verde, ámbar y rojo) por los de la paleta definida en frontend/src/index.css:

  Marca (estructura) : #290854 #401d6b #583383 #6f489a #865db1 + blanco
  Acento interactivo : #ab85d9   (texto suave: #d5c4ec, texto tenue: #b8a2d4)
  Estado correcto    : #34d399
  Advertencia        : #fbbf24
  Error / crítico    : #f87171

Uso (desde la raíz del repositorio):
  python scripts/normalizar_colores.py frontend/src/components/MiVista.tsx frontend/src/components/MiVista.css
  python scripts/normalizar_colores.py --revisar frontend/src/components/*.tsx   (solo muestra qué cambiaría)
"""
import re
import sys
from pathlib import Path

HEX = {
    # celestes y cianes -> acento lila
    "#38bdf8": "#ab85d9", "#06b6d4": "#ab85d9", "#0284c7": "#ab85d9", "#0891b2": "#ab85d9",
    "#0369a1": "#ab85d9", "#a855f7": "#ab85d9", "#ec4899": "#ab85d9", "#b388eb": "#ab85d9",
    "#a879e6": "#ab85d9", "#9d6ad9": "#ab85d9",
    # textos claros fuera de paleta -> lila suave
    "#7dd3fc": "#d5c4ec", "#e0c7ff": "#d5c4ec", "#d7bbfb": "#d5c4ec", "#c49cf5": "#d5c4ec",
    # verdes -> estado correcto
    "#10b981": "#34d399", "#6ee7b7": "#34d399",
    # ámbar -> advertencia
    "#f59e0b": "#fbbf24", "#fde68a": "#fbbf24", "#fcd34d": "#fbbf24", "#d97706": "#fbbf24",
    # rojos -> error
    "#ef4444": "#f87171", "#fca5a5": "#f87171", "#f43f5e": "#f87171", "#b91c1c": "#f87171",
    "#ffccd5": "#f87171", "#fee2e2": "#f87171",
    # grises azulados -> neutros de la paleta
    "#94a3b8": "#b8a2d4", "#64748b": "#b8a2d4", "#9c80bd": "#b8a2d4",
    "#e2e8f0": "#ffffff", "#f1f5f9": "#ffffff",
    # fondos oscuros sueltos -> fondo profundo de la paleta
    "#1e053e": "#1f0640", "#230b42": "#1f0640", "#1b0933": "#1f0640", "#1a0826": "#1f0640",
    "#140228": "#1f0640", "#130924": "#1f0640", "#130526": "#1f0640", "#0a0518": "#1f0640",
    "#02031a": "#1f0640", "#3d1b64": "#401d6b", "#6b4f8c": "#6f489a",
}

RGB = {
    (56, 189, 248): (171, 133, 217), (6, 182, 212): (171, 133, 217), (2, 132, 199): (171, 133, 217),
    (16, 185, 129): (52, 211, 153), (245, 158, 11): (251, 191, 36), (239, 68, 68): (248, 113, 113),
    (148, 163, 184): (184, 162, 212),
}

HEX_RE = re.compile(r"#[0-9a-fA-F]{6}\b")
RGBA_RE = re.compile(r"rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,")


def normalizar(texto: str):
    cambios = 0

    def rep_hex(m):
        nonlocal cambios
        nuevo = HEX.get(m.group(0).lower())
        if nuevo:
            cambios += 1
            return nuevo
        return m.group(0)

    def rep_rgba(m):
        nonlocal cambios
        clave = tuple(int(x) for x in m.groups())
        nuevo = RGB.get(clave)
        if nuevo:
            cambios += 1
            return f"rgba({nuevo[0]}, {nuevo[1]}, {nuevo[2]},"
        return m.group(0)

    texto = HEX_RE.sub(rep_hex, texto)
    texto = RGBA_RE.sub(rep_rgba, texto)
    return texto, cambios


def main():
    args = sys.argv[1:]
    solo_revisar = "--revisar" in args
    archivos = [a for a in args if a != "--revisar"]
    if not archivos:
        print(__doc__)
        return
    total = 0
    for ruta in archivos:
        p = Path(ruta)
        original = p.read_text(encoding="utf-8")
        nuevo, n = normalizar(original)
        total += n
        print(f"{p}: {n} colores {'por cambiar' if solo_revisar else 'cambiados'}")
        if n and not solo_revisar:
            p.write_text(nuevo, encoding="utf-8")
    print(f"Total: {total}")


if __name__ == "__main__":
    main()
