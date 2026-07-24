import Peer, { DataConnection } from "peerjs";
import { SubtitleItem, SubtitleSettings } from "../types";

export interface OverlayStatePayload {
  interimText: string;
  currentSubtitle: SubtitleItem | null;
  settings: SubtitleSettings;
  isListening: boolean;
}

// Generate a clean room ID fallback
export const getSavedRoomId = (): string => {
  const stored = localStorage.getItem("scribe_room_id");
  if (stored && stored.trim()) {
    return stored.trim();
  }
  const defaultRoom = "subtitulos-live-room";
  localStorage.setItem("scribe_room_id", defaultRoom);
  return defaultRoom;
};

// Peer Manager for Host (Main App with Mic)
export class HostPeerManager {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private roomId: string;
  private onConnectionCountChange?: (count: number) => void;
  private lastPayload: OverlayStatePayload | null = null;

  constructor(roomId: string, onConnectionCountChange?: (count: number) => void) {
    this.roomId = roomId;
    this.onConnectionCountChange = onConnectionCountChange;
    this.initPeer();
  }

  private initPeer() {
    try {
      // Clean up previous peer if any
      if (this.peer) {
        this.peer.destroy();
      }

      // Create Peer with room ID prefix to avoid collisions
      const peerId = `subtitulos-room-${this.roomId}`;
      this.peer = new Peer(peerId, {
        debug: 1,
      });

      this.peer.on("open", (id) => {
        console.log("[PeerJS Host] Conectado con ID:", id);
      });

      this.peer.on("connection", (conn) => {
        console.log("[PeerJS Host] Nueva conexión entrante desde vMix/OBS:", conn.peer);
        
        conn.on("open", () => {
          this.connections.set(conn.peer, conn);
          this.onConnectionCountChange?.(this.connections.size);

          // Immediately sync current state to new listener
          if (this.lastPayload) {
            conn.send({
              type: "SUBTITLE_UPDATE",
              payload: this.lastPayload,
            });
          }
        });

        conn.on("close", () => {
          this.connections.delete(conn.peer);
          this.onConnectionCountChange?.(this.connections.size);
        });

        conn.on("error", () => {
          this.connections.delete(conn.peer);
          this.onConnectionCountChange?.(this.connections.size);
        });
      });

      this.peer.on("error", (err) => {
        console.warn("[PeerJS Host Warning]", err.type, err.message);
        // If ID is taken, retry connection after short delay
        if (err.type === "unavailable-id") {
          setTimeout(() => {
            if (this.peer && !this.peer.destroyed) {
              this.initPeer();
            }
          }, 3000);
        }
      });
    } catch (err) {
      console.error("[PeerJS Host Init Error]", err);
    }
  }

  public broadcast(payload: OverlayStatePayload) {
    this.lastPayload = payload;
    const message = {
      type: "SUBTITLE_UPDATE",
      payload,
    };

    this.connections.forEach((conn, key) => {
      if (conn.open) {
        try {
          conn.send(message);
        } catch (e) {
          console.warn("[PeerJS Host Send Error]", e);
          this.connections.delete(key);
          this.onConnectionCountChange?.(this.connections.size);
        }
      }
    });
  }

  public destroy() {
    this.connections.forEach((conn) => conn.close());
    this.connections.clear();
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }
}

// Peer Manager for Client (Overlay View in vMix / OBS)
export class ClientPeerManager {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private roomId: string;
  private onData: (payload: OverlayStatePayload) => void;
  private onStatusChange?: (connected: boolean) => void;
  private reconnectTimer: number | null = null;

  constructor(
    roomId: string,
    onData: (payload: OverlayStatePayload) => void,
    onStatusChange?: (connected: boolean) => void
  ) {
    this.roomId = roomId;
    this.onData = onData;
    this.onStatusChange = onStatusChange;
    this.connect();
  }

  private connect() {
    try {
      if (this.peer) {
        this.peer.destroy();
      }

      this.peer = new Peer({ debug: 1 });

      this.peer.on("open", () => {
        const hostPeerId = `subtitulos-room-${this.roomId}`;
        console.log("[PeerJS Client] Conectando con Host:", hostPeerId);
        
        this.conn = this.peer!.connect(hostPeerId, { reliable: true });

        this.conn.on("open", () => {
          console.log("[PeerJS Client] ¡Conectado con éxito a la sala!", hostPeerId);
          this.onStatusChange?.(true);
        });

        this.conn.on("data", (data: any) => {
          if (data && data.type === "SUBTITLE_UPDATE" && data.payload) {
            this.onData(data.payload);
          }
        });

        this.conn.on("close", () => {
          console.warn("[PeerJS Client] Conexión cerrada. Reintentando...");
          this.onStatusChange?.(false);
          this.scheduleReconnect();
        });

        this.conn.on("error", (err) => {
          console.warn("[PeerJS Client Error]", err);
          this.onStatusChange?.(false);
          this.scheduleReconnect();
        });
      });

      this.peer.on("error", (err) => {
        console.warn("[PeerJS Client Peer Error]", err);
        this.onStatusChange?.(false);
        this.scheduleReconnect();
      });
    } catch (err) {
      console.error("[PeerJS Client Init Error]", err);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
    }
    this.reconnectTimer = window.setTimeout(() => {
      this.connect();
    }, 2500);
  }

  public destroy() {
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
    }
    if (this.conn) {
      this.conn.close();
    }
    if (this.peer) {
      this.peer.destroy();
    }
  }
}
