import mqtt, { MqttClient } from "mqtt";
import { SubtitleItem, SubtitleSettings } from "../types";

export interface OverlayStatePayload {
  interimText: string;
  currentSubtitle: SubtitleItem | null;
  settings: SubtitleSettings;
  isListening: boolean;
}

const BROKERS = [
  "wss://broker.emqx.io:8084/mqtt",
  "wss://test.mosquitto.org:8081",
];

export const getSavedTopic = (): string => {
  const stored = localStorage.getItem("scribe_mqtt_topic");
  if (stored && stored.trim()) {
    return stored.trim();
  }
  const defaultTopic = "toniad74/subtitulosonline/live";
  localStorage.setItem("scribe_mqtt_topic", defaultTopic);
  return defaultTopic;
};

// Publisher Class (Used by App.tsx in Chrome)
export class MqttPublisher {
  private client: MqttClient | null = null;
  private topic: string;
  private isConnected: boolean = false;
  private lastPayload: OverlayStatePayload | null = null;

  constructor(topic: string) {
    this.topic = topic;
    this.connect(0);
  }

  private connect(brokerIdx: number) {
    const url = BROKERS[brokerIdx % BROKERS.length];
    console.log("[MQTT Publisher] Conectando a broker:", url);

    try {
      this.client = mqtt.connect(url, {
        keepalive: 30,
        clientId: `pub_${Math.random().toString(36).substring(2, 10)}`,
        clean: true,
        reconnectPeriod: 2000,
        connectTimeout: 5000,
      });

      this.client.on("connect", () => {
        console.log("[MQTT Publisher] ¡Conectado con éxito a MQTT!");
        this.isConnected = true;
        if (this.lastPayload) {
          this.publish(this.lastPayload);
        }
      });

      this.client.on("error", (err) => {
        console.warn("[MQTT Publisher Error]", err);
      });

      this.client.on("offline", () => {
        this.isConnected = false;
      });
    } catch (err) {
      console.error("[MQTT Publisher Init Error]", err);
    }
  }

  public publish(payload: OverlayStatePayload) {
    this.lastPayload = payload;
    if (this.client && this.isConnected) {
      try {
        const data = JSON.stringify(payload);
        this.client.publish(this.topic, data, { qos: 0, retain: true });
      } catch (err) {
        console.warn("[MQTT Publish Error]", err);
      }
    }
  }

  public destroy() {
    if (this.client) {
      this.client.end(true);
      this.client = null;
    }
  }
}

// Subscriber Class (Used by OverlayView.tsx in vMix)
export class MqttSubscriber {
  private client: MqttClient | null = null;
  private topic: string;
  private onData: (payload: OverlayStatePayload) => void;

  constructor(topic: string, onData: (payload: OverlayStatePayload) => void) {
    this.topic = topic;
    this.onData = onData;
    this.connect(0);
  }

  private connect(brokerIdx: number) {
    const url = BROKERS[brokerIdx % BROKERS.length];
    console.log("[MQTT Subscriber] Conectando a broker en vMix:", url);

    try {
      this.client = mqtt.connect(url, {
        keepalive: 30,
        clientId: `sub_${Math.random().toString(36).substring(2, 10)}`,
        clean: true,
        reconnectPeriod: 2000,
        connectTimeout: 5000,
      });

      this.client.on("connect", () => {
        console.log("[MQTT Subscriber] ¡vMix conectado a MQTT! Suscribiendo a:", this.topic);
        this.client?.subscribe(this.topic, { qos: 0 });
      });

      this.client.on("message", (t, message) => {
        if (t === this.topic && message) {
          try {
            const payload = JSON.parse(message.toString());
            if (payload) {
              this.onData(payload);
            }
          } catch (err) {
            console.warn("[MQTT Parse Message Error]", err);
          }
        }
      });

      this.client.on("error", (err) => {
        console.warn("[MQTT Subscriber Error]", err);
      });
    } catch (err) {
      console.error("[MQTT Subscriber Init Error]", err);
    }
  }

  public destroy() {
    if (this.client) {
      this.client.end(true);
      this.client = null;
    }
  }
}
