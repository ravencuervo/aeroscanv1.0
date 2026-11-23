from typing import Dict, Any, List, Tuple
from app.core.config import NON_OVERLAPPING_CHANNELS_24

class SpectrumOptimizer:
    """
    Automated network engineering diagnostic and channel recommendation engine.
    Produces findings and recommendations matching AeroScan Module 6 requirements.
    """

    @staticmethod
    def generate_recommendations(analysis: Dict[str, Any], ap_list: Optional[List[Any]] = None) -> Dict[str, Any]:
        """
        Analyze spectrum metrics, find optimal channels, and generate actionable technical recommendations
        including physical co-channel interference and Wi-Fi security/vulnerability audits.
        """
        c24 = analysis.get("channels_24ghz", {})
        c5 = analysis.get("channels_5ghz", {})

        # 1. Optimal 2.4 GHz Channel Evaluation (prioritizing non-overlapping 1, 6, 11)
        best_ch_24 = 1
        lowest_penalty_24 = float("inf")

        for ch in NON_OVERLAPPING_CHANNELS_24:
            if ch in c24:
                penalty = c24[ch]["total_penalty"]
                if penalty < lowest_penalty_24:
                    lowest_penalty_24 = penalty
                    best_ch_24 = ch

        # 2. Optimal 5 GHz Channel Evaluation
        best_ch_5 = 36
        lowest_penalty_5 = float("inf")
        # Priority standard 5GHz channels
        candidates_5 = [36, 40, 44, 48, 149, 153, 157, 161]
        for ch in candidates_5:
            if ch in c5:
                penalty = c5[ch]["total_penalty"]
                if penalty < lowest_penalty_5:
                    lowest_penalty_5 = penalty
                    best_ch_5 = ch

        # 3. Detect critical engineering findings
        findings: List[Dict[str, Any]] = []
        recommendations: List[Dict[str, Any]] = []

        # Check for congested 2.4 GHz channels
        for ch, data in c24.items():
            ap_count = data["ap_count"]
            if ap_count >= 5:
                findings.append({
                    "severity": "CRITICAL",
                    "channel": ch,
                    "band": "2.4GHz",
                    "title": f"Saturación Severa en Canal {ch}",
                    "description": f"Se detectaron {ap_count} Puntos de Acceso operando simultáneamente en el canal {ch}. La contención de medio CSMA/CA degrada la latencia y el throughput.",
                    "cci_score": data["cci_score"],
                    "aci_score": data["aci_score"]
                })
            elif ap_count >= 3:
                findings.append({
                    "severity": "WARNING",
                    "channel": ch,
                    "band": "2.4GHz",
                    "title": f"Congestión Moderada en Canal {ch}",
                    "description": f"{ap_count} redes detectadas compitiendo por tiempo de transmisión.",
                    "cci_score": data["cci_score"],
                    "aci_score": data["aci_score"]
                })

        # Check for non-standard overlapping channel usage in 2.4 GHz (channels 2, 3, 4, 5, 7, 8, 9, 10, 12, 13)
        overlapping_offenders = []
        for ch in [2, 3, 4, 5, 7, 8, 9, 10, 12, 13]:
            if ch in c24 and c24[ch]["ap_count"] > 0:
                overlapping_offenders.append((ch, c24[ch]["ap_count"]))

        if overlapping_offenders:
            ch_list_str = ", ".join([f"Canal {ch} ({cnt} APs)" for ch, cnt in overlapping_offenders])
            findings.append({
                "severity": "CRITICAL",
                "channel": None,
                "band": "2.4GHz",
                "title": "Uso de Canales Superpuestos No Estándar (ACI Destructiva)",
                "description": f"Se detectaron redes operando en canales intermedios: {ch_list_str}. Esto genera interferencia de canal adyacente (ACI) con colisiones CRC en canales 1, 6 y 11.",
                "cci_score": 0,
                "aci_score": max(c24[ch]["aci_score"] for ch, _ in overlapping_offenders)
            })

        # --- AUDITORÍA DE SEGURIDAD Y VULNERABILIDADES RF (Sprint 4) ---
        raw_aps = []
        if ap_list:
            raw_aps = [ap.to_dict() if hasattr(ap, "to_dict") else ap for ap in ap_list]
        else:
            for ch_data in c24.values():
                raw_aps.extend(ch_data.get("aps", []))
            for ch_data in c5.values():
                raw_aps.extend(ch_data.get("aps", []))

        # Check for open networks, deprecated ciphers and Rogue APs / Evil Twins
        ssid_groups: Dict[str, List[Dict[str, Any]]] = {}
        for ap in raw_aps:
            ssid = str(ap.get("ssid", "")).strip()
            sec = str(ap.get("security", "")).upper()
            bssid = ap.get("bssid", "00:00:00:00:00:00")
            vendor = ap.get("vendor", "Desconocido")
            ch = ap.get("channel", 1)

            # 1. Redes abiertas sin cifrado
            if sec in ["OPEN", "NINGUNA", "NONE", "ABIERTA"] or ("OPEN" in sec and "WPA" not in sec):
                if ssid and ssid != "<Oculta>":
                    findings.append({
                        "severity": "WARNING",
                        "channel": ch,
                        "band": ap.get("band", "2.4GHz"),
                        "title": f"Red Abierta Sin Cifrado: '{ssid}'",
                        "description": f"El Punto de Acceso {bssid} ({vendor}) opera sin cifrado criptográfico. El tráfico inalámbrico de los clientes es vulnerable a escucha pasiva (sniffing).",
                        "cci_score": 0,
                        "aci_score": 0
                    })

            # 2. Cifrado débil o deprecado (WEP o TKIP)
            if "WEP" in sec or "TKIP" in sec:
                findings.append({
                    "severity": "CRITICAL",
                    "channel": ch,
                    "band": ap.get("band", "2.4GHz"),
                    "title": f"Cifrado Inseguro y Deprecado ({sec}): '{ssid or bssid}'",
                    "description": f"El AP {bssid} emplea mecanismos criptográficos obsoletos vulnerables a inyección de paquetes y descifrado de claves.",
                    "cci_score": 0,
                    "aci_score": 0
                })

            if ssid and ssid != "<Oculta>":
                if ssid not in ssid_groups:
                    ssid_groups[ssid] = []
                ssid_groups[ssid].append(ap)

        # 3. Detección de Rogue AP / Evil Twin
        for ssid, aps in ssid_groups.items():
            if len(aps) > 1:
                vendors = set(a.get("vendor", "Desconocido") for a in aps if a.get("vendor", "Desconocido") not in ["Desconocido", "Fabricante Estándar"])
                securities = set(str(a.get("security", "")).upper() for a in aps)
                has_open = any("OPEN" in s or "NINGUNA" in s for s in securities)
                has_secure = any("WPA" in s for s in securities)
                if len(vendors) > 1 or (has_open and has_secure):
                    findings.append({
                        "severity": "CRITICAL",
                        "channel": aps[0].get("channel", 1),
                        "band": aps[0].get("band", "2.4GHz"),
                        "title": f"Alerta de Posible AP Falso (Rogue / Evil Twin): '{ssid}'",
                        "description": f"Se detectaron {len(aps)} transceptores transmitiendo el mismo SSID '{ssid}' con fabricantes discrepantes ({', '.join(vendors) or 'Múltiples'}) o políticas de cifrado mixtas. Riesgo de ataque Man-in-the-Middle.",
                        "cci_score": 0,
                        "aci_score": 0
                    })

        # Generate actionable migration recommendations
        if best_ch_24:
            curr_best_info = c24.get(best_ch_24, {})
            recommendations.append({
                "type": "MIGRACION_CANAL_24",
                "target_channel": best_ch_24,
                "band": "2.4GHz",
                "title": f"Recomendación para 2.4 GHz: Migrar al Canal {best_ch_24}",
                "detail": f"El Canal {best_ch_24} presenta la menor penalización espectral ({curr_best_info.get('total_penalty', 0)} pts) con una pureza de canal estimada del {curr_best_info.get('channel_health', 100)}%.",
                "action": f"Reconfigurar APs principales de 2.4 GHz al Canal {best_ch_24} con ancho de banda fijo de 20 MHz."
            })

        if best_ch_5:
            curr_5_info = c5.get(best_ch_5, {})
            recommendations.append({
                "type": "MIGRACION_CANAL_5",
                "target_channel": best_ch_5,
                "band": "5GHz",
                "title": f"Recomendación para 5 GHz: Asignar Canal {best_ch_5}",
                "detail": f"Banda de 5 GHz con alta capacidad y mínimo ruido. El canal {best_ch_5} ofrece {curr_5_info.get('channel_health', 100)}% de salud de canal.",
                "action": f"Habilitar Band Steering para migrar clientes 802.11ac/ax hacia el canal {best_ch_5} en 5 GHz (ancho de 40 u 80 MHz)."
            })

        # General summary formulation
        summary = (
            f"Diagnóstico de Espectro AeroScan: Se escanearon {analysis.get('total_aps', 0)} redes WiFi. "
            f"Salud global del entorno evaluada en {analysis.get('overall_health_score', 0)}/100. "
            f"El canal óptimo para 2.4 GHz es el Canal {best_ch_24} y para 5 GHz es el Canal {best_ch_5}."
        )

        return {
            "summary": summary,
            "optimal_channel_24": best_ch_24,
            "optimal_channel_5": best_ch_5,
            "findings": findings,
            "recommendations": recommendations
        }
