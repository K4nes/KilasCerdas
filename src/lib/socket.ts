'use client';

import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket || !socket.connected) {
    const transports = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? ['websocket', 'polling']
      : ['polling'];

    socket = io(window.location.origin, {
      transports,
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
