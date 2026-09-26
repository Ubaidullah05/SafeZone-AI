"""
Satellite Communication Engine
==============================
Implements the hybrid off-grid communication architecture:
Mobile -> Bluetooth BLE -> Satcom Terminal (ISRO DAT-SG / NavIC Compatible)
       -> Satellite Uplink -> INMCC / Ground Gateway -> SafeZone Backend

Includes:
- High-density burst packet compression and decompression (SZ1 protocol)
- Orbital link telemetry simulation (propagation delay, C/N0, Doppler)
- Virtual Satcom Terminal fleet management
- Two-way satellite downlink broadcast & ACK messaging
"""

import time
import math
import random
from typing import Optional, Dict, Any, List

# ---------------------------------------------------------------------------
# Packet Compression Protocol: "SZ1"
# Ultra-compact text burst format designed for bandwidth-constrained MSS links
# Format: SZ1|TYPE|VILLAGE_ID|LAT|LON|SEV|AFF|MED|TERM_ID|SEQ|EMERGENCY_CODE
# e.g.: SZ1|SOS|VIL004|30.7346|79.0669|5|4|1|DATSG-KDR01|1024|FLOOD
# ---------------------------------------------------------------------------

EMERGENCY_SHORT_CODES = {
    "FLOOD": "FL",
    "EARTHQUAKE": "EQ",
    "TRAPPED": "TR",
    "MEDICAL": "MD",
    "ROAD_BLOCKED": "RB",
    "WATER_SHORTAGE": "WS",
    "FIRE": "FR",
    "OTHER": "OT",
}

SHORT_TO_EMERGENCY = {v: k for k, v in EMERGENCY_SHORT_CODES.items()}


def encode_satellite_burst_packet(
    village_id: str,
    latitude: float,
    longitude: float,
    severity: int,
    people_affected: int,
    medical_emergency: bool,
    emergency_type: str = "OTHER",
    terminal_id: str = "DATSG-KDR01",
    seq_no: Optional[int] = None,
) -> str:
    """
    Compress an emergency report into a high-density satellite burst packet.
    Payload size is reduced from ~650 bytes JSON to ~40-48 bytes ASCII string.
    """
    if seq_no is None:
        seq_no = int(time.time()) % 100000

    e_code = EMERGENCY_SHORT_CODES.get(emergency_type.upper(), "OT")
    med_flag = "1" if medical_emergency else "0"
    lat_str = f"{latitude:.4f}"
    lon_str = f"{longitude:.4f}"

    packet = f"SZ1|SOS|{village_id}|{lat_str}|{lon_str}|{severity}|{people_affected}|{med_flag}|{terminal_id}|{seq_no}|{e_code}"
    return packet


def decode_satellite_burst_packet(packet_str: str) -> Dict[str, Any]:
    """
    Decode a compressed satellite burst packet back into a structured dictionary.
    """
    parts = packet_str.strip().split("|")
    if len(parts) < 11 or parts[0] != "SZ1":
        raise ValueError(f"Invalid satellite burst packet format: '{packet_str}'")

    protocol_ver = parts[0]
    msg_type = parts[1]
    village_id = parts[2]
    try:
        latitude = float(parts[3])
        longitude = float(parts[4])
        severity = int(parts[5])
        people_affected = int(parts[6])
        medical_emergency = parts[7] in ("1", "true", "TRUE")
        terminal_id = parts[8]
        seq_no = int(parts[9])
        short_code = parts[10]
        emergency_type = SHORT_TO_EMERGENCY.get(short_code, "OTHER")
    except (ValueError, IndexError) as exc:
        raise ValueError(f"Failed to parse packet fields: {exc}") from exc

    return {
        "protocol": protocol_ver,
        "message_type": msg_type,
        "village_id": village_id,
        "latitude": latitude,
        "longitude": longitude,
        "severity": severity,
        "people_affected": people_affected,
        "medical_emergency": medical_emergency,
        "terminal_id": terminal_id,
        "seq_no": seq_no,
        "emergency_type": emergency_type,
        "raw_packet": packet_str,
        "packet_size_bytes": len(packet_str.encode("utf-8")),
    }


# ---------------------------------------------------------------------------
# Virtual Satcom Terminal Fleet (ISRO DAT-SG compatible models)
# ---------------------------------------------------------------------------

DEFAULT_TERMINALS: List[Dict[str, Any]] = [
    {
        "terminal_id": "DATSG-KDR01",
        "name": "Kedarnath Base Camp DAT-SG Terminal",
        "model": "ISRO DAT-SG Gen-2 (NavIC/GSAT-7)",
        "latitude": 30.7346,
        "longitude": 79.0669,
        "altitude_m": 3584,
        "battery_pct": 94,
        "ble_paired": True,
        "ble_signal_dbm": -56,
        "uplink_c_n0_dbhz": 44.8,
        "status": "ONLINE",
        "sat_lock": True,
        "last_ping": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    },
    {
        "terminal_id": "DATSG-GAU02",
        "name": "Gaurikund Transit Post Satcom Hub",
        "model": "ISRO DAT-SG Gen-2 (NavIC/GSAT-7)",
        "latitude": 30.6521,
        "longitude": 79.0275,
        "altitude_m": 1982,
        "battery_pct": 88,
        "ble_paired": False,
        "ble_signal_dbm": -64,
        "uplink_c_n0_dbhz": 43.5,
        "status": "ONLINE",
        "sat_lock": True,
        "last_ping": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    },
    {
        "terminal_id": "DATSG-GUP03",
        "name": "Guptkashi Control Terminal",
        "model": "ISRO DAT-SG Fixed Ground Base",
        "latitude": 30.5228,
        "longitude": 79.0782,
        "altitude_m": 1319,
        "battery_pct": 99,
        "ble_paired": False,
        "ble_signal_dbm": -48,
        "uplink_c_n0_dbhz": 46.2,
        "status": "ONLINE",
        "sat_lock": True,
        "last_ping": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    },
    {
        "terminal_id": "DATSG-SON04",
        "name": "Sonprayag River Crossing Terminal",
        "model": "ISRO DAT-SG Gen-2 Portable",
        "latitude": 30.6280,
        "longitude": 78.9950,
        "altitude_m": 1820,
        "battery_pct": 81,
        "ble_paired": False,
        "ble_signal_dbm": -71,
        "uplink_c_n0_dbhz": 42.1,
        "status": "ONLINE",
        "sat_lock": True,
        "last_ping": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    },
]

# In-memory terminal registry for fast state updates
_TERMINAL_STORE: Dict[str, Dict[str, Any]] = {t["terminal_id"]: dict(t) for t in DEFAULT_TERMINALS}

# Two-way downlink message store
_DOWNLINK_STORE: List[Dict[str, Any]] = [
    {
        "id": "DOWN-001",
        "terminal_id": "ALL",
        "message_type": "ADVISORY",
        "title": "MONSOON WEATHER ALERT",
        "content": "Heavy rainfall predicted in Mandakini Valley. Move to identified safe zones immediately.",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(time.time() - 3600)),
        "status": "BEAMED_VIA_SATELLITE",
    }
]


def get_all_terminals() -> List[Dict[str, Any]]:
    """Return all active virtual satcom terminals."""
    return list(_TERMINAL_STORE.values())


def get_terminal(terminal_id: str) -> Optional[Dict[str, Any]]:
    """Fetch terminal by ID."""
    return _TERMINAL_STORE.get(terminal_id)


def pair_terminal_ble(terminal_id: str, device_name: str = "Civilian Phone") -> Dict[str, Any]:
    """Simulate Bluetooth BLE pairing handshake between phone and satcom terminal."""
    if terminal_id not in _TERMINAL_STORE:
        # If unknown terminal, dynamically register
        _TERMINAL_STORE[terminal_id] = {
            "terminal_id": terminal_id,
            "name": f"Satcom Terminal ({terminal_id})",
            "model": "ISRO DAT-SG Gen-2 Compatible",
            "latitude": 30.7346,
            "longitude": 79.0669,
            "altitude_m": 2500,
            "battery_pct": 95,
            "ble_paired": True,
            "ble_signal_dbm": -55,
            "uplink_c_n0_dbhz": 44.0,
            "status": "ONLINE",
            "sat_lock": True,
            "last_ping": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }

    t = _TERMINAL_STORE[terminal_id]
    t["ble_paired"] = True
    t["paired_device"] = device_name
    t["ble_signal_dbm"] = random.randint(-62, -48)
    t["last_ping"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    return {
        "paired": True,
        "terminal": t,
        "pairing_protocol": "BLE-5.2-GATT-DATSG",
        "mtu_bytes": 128,
        "message": f"Successfully paired with {t['name']} via Bluetooth BLE",
    }


# ---------------------------------------------------------------------------
# Satellite Link Telemetry & Uplink Simulator
# ---------------------------------------------------------------------------

def simulate_satellite_uplink(
    packet_str: str,
    terminal_id: str = "DATSG-KDR01",
) -> Dict[str, Any]:
    """
    Simulate the physical and orbital transmission of the compressed packet
    from the terminal to the satellite and down to the Ground Gateway.
    """
    # Verify/decode packet first
    decoded = decode_satellite_burst_packet(packet_str)

    # Telemetry simulation (GEO MSS link characteristics)
    # Geostationary slant range ~37,000 km -> speed of light gives ~240-270ms one-way RF transit,
    # plus terminal processing + satellite transponder + gateway ground processing -> ~900-1400ms total latency.
    simulated_latency_ms = random.randint(920, 1380)
    c_n0_dbhz = round(random.uniform(42.5, 45.9), 1)  # Carrier to Noise spectral density
    doppler_hz = round(random.uniform(-120.0, 120.0), 1)

    terminal = _TERMINAL_STORE.get(terminal_id)
    if terminal:
        terminal["last_ping"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        terminal["battery_pct"] = max(10, terminal["battery_pct"] - 1)

    result = {
        "uplink_status": "SUCCESS",
        "satellite_constellation": "ISRO GSAT-7R / NavIC-MSS (MSS S-Band 2.67 GHz)",
        "ground_gateway": "INMCC Bengaluru / NRSC Shadnagar Earth Station",
        "satellite_id": "GSAT-7R-MSS-02",
        "terminal_id": terminal_id,
        "raw_packet": packet_str,
        "decoded_data": decoded,
        "telemetry": {
            "latency_ms": simulated_latency_ms,
            "carrier_to_noise_dbhz": c_n0_dbhz,
            "doppler_shift_hz": doppler_hz,
            "uplink_frequency_mhz": 2670.0,
            "downlink_frequency_mhz": 2500.0,
            "packet_size_bytes": len(packet_str.encode("utf-8")),
            "compression_ratio_pct": round((1 - (len(packet_str) / 650.0)) * 100, 1),
            "link_margin_db": 5.4,
            "orbital_slot": "74°E GEO",
        },
        "ground_reality_integration": True,
        "operational_priority_boost": "P1_URGENT" if decoded["severity"] >= 4 else "P2_HIGH",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    return result


def get_satellite_constellation_status() -> Dict[str, Any]:
    """
    Get live orbital status and health metrics for the disaster satcom network.
    """
    now = time.time()
    # Cyclic orbital sub-point variation
    elevation_deg = round(52.4 + math.sin(now / 180.0) * 1.5, 1)
    azimuth_deg = round(168.2 + math.cos(now / 240.0) * 0.8, 1)

    return {
        "constellation_name": "ISRO MSS / NavIC Disaster Alert Constellation",
        "primary_satellite": "GSAT-7R (INSAT/NavIC MSS Payload)",
        "secondary_satellite": "GSAT-6 (S-Band / C-Band)",
        "transponder_status": "NOMINAL",
        "ground_station_link": "CONNECTED",
        "coverage_region": "Kedarnath Valley & Uttarakhand Himalayas (Grid 30.7°N, 79.0°E)",
        "elevation_angle_deg": elevation_deg,
        "azimuth_angle_deg": azimuth_deg,
        "active_terminals_count": len([t for t in _TERMINAL_STORE.values() if t["status"] == "ONLINE"]),
        "uplink_health": "OPTIMAL",
        "downlink_broadcast_enabled": True,
        "latency_baseline_ms": 1050,
        "isro_dat_sg_compatible": True,
        "last_sync": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


# ---------------------------------------------------------------------------
# Two-Way Satellite Downlink Broadcast (Authority -> Satcom Terminals -> Phones)
# ---------------------------------------------------------------------------

def broadcast_downlink_advisory(
    title: str,
    content: str,
    message_type: str = "ADVISORY",
    target_terminal: str = "ALL",
) -> Dict[str, Any]:
    """
    Simulate beaming an authority alert from the Disaster Control Centre
    down via satellite to field terminals and paired mobile devices.
    """
    msg_id = f"DOWN-{int(time.time()) % 100000:05d}"
    item = {
        "id": msg_id,
        "terminal_id": target_terminal,
        "message_type": message_type,
        "title": title,
        "content": content,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "status": "BEAMED_VIA_SATELLITE",
        "sat_carrier": "GSAT-7R MSS Forward Link",
    }
    _DOWNLINK_STORE.insert(0, item)
    return item


def get_downlink_messages(terminal_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Retrieve satellite downlink broadcast messages."""
    if not terminal_id or terminal_id == "ALL":
        return _DOWNLINK_STORE
    return [m for m in _DOWNLINK_STORE if m["terminal_id"] in ("ALL", terminal_id)]
