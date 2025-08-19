import { Socket } from 'socket.io-client';

declare module '@/lib/socket' {
  export interface SocketEventMap {
    connect: () => void;
    disconnect: (reason: string) => void;
    error: (error: Error) => void;
    'order:created': (order: any) => void;
    'order:updated': (order: any) => void;
    'table:updated': (table: any) => void;
    'notification': (notification: { type: string; message: string; data?: any }) => void;
  }

  const socket: Socket<SocketEventMap> & {
    connect(): Socket<SocketEventMap>;
    disconnect(): Socket<SocketEventMap>;
    on<T extends keyof SocketEventMap>(
      event: T,
      listener: SocketEventMap[T]
    ): Socket<SocketEventMap>;
    off<T extends keyof SocketEventMap>(
      event: T,
      listener?: SocketEventMap[T]
    ): Socket<SocketEventMap>;
    emit<T extends keyof SocketEventMap>(
      event: T,
      ...args: Parameters<SocketEventMap[T]>
    ): boolean;
    connected: boolean;
    disconnected: boolean;
    id: string;
  };

  export default socket;
}
