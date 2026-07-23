import { Server as SocketIOServer, Socket } from 'socket.io';
import { GroupService } from '../services/group.service';
import { createWhatsAppClient, WhatsAppClient } from '../whatsapp/client';

type EventedWhatsAppClient = WhatsAppClient & {
  on?: (event: string, listener: (...args: any[]) => void) => void;
};

export class WhatsAppSocket {
  private io: SocketIOServer;
  private groupService = new GroupService();
  private whatsappClient: WhatsAppClient;
  private clientSockets: Map<string, Socket> = new Map();

  constructor(io: SocketIOServer) {
    this.io = io;
    this.whatsappClient = createWhatsAppClient(io);
    this.initializeSocket();
  }

  private initializeSocket() {
    this.io.on('connection', (socket: Socket) => {
      console.log('Client connected:', socket.id);
      this.clientSockets.set(socket.id, socket);

      // Handle authentication
      socket.on('authenticate', (token: string) => {
        // Verify token and associate with user
        // This is a simplified example - in production, use proper JWT verification
        try {
          // const decoded = verifyToken(token);
          // socket.data.userId = decoded.userId;
          socket.emit('authenticated');
        } catch (error) {
          socket.emit('authentication_error', 'Invalid token');
        }
      });

      // Handle group monitoring
      socket.on('monitor_group', async (groupId: string) => {
        try {
          const group = await this.groupService.getGroupById(groupId);
          if (!group) {
            return socket.emit('error', 'Group not found');
          }
          
          // Start monitoring the group in WhatsApp
          await this.whatsappClient.monitorGroup(group.name);
          
          // Send initial messages
          const { messages } = await this.groupService.getGroupMessages(groupId, 1, 50);
          socket.emit('initial_messages', { groupId, messages });
          
        } catch (error: any) {
          console.error('Error monitoring group:', error);
          socket.emit('error', error.message);
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        this.clientSockets.delete(socket.id);
      });
    });

    const eventedClient = this.whatsappClient as EventedWhatsAppClient;

    // Some client implementations emit directly to Socket.IO instead of exposing EventEmitter.
    eventedClient.on?.('new_message', async (data: { groupName: string; message: any }) => {
      try {
        // Find the group by name
        const group = await this.groupService.getAllGroups();
        const targetGroup = group.find(g => g.name === data.groupName);
        
        if (targetGroup) {
          // Save the message to the database
          const message = await this.groupService.addMessage(
            targetGroup.id,
            data.message.content,
            data.message.sender,
            data.message.isMedia,
            data.message.mediaUrl
          );

          // Emit to all clients monitoring this group
          this.io.emit('new_message', {
            groupId: targetGroup.id,
            message
          });
        }
      } catch (error) {
        console.error('Error processing new message:', error);
      }
    });
  }

  // Helper method to send notifications to specific user
  private sendToUser(userId: string, event: string, data: any) {
    // Find all sockets for this user
    const userSockets = Array.from(this.clientSockets.values()).filter(
      socket => socket.data.userId === userId
    );
    
    userSockets.forEach(socket => {
      socket.emit(event, data);
    });
  }
}

export const initializeSocket = (io: SocketIOServer) => {
  return new WhatsAppSocket(io);
};
