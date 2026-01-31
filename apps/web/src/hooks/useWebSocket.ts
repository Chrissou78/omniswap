// apps/web/src/hooks/useWebSocket.ts
'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';

type MessageHandler = (data: any) => void;

interface UseWebSocketReturn {
  isConnected: boolean;
  subscribe: (channel: string, handler: MessageHandler) => void;
  unsubscribe: (channel: string) => void;
  send: (event: string, data: any) => void;
}

export const useWebSocket = (): UseWebSocketReturn => {
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef<Map<string, Set<MessageHandler>>>(new Map());
  const [isConnected, setIsConnected] = useState(false);

  // Initialize socket connection
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
    
    socketRef.current = io(wsUrl, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    });

    socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    // Generic message handler
    socket.on('message', (data: { channel: string; payload: any }) => {
      const handlers = handlersRef.current.get(data.channel);
      if (handlers) {
        handlers.forEach((handler) => handler(data.payload));
      }
    });

    // Swap-specific events
    socket.on('swap:update', (data: any) => {
      const handlers = handlersRef.current.get(`swap:${data.swapId}`);
      if (handlers) {
        handlers.forEach((handler) => handler(data));
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const subscribe = useCallback((channel: string, handler: MessageHandler) => {
    if (!handlersRef.current.has(channel)) {
      handlersRef.current.set(channel, new Set());
    }
    handlersRef.current.get(channel)!.add(handler);

    // Subscribe to channel on server
    socketRef.current?.emit('subscribe', { channel });
  }, []);

  const unsubscribe = useCallback((channel: string) => {
    handlersRef.current.delete(channel);
    socketRef.current?.emit('unsubscribe', { channel });
  }, []);

  const send = useCallback((event: string, data: any) => {
    socketRef.current?.emit(event, data);
  }, []);

  return {
    isConnected,
    subscribe,
    unsubscribe,
    send,
  };
};
