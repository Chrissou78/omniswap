// apps/web/src/lib/websocket.ts
import { useEffect, useRef, useCallback, useState } from 'react';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001/ws';

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

type MessageHandler = (message: WebSocketMessage) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private pendingSubscriptions: string[] = [];
  private isConnected = false;

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        console.log('[WS] Connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // Resubscribe to pending subscriptions
        for (const channel of this.pendingSubscriptions) {
          this.subscribe(channel);
        }
        this.pendingSubscriptions = [];
        
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('[WS] Failed to parse message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('[WS] Disconnected');
        this.isConnected = false;
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('[WS] Error:', error);
        reject(error);
      };
    });
  }

  private handleMessage(message: WebSocketMessage) {
    const handlers = this.handlers.get(message.type);
    if (handlers) {
      handlers.forEach(handler => handler(message));
    }

    // Also dispatch to 'all' handlers
    const allHandlers = this.handlers.get('*');
    if (allHandlers) {
      allHandlers.forEach(handler => handler(message));
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WS] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect().catch(console.error);
    }, delay);
  }

  subscribe(channel: string) {
    if (!this.isConnected) {
      this.pendingSubscriptions.push(channel);
      return;
    }

    this.send({
      type: channel.startsWith('swap:') ? 'SUBSCRIBE_SWAP' : 'SUBSCRIBE_USER',
      swapId: channel.replace('swap:', ''),
    });
  }

  unsubscribe(channel: string) {
    if (!this.isConnected) return;

    this.send({
      type: 'UNSUBSCRIBE_SWAP',
      swapId: channel.replace('swap:', ''),
    });
  }

  on(type: string, handler: MessageHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
  }

  off(type: string, handler: MessageHandler) {
    const handlers = this.handlers.get(type);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  send(message: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const wsClient = new WebSocketClient();

// React hook for WebSocket
export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    wsClient.connect()
      .then(() => setIsConnected(true))
      .catch(() => setIsConnected(false));

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    wsClient.on('CONNECTED', handleConnect);
    wsClient.on('close', handleDisconnect);

    return () => {
      wsClient.off('CONNECTED', handleConnect);
      wsClient.off('close', handleDisconnect);
    };
  }, []);

  const subscribe = useCallback((channel: string) => {
    wsClient.subscribe(channel);
  }, []);

  const unsubscribe = useCallback((channel: string) => {
    wsClient.unsubscribe(channel);
  }, []);

  const onMessage = useCallback((type: string, handler: MessageHandler) => {
    wsClient.on(type, handler);
    return () => wsClient.off(type, handler);
  }, []);

  return {
    isConnected,
    subscribe,
    unsubscribe,
    onMessage,
  };
}
