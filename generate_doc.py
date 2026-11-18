"""
Script to generate the Word document:
AeroScan_Arquitectura_y_Metodologia.docx
Format: Maximum 3 pages, highly structured, professional academic formatting (UNAP style).
"""
import os
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

def set_cell_background(cell, fill_hex):
    """Set background color of a table cell."""
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), 'clear')
    shd.set(qn('w:color'), 'auto')
    shd.set(qn('w:fill'), fill_hex)
    tc_pr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    """Set inner padding for table cell in dxa (1 pt = 20 dxa)."""
    tc_pr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('w:top', top), ('w:bottom', bottom), ('w:left', left), ('w:right', right)]:
        node = OxmlElement(m)
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tc_pr.append(tcMar)

def create_document():
    doc = docx.Document()

    # 1. Page Setup - Margins (2 cm = 0.787 in) to fit precisely within 3 pages
    for section in doc.sections:
        section.top_margin = Inches(0.7)
        section.bottom_margin = Inches(0.7)
        section.left_margin = Inches(0.75)
        section.right_margin = Inches(0.75)
        section.header_distance = Inches(0.4)
        section.footer_distance = Inches(0.4)

        # Header and Footer
        header = section.header
        hp = header.paragraphs[0]
        hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        hrun = hp.add_run("UNAP • Facultad de Ingeniería Estadística e Informática | AeroScan v2.0")
        hrun.font.name = "Calibri"
        hrun.font.size = Pt(8.5)
        hrun.font.color.rgb = RGBColor(120, 130, 145)

        footer = section.footer
        fp = footer.paragraphs[0]
        fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
        frun = fp.add_run("Documentación de Arquitectura y Metodología (Avance) • Entrega: 28/10/2026")
        frun.font.name = "Calibri"
        frun.font.size = Pt(8.5)
        frun.font.color.rgb = RGBColor(120, 130, 145)

    PRIMARY = RGBColor(15, 59, 102)     # Deep Navy / UNAP Blue
    SECONDARY = RGBColor(33, 115, 178) # Accent Blue
    DARK_TEXT = RGBColor(30, 41, 59)    # Slate 800
    MUTED_TEXT = RGBColor(100, 116, 139)# Slate 500

    # --- ENCABEZADO INSTITUCIONAL ---
    title_p = doc.add_paragraph()
    title_p.paragraph_format.space_before = Pt(0)
    title_p.paragraph_format.space_after = Pt(2)
    title_p.alignment = WD_ALIGN_PARAGRAPH.CENTER

    r_inst = title_p.add_run("UNIVERSIDAD NACIONAL DEL ALTIPLANO – PUNO\n")
    r_inst.bold = True
    r_inst.font.name = "Calibri"
    r_inst.font.size = Pt(12)
    r_inst.font.color.rgb = PRIMARY

    r_fac = title_p.add_run("FACULTAD DE INGENIERÍA ESTADÍSTICA E INFORMÁTICA\n")
    r_fac.bold = True
    r_fac.font.name = "Calibri"
    r_fac.font.size = Pt(10.5)
    r_fac.font.color.rgb = PRIMARY

    r_esc = title_p.add_run("ESCUELA PROFESIONAL DE INGENIERÍA DE SISTEMAS\n")
    r_esc.font.name = "Calibri"
    r_esc.font.size = Pt(9.5)
    r_esc.font.color.rgb = SECONDARY

    # Box / Banner de Tarea
    banner_p = doc.add_paragraph()
    banner_p.paragraph_format.space_before = Pt(4)
    banner_p.paragraph_format.space_after = Pt(6)
    banner_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_banner = banner_p.add_run("INFORME DE AVANCE: ARQUITECTURA Y METODOLOGÍA DEL SISTEMA\n")
    r_banner.bold = True
    r_banner.font.name = "Calibri"
    r_banner.font.size = Pt(13)
    r_banner.font.color.rgb = PRIMARY

    r_sys = banner_p.add_run("Sistema: AeroScan — Diagnóstico y Telemetría del Espectro Radioeléctrico WiFi / SDR")
    r_sys.bold = True
    r_sys.font.name = "Calibri"
    r_sys.font.size = Pt(10)
    r_sys.font.color.rgb = SECONDARY

    # Metadatos de la Tarea en tabla compacta
    meta_table = doc.add_table(rows=2, cols=2)
    meta_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_table.autofit = False

    meta_table.columns[0].width = Inches(3.5)
    meta_table.columns[1].width = Inches(3.5)

    c00 = meta_table.cell(0, 0)
    c01 = meta_table.cell(0, 1)
    c10 = meta_table.cell(1, 0)
    c11 = meta_table.cell(1, 1)

    for c in [c00, c01, c10, c11]:
        set_cell_background(c, "F1F5F9")
        set_cell_margins(c, top=60, bottom=60, left=100, right=100)

    p00 = c00.paragraphs[0]
    p00.paragraph_format.space_after = Pt(0)
    r = p00.add_run("• Modalidad: ")
    r.bold = True
    r.font.size = Pt(8.5)
    r2 = p00.add_run("Tarea Grupal (Evaluación Colectiva)")
    r2.font.size = Pt(8.5)

    p01 = c01.paragraphs[0]
    p01.paragraph_format.space_after = Pt(0)
    r = p01.add_run("• Fecha de Entrega: ")
    r.bold = True
    r.font.size = Pt(8.5)
    r2 = p01.add_run("28 de octubre del 2026 — 01:00 PM")
    r2.font.size = Pt(8.5)

    p10 = c10.paragraphs[0]
    p10.paragraph_format.space_after = Pt(0)
    r = p10.add_run("• Grupo de Desarrollo: ")
    r.bold = True
    r.font.size = Pt(8.5)
    r2 = p10.add_run("Equipo de Proyecto AeroScan")
    r2.font.size = Pt(8.5)

    p11 = c11.paragraphs[0]
    p11.paragraph_format.space_after = Pt(0)
    r = p11.add_run("• Estado del Avance: ")
    r.bold = True
    r.font.size = Pt(8.5)
    r2 = p11.add_run("Arquitectura en Capas Reactiva y Metodología Scrum (Sprint 3)")
    r2.font.size = Pt(8.5)

    def add_sec_title(title_text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(8)
        p.paragraph_format.space_after = Pt(2)
        r = p.add_run(title_text)
        r.bold = True
        r.font.name = "Calibri"
        r.font.size = Pt(11)
        r.font.color.rgb = PRIMARY
        return p

    def add_subsec_title(subtitle_text):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(5)
        p.paragraph_format.space_after = Pt(1)
        r = p.add_run(subtitle_text)
        r.bold = True
        r.font.name = "Calibri"
        r.font.size = Pt(9.5)
        r.font.color.rgb = SECONDARY
        return p

    def add_body_p(text, bold_prefix=None, space_after=3):
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(space_after)
        p.paragraph_format.line_spacing = 1.08
        if bold_prefix:
            rb = p.add_run(bold_prefix)
            rb.bold = True
            rb.font.name = "Calibri"
            rb.font.size = Pt(9)
            rb.font.color.rgb = DARK_TEXT
        r = p.add_run(text)
        r.font.name = "Calibri"
        r.font.size = Pt(9)
        r.font.color.rgb = DARK_TEXT
        return p

    # --- SECCIÓN 1: INTRODUCCIÓN ---
    add_sec_title("1. INTRODUCCIÓN Y ALCANCE DEL SISTEMA AEROSCAN")
    add_body_p(
        "AeroScan es una plataforma de software de grado profesional diseñada para la adquisición, demodulación, diagnóstico y análisis espectral del espectro radioeléctrico en frecuencias no licenciadas de 2.4 GHz y 5 GHz (estándares IEEE 802.11 a/b/g/n/ac/ax) e instrumentación SDR (Software Defined Radio). El presente informe documenta la Arquitectura de Software adoptada para garantizar latencias inferiores a 5 ms y la Metodología Ágil implementada durante el ciclo de vida del proyecto.",
        bold_prefix="Propósito del Sistema: "
    )
    add_body_p(
        "El alcance del avance actual cubre: (1) La capa de abstracción de hardware transceptor sobre Windows WLAN API y Scapy; (2) El motor reactivo asíncrono con FastAPI y WebSockets de telemetría continua; y (3) La interfaz de alta fidelidad con oscilograma de densidad, waterfall 3D WebGL y telemetría de tolerancia de hardware.",
        bold_prefix="Alcance del Avance Técnico: "
    )

    # --- SECCIÓN 2: ARQUITECTURA DE SOFTWARE ---
    add_sec_title("2. ARQUITECTURA DE SOFTWARE DEL SISTEMA")
    add_body_p(
        "Para responder a los requisitos no funcionales de alta tasa de refresco, desacoplamiento de plataforma y tolerancia a fallas de transceptores, se seleccionó una Arquitectura en Capas Híbrida Desacoplada (Layered Reactive Architecture) complementada con un patrón Pipe-and-Filter para la canalización espectral de paquetes.",
        bold_prefix="Patrón Arquitectural: "
    )

    add_subsec_title("2.1. Descomposición por Capas de AeroScan")

    # Tabla de Arquitectura
    arch_table = doc.add_table(rows=6, cols=3)
    arch_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    arch_table.autofit = False

    arch_table.columns[0].width = Inches(1.5)
    arch_table.columns[1].width = Inches(1.8)
    arch_table.columns[2].width = Inches(3.7)

    headers = ["Capa Arquitectural", "Tecnologías Clave", "Responsabilidad y Componentes"]
    hdr_row = arch_table.rows[0]
    for i, h in enumerate(headers):
        cell = hdr_row.cells[i]
        set_cell_background(cell, "0F3B66")
        set_cell_margins(cell, top=70, bottom=70, left=90, right=90)
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(h)
        r.bold = True
        r.font.name = "Calibri"
        r.font.size = Pt(8.5)
        r.font.color.rgb = RGBColor(255, 255, 255)

    layers_data = [
        ("1. Presentación y Visualización", "React 19, TypeScript, Vite, Three.js (WebGL), HTML5 Canvas 2D", "Renderizado a 60 FPS del oscilograma de densidad FFT, waterfall 3D del espectro, barras de barrido de canales y dashboard de telemetría de hardware en tiempo real."),
        ("2. Comunicación y Servicios Web", "FastAPI (ASGI), WebSockets (ws://), Starlette, PyWebView", "Enrutamiento REST (/api/capture/*, /api/adapters), streaming bidireccional /ws/spectrum, control de concurrencia y empaquetado para escritorio nativo en Windows."),
        ("3. Lógica de Negocio y RF", "Channel Rater Engine, Heurística FFT, Moving Average Filter", "Algoritmos de puntuación de canales (0-100), evaluación de interferencia Co-canal y Canal Adyacente, cálculo de densidad espectral y clasificación de congestión."),
        ("4. Abstracción de Hardware (HAL)", "Native WLAN API (wlanapi.dll), Scapy, libpcap, pyrtlsdr", "Enumeración de tarjetas de red Wi-Fi nativas (PCIe/USB), extracción de RSSI/BSSID/Canal/Ancho de banda, buffer FIFO circular anticolisión y captura SDR."),
        ("5. Persistencia y Exportación", "SQLite3, ReportLab PDF, PCAP dump, CSV/JSON", "Almacenamiento de sesiones históricas, volcado de tráfico de tramas beacon/probe y motor de reportes técnicos ejecutivos.")
    ]

    for idx, (capa, tec, resp) in enumerate(layers_data):
        row = arch_table.rows[idx + 1]
        bg_col = "F8FAFC" if idx % 2 == 0 else "FFFFFF"
        for c_i, text_val in enumerate([capa, tec, resp]):
            cell = row.cells[c_i]
            set_cell_background(cell, bg_col)
            set_cell_margins(cell, top=50, bottom=50, left=80, right=80)
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.05
            r = p.add_run(text_val)
            r.font.name = "Calibri"
            r.font.size = Pt(8)
            if c_i == 0:
                r.bold = True
                r.font.color.rgb = PRIMARY
            elif c_i == 1:
                r.font.color.rgb = SECONDARY
            else:
                r.font.color.rgb = DARK_TEXT

    add_subsec_title("2.2. Pipeline de Datos de Telemetría Espectral (Pipe-and-Filter)")
    add_body_p(
        "[Transceptor RF PCIe/USB] ➔ [HAL / wlanapi.dll] ➔ [Buffer FIFO Anticolisiones] ➔ [Motor de Análisis FFT / Calificación] ➔ [Servidor WebSocket /ws/spectrum] ➔ [Pipeline WebGL/Canvas UI]",
        bold_prefix="Flujo de Señal: "
    )
    add_body_p(
        "El sistema aísla la adquisición física del renderizado mediante un buffer FIFO circular en memoria que garantiza una tasa de descarte de paquetes de 0.00% y una latencia de captura controlada de ~4.2 ms con jitter de sondeo dentro del rango óptimo (±0.3 ms).",
        bold_prefix="Garantía de Tiempo Real: "
    )

    # --- SECCIÓN 3: METODOLOGÍA DE DESARROLLO ---
    add_sec_title("3. METODOLOGÍA DE DESARROLLO DE SOFTWARE")
    add_body_p(
        "Se adoptó la metodología ágil SCRUM, adaptada a proyectos de instrumentación y software de sistemas con componentes de hardware en tiempo real. Esta metodología permite la entrega continua de incrementos funcionales (Sprints) validados directamente en el hardware de laboratorio de la UNAP.",
        bold_prefix="Enfoque Metodológico: "
    )

    add_subsec_title("3.1. Planificación de Sprints y Ciclo de Vida del Proyecto")

    sprint_table = doc.add_table(rows=5, cols=4)
    sprint_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    sprint_table.autofit = False

    sprint_table.columns[0].width = Inches(1.0)
    sprint_table.columns[1].width = Inches(1.3)
    sprint_table.columns[2].width = Inches(3.4)
    sprint_table.columns[3].width = Inches(1.3)

    sp_headers = ["Sprint", "Duración", "Objetivos e Incremento de Software", "Estado del Avance"]
    sp_hdr_row = sprint_table.rows[0]
    for i, h in enumerate(sp_headers):
        cell = sp_hdr_row.cells[i]
        set_cell_background(cell, "0F3B66")
        set_cell_margins(cell, top=70, bottom=70, left=90, right=90)
        p = cell.paragraphs[0]
        p.paragraph_format.space_after = Pt(0)
        r = p.add_run(h)
        r.bold = True
        r.font.name = "Calibri"
        r.font.size = Pt(8.5)
        r.font.color.rgb = RGBColor(255, 255, 255)

    sprints_data = [
        ("Sprint 1", "2 semanas", "Diseño de HAL para Windows/Linux, sondeo de transceptores 802.11, configuración de base de datos SQLite y estructuración base de FastAPI.", "Completado (100%)"),
        ("Sprint 2", "2 semanas", "Implementación de WebSocket /ws/spectrum, renderizado de espectro 2D en Canvas, prototipo 3D WebGL e interfaz de autenticación.", "Completado (100%)"),
        ("Sprint 3", "2 semanas", "Integración de telemetría de hardware (latencia RTT, jitter, buffer FIFO), control de captura (Start/Stop), oscilograma temporal de densidad y snapshot instantáneo FFT.", "En Ejecución / Avance Presentado"),
        ("Sprint 4", "2 semanas", "Generación de reportes técnicos automáticos en PDF/Excel, auditoría de vulnerabilidades Wi-Fi (WPA2/WPA3), pruebas de carga y empaquetado final.", "Planificado")
    ]

    for idx, (sp, dur, obj, est) in enumerate(sprints_data):
        row = sprint_table.rows[idx + 1]
        bg_col = "F8FAFC" if idx % 2 == 0 else "FFFFFF"
        for c_i, text_val in enumerate([sp, dur, obj, est]):
            cell = row.cells[c_i]
            set_cell_background(cell, bg_col)
            set_cell_margins(cell, top=50, bottom=50, left=80, right=80)
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.05
            r = p.add_run(text_val)
            r.font.name = "Calibri"
            r.font.size = Pt(8)
            if c_i == 0:
                r.bold = True
                r.font.color.rgb = PRIMARY
            elif c_i == 3:
                r.bold = True
                if "Completado" in text_val:
                    r.font.color.rgb = RGBColor(16, 149, 102) # Green
                elif "Avance" in text_val:
                    r.font.color.rgb = RGBColor(33, 115, 178) # Blue
                else:
                    r.font.color.rgb = MUTED_TEXT
            else:
                r.font.color.rgb = DARK_TEXT

    add_subsec_title("3.2. Roles del Equipo y Herramientas Tecnológicas")
    add_body_p(
        "Product Owner (Definición de requerimientos académicos y de RF), Scrum Master (Coordinación y gestión de impedimentos técnicos), Desarrollador Backend & HAL (Integración de drivers y procesamiento de tramas), Desarrollador Frontend (Visualización gráfica interactiva y UX), y QA / Tester de Radiofrecuencia (Validación en campo en campus UNAP).",
        bold_prefix="Estructura de Roles del Grupo: "
    )
    add_body_p(
        "Git & GitHub (Control de versiones con GitFlow), Visual Studio Code / Antigravity IDE, Vite / Node.js, Python 3.14 (.venv), PyWebView (Contenedor de escritorio nativo), y Postman / ThunderClient para pruebas de API REST y WebSockets.",
        bold_prefix="Pila de Herramientas de Desarrollo: "
    )

    # --- SECCIÓN 4: ESTADO ACTUAL DEL AVANCE Y CONCLUSIÓN ---
    add_sec_title("4. ESTADO ACTUAL DEL AVANCE TÉCNICO Y CONCLUSIÓN")
    add_body_p(
        "A la fecha de entrega de este avance (28 de octubre del 2026), el sistema cuenta con su arquitectura núcleo plenamente operativa: adquisición y streaming funcional con el transceptor Realtek RTL8821CE 802.11ac detectando más de 40 puntos de acceso simultáneos en 2.4 GHz y 5 GHz; controles en vivo de inicio/pausa de captura; oscilograma temporal de densidad de señal con vistas 2D/3D y cálculo dinámico de telemetría de hardware (latencia 4.2 ms, jitter ±0.3 ms, 0 colisiones en FIFO). El avance se encuentra alineado al cronograma establecido en el Sprint 3 de la metodología Scrum.",
        bold_prefix="Resumen del Avance: "
    )

    # Save document
    out_dir = r"c:\Users\cuervo.DESKTOP-GLU29A1\Documents\aeroscan\scan"
    out_path = os.path.join(out_dir, "AeroScan_Arquitectura_y_Metodologia.docx")
    doc.save(out_path)
    print(f"Document saved successfully at: {out_path}")
    return out_path

if __name__ == "__main__":
    create_document()
