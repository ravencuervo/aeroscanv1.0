#!/usr/bin/env python3
"""
AeroScan - WSL2 Scapy Monitor Mode Bridge Agent
Runs inside WSL2 (Ubuntu / Debian / Kali) to capture raw 802.11 frames
in Promiscuous / Monitor mode and forward them to the AeroScan Windows host.
"""

import sys
import time
import json
import socket
import argparse
import urllib.request
from typing import Dict, Any, List

try:
    from scapy.all import sniff, Dot11, Dot11Beacon, Dot11ProbeResp, RadioTap, Dot11Elt
except ImportError:
    print("[!] Error: Scapy no está instalado en este entorno WSL2.")
    print("[*] Instálalo ejecutando: sudo apt install -y python3-scapy")
    sys.exit(1)

def get_windows_host_ip() -> str:
    """Detect default Windows host IP address from WSL2 routing table."""
    try:
        import subprocess
        res = subprocess.run(["ip", "route"], capture_output=True, text=True)
        for line in res.stdout.splitlines():
            if line.startswith("default via"):
                parts = line.split()
                if len(parts) >= 3:
                    return parts[2]
    except Exception:
        pass
    return "127.0.0.1"

class ScapyMonitorBridge:
    def __init__(self, interface: str = "wlan0mon", host_url: str = "http://127.0.0.1:8765"):
        self.interface = interface
        self.host_url = host_url.rstrip("/")
        self.buffer: List[Dict[str, Any]] = []
        self.last_flush = time.time()
        self.frame_count = 0

    def packet_handler(self, pkt):
        if not pkt.haslayer(Dot11):
            return

        dot11 = pkt.getlayer(Dot11)
        bssid = dot11.addr2.upper() if getattr(dot11, "addr2", None) else getattr(dot11, "addr3", "00:00:00:00:00:00")
        if not bssid or bssid == "00:00:00:00:00:00":
            return

        ssid = "<Red Oculta>"
        rssi = -75
        channel = 1
        frame_type = "Data/Control"

        # Signal from RadioTap
        if pkt.haslayer(RadioTap):
            rt = pkt.getlayer(RadioTap)
            if hasattr(rt, "dBm_AntSignal"):
                rssi = int(rt.dBm_AntSignal)

        # Beacon or Probe Response
        if pkt.haslayer(Dot11Beacon) or pkt.haslayer(Dot11ProbeResp):
            frame_type = "Beacon"
            try:
                raw_ssid = pkt.info.decode("utf-8", errors="ignore")
                if raw_ssid:
                    ssid = raw_ssid
            except Exception:
                pass

            # Channel parameter
            elt = pkt.getlayer(Dot11Elt)
            while elt:
                if elt.ID == 3 and len(elt.info) >= 1:
                    channel = ord(elt.info[0:1])
                    break
                elt = elt.payload.getlayer(Dot11Elt)

        self.buffer.append({
            "bssid": bssid,
            "ssid": ssid,
            "channel": channel,
            "rssi": rssi,
            "frame_type": frame_type,
            "timestamp": time.time(),
            "source": "WSL2-Scapy-Monitor"
        })
        self.frame_count += 1

        # Flush buffer every 1.5 seconds or 20 frames
        if time.time() - self.last_flush > 1.5 or len(self.buffer) >= 20:
            self.flush()

    def flush(self):
        if not self.buffer:
            return
        payload = json.dumps({"frames": self.buffer}).encode("utf-8")
        self.buffer = []
        self.last_flush = time.time()

        # Try host URL, then fallback to Windows Host IP
        target_urls = [
            f"{self.host_url}/api/capture/push_frames",
            f"http://{get_windows_host_ip()}:8765/api/capture/push_frames"
        ]

        for url in target_urls:
            try:
                req = urllib.request.Request(
                    url,
                    data=payload,
                    headers={"Content-Type": "application/json"},
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=1.5) as resp:
                    if resp.status == 200:
                        break
            except Exception:
                continue

    def run(self):
        print(f"[*] AeroScan WSL2 Bridge activo en interfaz: {self.interface}")
        print(f"[*] Reenviando tramas hacia: {self.host_url} y host Windows...")
        sniff(iface=self.interface, prn=self.packet_handler, store=False)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AeroScan WSL2 Scapy Monitor Bridge")
    parser.add_argument("-i", "--interface", default="wlan0mon", help="Interfaz en modo monitor (ej. wlan0mon)")
    parser.add_argument("-u", "--url", default="http://127.0.0.1:8765", help="URL base del servidor AeroScan")
    args = parser.parse_args()

    bridge = ScapyMonitorBridge(interface=args.interface, host_url=args.url)
    bridge.run()
