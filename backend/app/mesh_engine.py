"""
Mesh Network Simulation Engine
==============================

Simulates a real-time BLE/Wi-Fi Direct mesh network for emergency communication.
Models device discovery, multi-hop message relay, store-carry-forward behavior,
battery-aware routing, and dynamic cluster formation.

Core concepts:
- Nodes are smartphones with BLE/Wi-Fi Direct capability
- Messages hop through nearby nodes to reach gateways
- Battery level affects relay priority (low-battery nodes don't relay)
- Messages are stored and carried when no path exists (store-carry-forward)
- Clusters form dynamically around gateway/rescue nodes
"""

import json
import math
import random
import time
import asyncio
from pathlib import Path
from typing import Optional
from enum import Enum

DATA_DIR = Path(__file__).parent / "data"

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

BLE_RANGE_METERS = 5000.0          # Simulated BLE/mesh range for demo
WIFI_DIRECT_RANGE_METERS = 8000.0  # Wi-Fi Direct relay range for demo
GATEWAY_RANGE_METERS = 12000.0     # Gateway connectivity range for demo
BATTERY_DRAIN_PER_RELAY = 2.0    # % battery lost per message relayed
IDLE_DRAIN_PER_MINUTE = 0.05     # % battery lost per minute idle
MAX_HOPS = 8                     # Maximum relay hops before message is dropped
RELAY_COOLDOWN_SECONDS = 2       # Minimum time between relaying same message
STORE_CARRY_TTL_SECONDS = 3600   # Messages expire after 1 hour

# Message priority weights (higher = more urgent)
PRIORITY_WEIGHTS = {
    "MEDICAL": 100,
    "FLOOD": 95,
    "EARTHQUAKE": 95,
    "TRAPPED": 90,
    "FIRE": 85,
    "ROAD_BLOCKED": 60,
    "WATER_SHORTAGE": 50,
    "OTHER": 40,
}


class NodeStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    RELAYING = "RELAYING"


class DeviceType(str, Enum):
    CIVILIAN = "CIVILIAN"
    VOLUNTEER = "VOLUNTEER"
    RESCUE = "RESCUE"
    GATEWAY = "GATEWAY"


# ---------------------------------------------------------------------------
# In-memory mesh state
# ---------------------------------------------------------------------------

_mesh_state = {
    "nodes": {},
    "messages": [],          # Active messages in the mesh
    "delivered": [],         # Successfully delivered messages
    "relay_log": [],         # Relay event log
    "clusters": [],          # Dynamic clusters
    "last_tick": time.time(),
    "tick_count": 0,
}


def _load_base_nodes():
    """Load base node definitions from JSON and initialize runtime state."""
    path = DATA_DIR / "mesh_nodes.json"
    if not path.exists():
        return
    with open(path, "r", encoding="utf-8") as f:
        raw_nodes = json.load(f)

    for node_data in raw_nodes:
        node_id = node_data["id"]
        _mesh_state["nodes"][node_id] = {
            **node_data,
            "battery_drain_rate": IDLE_DRAIN_PER_MINUTE,
            "messages_buffered": [],   # Store-carry-forward buffer
            "relay_history": {},       # msg_id -> last_relay_time
            "cluster_id": None,
            "signal_strength": random.randint(60, 100),
            "discovered_peers": [],
            "last_position_update": time.time(),
            "total_bytes_relayed": 0,
            "latency_ms": random.randint(50, 300),
        }


def _haversine_m(lat1, lon1, lat2, lon2):
    """Distance in meters between two lat/lng points."""
    R = 6371000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _compute_range(node):
    """Determine effective communication range based on device type."""
    dt = node.get("device_type", "CIVILIAN")
    if dt == "GATEWAY":
        return GATEWAY_RANGE_METERS
    elif dt == "RESCUE":
        return WIFI_DIRECT_RANGE_METERS * 1.2
    elif dt == "VOLUNTEER":
        return WIFI_DIRECT_RANGE_METERS
    else:
        return BLE_RANGE_METERS


# ---------------------------------------------------------------------------
# Discovery - find reachable peers
# ---------------------------------------------------------------------------

def discover_peers(node_id: str):
    """Find all nodes within BLE/Wi-Fi Direct range of the given node."""
    node = _mesh_state["nodes"].get(node_id)
    if not node or node["status"] == "INACTIVE":
        return []

    node_range = _compute_range(node)
    peers = []
    for pid, peer in _mesh_state["nodes"].items():
        if pid == node_id:
            continue
        if peer["status"] == "INACTIVE":
            continue
        dist = _haversine_m(
            node["latitude"], node["longitude"],
            peer["latitude"], peer["longitude"]
        )
        if dist <= node_range:
            peers.append({
                "id": pid,
                "distance_m": round(dist, 1),
                "signal_strength": max(0, 100 - int(dist / node_range * 40)),
                "device_type": peer["device_type"],
                "battery_level": peer["battery_level"],
            })

    node["discovered_peers"] = [p["id"] for p in peers]
    return peers


def _discover_all():
    """Run discovery across all active nodes."""
    for node_id in list(_mesh_state["nodes"].keys()):
        discover_peers(node_id)


# ---------------------------------------------------------------------------
# Routing - battery-aware shortest path
# ---------------------------------------------------------------------------

def find_route(source_id: str, target_id: str, max_hops: int = MAX_HOPS):
    """
    Find best route from source to target using battery-aware BFS.
    Prefers: higher battery nodes, fewer hops, lower distance.
    """
    if source_id == target_id:
        return [source_id]

    source = _mesh_state["nodes"].get(source_id)
    target = _mesh_state["nodes"].get(target_id)
    if not source or not target:
        return None

    # BFS with priority queue
    from collections import deque
    queue = deque([(source_id, [source_id])])
    visited = {source_id}

    while queue:
        current_id, path = queue.popleft()
        if len(path) > max_hops:
            continue

        current = _mesh_state["nodes"][current_id]

        # Check all active nodes as potential next hops
        for pid, peer in _mesh_state["nodes"].items():
            if pid in visited or peer["status"] == "INACTIVE":
                continue
            if peer["battery_level"] < 10:
                continue  # Skip low-battery nodes

            dist = _haversine_m(
                current["latitude"], current["longitude"],
                peer["latitude"], peer["longitude"]
            )
            peer_range = _compute_range(peer)
            if dist > peer_range:
                continue

            new_path = path + [pid]
            if pid == target_id:
                return new_path

            visited.add(pid)
            queue.append((pid, new_path))

    return None  # No route found


# ---------------------------------------------------------------------------
# Store-Carry-Forward
# ---------------------------------------------------------------------------

def _store_carry_forward(message):
    """
    When no route exists, buffer the message on the source node.
    The node will attempt to deliver when it discovers new peers (mobility).
    """
    source = _mesh_state["nodes"].get(message["source_node"])
    if source:
        # Don't buffer duplicate messages
        existing_ids = {m["id"] for m in source["messages_buffered"]}
        if message["id"] not in existing_ids:
            source["messages_buffered"].append({
                "id": message["id"],
                "content": message.get("content", ""),
                "priority": message.get("priority", 0),
                "emergency_type": message.get("emergency_type", "OTHER"),
                "stored_at": time.time(),
                "ttl": STORE_CARRY_TTL_SECONDS,
            })
            # Keep buffer sorted by priority (highest first)
            source["messages_buffered"].sort(key=lambda m: m["priority"], reverse=True)
            # Limit buffer size
            if len(source["messages_buffered"]) > 20:
                source["messages_buffered"] = source["messages_buffered"][:20]


def _try_deliver_buffered():
    """Attempt to deliver buffered messages when new connections form."""
    for node_id, node in _mesh_state["nodes"].items():
        if node["status"] == "INACTIVE" or not node["messages_buffered"]:
            continue

        now = time.time()
        to_remove = []

        for msg in node["messages_buffered"]:
            # Check TTL
            if now - msg["stored_at"] > msg["ttl"]:
                to_remove.append(msg["id"])
                continue

            # Try to find route to any gateway
            for gid, gnode in _mesh_state["nodes"].items():
                if gnode["device_type"] == "GATEWAY" and gnode["status"] != "INACTIVE":
                    route = find_route(node_id, gid)
                    if route:
                        _relay_message(msg["id"], route)
                        to_remove.append(msg["id"])
                        break

        node["messages_buffered"] = [
            m for m in node["messages_buffered"] if m["id"] not in to_remove
        ]


# ---------------------------------------------------------------------------
# Message Relay
# ---------------------------------------------------------------------------

def _relay_message(message_id: str, route: list[str]):
    """Simulate message relay along a route with timing and battery drain."""
    msg = next(
        (m for m in _mesh_state["messages"] if m["id"] == message_id),
        None
    )
    if not msg:
        msg = next(
            (m for m in _mesh_state["delivered"] if m["id"] == message_id),
            None
        )
        if not msg:
            return

    total_latency = 0
    for i in range(len(route) - 1):
        node = _mesh_state["nodes"].get(route[i])
        if not node:
            continue

        # Drain battery
        node["battery_level"] = max(0, node["battery_level"] - BATTERY_DRAIN_PER_RELAY)

        # Update status
        if node["status"] == "ACTIVE":
            node["status"] = "RELAYING"

        # Calculate hop latency
        next_node = _mesh_state["nodes"].get(route[i + 1])
        if next_node:
            dist = _haversine_m(
                node["latitude"], node["longitude"],
                next_node["latitude"], next_node["longitude"]
            )
            hop_latency = int(50 + dist / 10 + random.randint(0, 100))
            total_latency += hop_latency

        node["messages_relayed"] = node.get("messages_relayed", 0) + 1
        node["total_bytes_relayed"] = node.get("total_bytes_relayed", 0) + len(json.dumps(msg))

        # Log relay event
        _mesh_state["relay_log"].append({
            "message_id": message_id,
            "from_node": route[i],
            "to_node": route[i + 1],
            "hop": i + 1,
            "latency_ms": hop_latency if next_node else 0,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        })

    msg["relay_hops"] = len(route) - 1
    msg["relay_latency_ms"] = total_latency
    msg["route"] = route

    # Check if message reached a gateway
    last_node = _mesh_state["nodes"].get(route[-1])
    if last_node and last_node["device_type"] == "GATEWAY":
        msg["reached_gateway"] = True
        msg["status"] = "DELIVERED"
        msg["delivered_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        _mesh_state["delivered"].append(msg)
        _mesh_state["messages"] = [
            m for m in _mesh_state["messages"] if m["id"] != message_id
        ]


def submit_sos_message(report: dict) -> dict:
    """
    Submit an SOS message into the mesh network.
    Returns the message state including relay status.
    """
    now = time.time()
    message_id = f"MSG{int(now * 1000) % 100000:05d}"

    # Calculate priority
    emergency_type = report.get("emergency_type", "OTHER")
    severity = report.get("severity", 1)
    medical = report.get("medical_emergency", False)
    base_priority = PRIORITY_WEIGHTS.get(emergency_type, 40)
    severity_bonus = severity * 5
    medical_bonus = 20 if medical else 0
    priority = min(base_priority + severity_bonus + medical_bonus, 100)

    message = {
        "id": message_id,
        "content": report.get("description", ""),
        "emergency_type": emergency_type,
        "severity": severity,
        "priority": priority,
        "medical_emergency": medical,
        "source_node": report.get("source_node", "NODE001"),
        "source_village": report.get("village_id", ""),
        "latitude": report.get("latitude", 30.15),
        "longitude": report.get("longitude", 78.45),
        "timestamp": report.get("timestamp", time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())),
        "status": "RELAYING",
        "relay_hops": 0,
        "reached_gateway": False,
        "relay_latency_ms": 0,
        "route": [],
    }

    _mesh_state["messages"].append(message)

    # Try to find route to nearest gateway
    source_node = message["source_node"]
    best_route = None
    for gid, gnode in _mesh_state["nodes"].items():
        if gnode["device_type"] == "GATEWAY" and gnode["status"] != "INACTIVE":
            route = find_route(source_node, gid)
            if route:
                if not best_route or len(route) < len(best_route):
                    best_route = route

    if best_route:
        _relay_message(message_id, best_route)
    else:
        # Store-carry-forward
        _store_carry_forward(message)

    return message


# ---------------------------------------------------------------------------
# Network tick - simulate real-time changes
# ---------------------------------------------------------------------------

def tick():
    """
    Advance the mesh network simulation by one tick.
    Called periodically to simulate real-time changes:
    - Battery drain
    - Node status changes
    - Peer rediscovery
    - Store-carry-forward delivery attempts
    - Cluster formation
    """
    now = time.time()
    elapsed = now - _mesh_state["last_tick"]
    _mesh_state["last_tick"] = now
    _mesh_state["tick_count"] += 1

    for node_id, node in _mesh_state["nodes"].items():
        # Battery drain
        drain = IDLE_DRAIN_PER_MINUTE * (elapsed / 60)
        node["battery_level"] = max(0, min(100, node["battery_level"] - drain))

        # Random status changes
        if random.random() < 0.02:  # 2% chance per tick
            if node["status"] == "RELAYING":
                node["status"] = "ACTIVE"
            elif node["battery_level"] < 5:
                node["status"] = "INACTIVE"
            elif node["status"] == "INACTIVE" and node["battery_level"] > 20:
                node["status"] = "ACTIVE"

        # Signal strength fluctuation
        node["signal_strength"] = max(20, min(100,
            node["signal_strength"] + random.randint(-5, 5)
        ))

        # Latency fluctuation
        node["latency_ms"] = max(30, min(500,
            node["latency_ms"] + random.randint(-30, 30)
        ))

    # Rediscover peers
    _discover_all()

    # Try delivering buffered messages
    _try_deliver_buffered()

    # Form clusters
    _form_clusters()

    # Remove expired messages from relay log
    cutoff = now - 600  # Keep 10 minutes of relay history
    _mesh_state["relay_log"] = [
        r for r in _mesh_state["relay_log"]
        if time.mktime(time.strptime(r["timestamp"], "%Y-%m-%dT%H:%M:%SZ")) > cutoff
    ]


def _form_clusters():
    """Form dynamic clusters around gateway and rescue nodes."""
    clusters = []
    cluster_id = 0

    for nid, node in _mesh_state["nodes"].items():
        if node["device_type"] in ("GATEWAY", "RESCUE") and node["status"] != "INACTIVE":
            cluster_id += 1
            members = [nid]

            # Find all nodes within range
            cluster_range = _compute_range(node) * 1.5  # Clusters extend a bit beyond direct range
            for pid, peer in _mesh_state["nodes"].items():
                if pid == nid or peer["status"] == "INACTIVE":
                    continue
                dist = _haversine_m(
                    node["latitude"], node["longitude"],
                    peer["latitude"], peer["longitude"]
                )
                if dist <= cluster_range:
                    members.append(pid)
                    peer["cluster_id"] = cluster_id

            clusters.append({
                "id": cluster_id,
                "leader": nid,
                "leader_name": node["device_name"],
                "leader_type": node["device_type"],
                "member_count": len(members),
                "members": members,
                "latitude": node["latitude"],
                "longitude": node["longitude"],
                "coverage_radius": cluster_range,
            })

    _mesh_state["clusters"] = clusters


# ---------------------------------------------------------------------------
# Getters
# ---------------------------------------------------------------------------

def get_nodes() -> list[dict]:
    """Get all mesh nodes with current runtime state."""
    tick()  # Advance simulation on each read
    return [
        {
            "id": node["id"],
            "device_name": node["device_name"],
            "device_type": node["device_type"],
            "village_id": node.get("village_id", ""),
            "village_name": node["village_name"],
            "battery_level": round(node["battery_level"]),
            "status": node["status"],
            "last_seen": node.get("last_seen", ""),
            "connected_peers": node.get("connected_peers", []),
            "latitude": node["latitude"],
            "longitude": node["longitude"],
            "messages_relayed": node.get("messages_relayed", 0),
            "signal_strength": node.get("signal_strength", 80),
            "latency_ms": node.get("latency_ms", 100),
            "cluster_id": node.get("cluster_id"),
            "messages_buffered": len(node.get("messages_buffered", [])),
            "total_bytes_relayed": node.get("total_bytes_relayed", 0),
        }
        for node in _mesh_state["nodes"].values()
    ]


def get_health() -> dict:
    """Get mesh network health summary."""
    nodes = list(_mesh_state["nodes"].values())
    total = len(nodes)
    active = sum(1 for n in nodes if n["status"] == "ACTIVE")
    inactive = sum(1 for n in nodes if n["status"] == "INACTIVE")
    relaying = sum(1 for n in nodes if n["status"] == "RELAYING")
    gateways = sum(1 for n in nodes if n["device_type"] == "GATEWAY")
    civilians = sum(1 for n in nodes if n["device_type"] == "CIVILIAN")
    volunteers = sum(1 for n in nodes if n["device_type"] == "VOLUNTEER")
    rescue = sum(1 for n in nodes if n["device_type"] == "RESCUE")
    avg_battery = sum(n["battery_level"] for n in nodes) / max(total, 1)
    total_relayed = sum(n.get("messages_relayed", 0) for n in nodes)
    total_buffered = sum(len(n.get("messages_buffered", [])) for n in nodes)
    coverage = (active / max(total, 1)) * 100
    avg_signal = sum(n.get("signal_strength", 80) for n in nodes) / max(total, 1)
    avg_latency = sum(n.get("latency_ms", 100) for n in nodes) / max(total, 1)

    return {
        "total_nodes": total,
        "active_nodes": active,
        "inactive_nodes": inactive,
        "relay_nodes": relaying,
        "gateway_nodes": gateways,
        "civilian_nodes": civilians,
        "volunteer_nodes": volunteers,
        "rescue_nodes": rescue,
        "avg_battery": round(avg_battery, 1),
        "total_messages_relayed": total_relayed,
        "messages_in_transit": len(_mesh_state["messages"]),
        "messages_delivered": len(_mesh_state["delivered"]),
        "messages_buffered": total_buffered,
        "network_coverage_pct": round(coverage, 1),
        "avg_signal_strength": round(avg_signal, 1),
        "avg_latency_ms": round(avg_latency, 0),
        "active_clusters": len(_mesh_state["clusters"]),
        "tick_count": _mesh_state["tick_count"],
    }


def get_relay_paths() -> list[dict]:
    """Get visualizable relay paths between connected nodes."""
    node_map = _mesh_state["nodes"]
    paths = []
    seen = set()

    for nid, node in node_map.items():
        if node["status"] == "INACTIVE":
            continue
        for peer_id in node.get("discovered_peers", []):
            edge = tuple(sorted([nid, peer_id]))
            if edge in seen:
                continue
            seen.add(edge)
            peer = node_map.get(peer_id)
            if peer and peer["status"] != "INACTIVE":
                dist = _haversine_m(
                    node["latitude"], node["longitude"],
                    peer["latitude"], peer["longitude"]
                )
                paths.append({
                    "from_id": node["id"],
                    "from_name": node["device_name"],
                    "from_lat": node["latitude"],
                    "from_lng": node["longitude"],
                    "from_type": node["device_type"],
                    "to_id": peer["id"],
                    "to_name": peer["device_name"],
                    "to_lat": peer["latitude"],
                    "to_lng": peer["longitude"],
                    "to_type": peer["device_type"],
                    "active": True,
                    "distance_m": round(dist, 1),
                    "signal_strength": max(0, 100 - int(dist / _compute_range(node) * 40)),
                })

    return paths


def get_clusters() -> list[dict]:
    """Get current cluster formations."""
    tick()
    return _mesh_state["clusters"]


def get_messages() -> dict:
    """Get current message state."""
    return {
        "in_transit": _mesh_state["messages"],
        "delivered": _mesh_state["delivered"][-20:],  # Last 20 delivered
        "relay_log": _mesh_state["relay_log"][-50:],   # Last 50 relay events
    }


def get_network_map_data() -> dict:
    """Get all data needed for the real-time network visualization."""
    return {
        "nodes": get_nodes(),
        "health": get_health(),
        "paths": get_relay_paths(),
        "clusters": get_clusters(),
        "messages": get_messages(),
    }


# Initialize mesh state on module load
_load_base_nodes()
_discover_all()
_form_clusters()
