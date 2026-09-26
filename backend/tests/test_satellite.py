"""
Test suite for Satellite Backhaul & ISRO DAT-SG simulation.
"""

from app.satellite_engine import (
    encode_satellite_burst_packet,
    decode_satellite_burst_packet,
    get_all_terminals,
    pair_terminal_ble,
    simulate_satellite_uplink,
    broadcast_downlink_advisory,
    get_downlink_messages,
)
from app.main import app
from fastapi.testclient import TestClient


def test_packet_compression_and_decompression():
    # Test encoding
    raw = encode_satellite_burst_packet(
        village_id="VIL004",
        latitude=30.7346,
        longitude=79.0669,
        severity=5,
        people_affected=4,
        medical_emergency=True,
        emergency_type="FLOOD",
        terminal_id="DATSG-KDR01",
        seq_no=42001,
    )
    assert raw.startswith("SZ1|SOS|VIL004|30.7346|79.0669|5|4|1|DATSG-KDR01|42001|FL")
    # Check payload size (should be under 65 bytes vs 600+ bytes JSON)
    assert len(raw) < 70

    # Test decoding
    decoded = decode_satellite_burst_packet(raw)
    assert decoded["protocol"] == "SZ1"
    assert decoded["message_type"] == "SOS"
    assert decoded["village_id"] == "VIL004"
    assert decoded["severity"] == 5
    assert decoded["people_affected"] == 4
    assert decoded["medical_emergency"] is True
    assert decoded["emergency_type"] == "FLOOD"
    assert decoded["terminal_id"] == "DATSG-KDR01"
    assert decoded["seq_no"] == 42001


def test_terminals_and_ble_pairing():
    terminals = get_all_terminals()
    assert len(terminals) >= 4
    t_ids = {t["terminal_id"] for t in terminals}
    assert "DATSG-KDR01" in t_ids

    # Pair terminal via BLE
    pair_res = pair_terminal_ble("DATSG-KDR01", device_name="Galaxy A15 Test Phone")
    assert pair_res["paired"] is True
    assert pair_res["terminal"]["ble_paired"] is True
    assert "BLE" in pair_res["pairing_protocol"]


def test_satellite_telemetry_simulation():
    raw_packet = encode_satellite_burst_packet(
        village_id="V008",
        latitude=30.203,
        longitude=78.46,
        severity=4,
        people_affected=3,
        medical_emergency=False,
        emergency_type="TRAPPED",
        terminal_id="DATSG-GAU02",
    )
    sim = simulate_satellite_uplink(raw_packet, terminal_id="DATSG-GAU02")
    assert sim["uplink_status"] == "SUCCESS"
    assert "ISRO" in sim["satellite_constellation"] or "NavIC" in sim["satellite_constellation"]
    assert sim["telemetry"]["latency_ms"] >= 800  # realistic satellite round-trip
    assert sim["telemetry"]["carrier_to_noise_dbhz"] > 40.0
    assert sim["telemetry"]["compression_ratio_pct"] > 80.0


def test_two_way_satellite_downlink():
    adv = broadcast_downlink_advisory(
        title="EVACUATION DIRECTIVE",
        content="Flash flood alert: Move to Kedarnath Safe Zone 1.",
        message_type="EVACUATION",
        target_terminal="DATSG-KDR01",
    )
    assert adv["id"].startswith("DOWN-")
    assert adv["status"] == "BEAMED_VIA_SATELLITE"

    msgs = get_downlink_messages("DATSG-KDR01")
    assert any(m["id"] == adv["id"] for m in msgs)


def test_api_satellite_endpoints():
    client = TestClient(app)

    # 1. Satellite status
    r_status = client.get("/api/satellite/status")
    assert r_status.status_code == 200
    status_data = r_status.json()
    assert "ISRO" in status_data["constellation_name"]
    assert status_data["isro_dat_sg_compatible"] is True

    # 2. Terminals list
    r_term = client.get("/api/satellite/terminals")
    assert r_term.status_code == 200
    assert len(r_term.json()["terminals"]) >= 4

    # 3. Terminal BLE pairing
    r_pair = client.post("/api/satellite/terminal/pair", json={"terminal_id": "DATSG-KDR01", "device_name": "Test Phone"})
    assert r_pair.status_code == 200
    assert r_pair.json()["paired"] is True

    # 4. Transmit Satellite SOS
    req_body = {
        "village_id": "V008",
        "latitude": 30.203,
        "longitude": 78.46,
        "severity": 5,
        "people_affected": 4,
        "medical_emergency": True,
        "emergency_type": "FLOOD",
        "description": "Bridge collapsed. 4 people stranded.",
        "reporter_name": "Village Elder via Satcom",
        "terminal_id": "DATSG-KDR01",
    }
    r_tx = client.post("/api/satellite/transmit", json=req_body)
    assert r_tx.status_code == 200, r_tx.text
    tx_data = r_tx.json()
    assert tx_data["uplink_status"] == "SUCCESS"
    assert tx_data["telemetry"]["latency_ms"] > 0
    assert tx_data["sos_report"]["transmission_channel"] == "SATELLITE"
    assert tx_data["sos_report"]["sat_terminal_id"] == "DATSG-KDR01"
    assert tx_data["sos_report"]["priority_score"] > 70

    # 5. Verify report is reflected in SOS list
    r_list = client.get("/api/sos/reports")
    assert r_list.status_code in (200, 401)
    if r_list.status_code == 200:
        reports = r_list.json()
        sat_rep = next((x for x in reports if x["id"] == tx_data["sos_report"]["id"]), None)
        assert sat_rep is not None
        assert sat_rep["transmission_channel"] == "SATELLITE"
