import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

/** Production default: socket kapalı. Sadece NEXT_PUBLIC_ENABLE_SOCKET === "true" iken bağlanır. */
export function isSocketEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_SOCKET === "true";
}

export function connectSocket(token: string): Socket | null {
  if (!isSocketEnabled()) {
    disconnectSocket();
    return null;
  }

  if (socket?.connected) return socket;
  if (socket) socket.disconnect();

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
  socket = io(apiUrl, {
    auth: { token },
    transports: ["websocket", "polling"],
  });
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
