import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { supabaseAdmin } from '../supabase/supabase.client';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({
  cors: { origin: '*' },
  transports: ['websocket', 'polling'],
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(private prisma: PrismaService) {}

  async handleConnection(client: any) {
    try {
      const token = client.handshake?.auth?.token;
      if (!token) {
        client.disconnect();
        return;
      }
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !data.user) {
        client.disconnect();
        return;
      }
      const user = await this.prisma.user.findUnique({
        where: { id: data.user.id },
      });
      if (!user || !user.isActive) {
        client.disconnect();
        return;
      }
      client.join(`user:${user.id}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect() {
    // no-op
  }

  notifyUser(userId: string) {
    this.server.to(`user:${userId}`).emit(`user:${userId}`, {
      type: 'TRANSACTION_UPDATE',
    });
  }
}
