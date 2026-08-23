import { AppDataSource } from '../config/database';
import { Group } from '../db/entities/Group';
import { Message } from '../db/entities/Message';

export class GroupService {
  private groupRepository = AppDataSource.getRepository(Group);
  private messageRepository = AppDataSource.getRepository(Message);

  async createGroup(
    name: string,
    description?: string,
    metadata?: Record<string, any>
  ): Promise<Group> {
    const group = new Group();
    group.name = name;
    group.description = description;
    group.metadata = metadata;
    group.isActive = true;

    return this.groupRepository.save(group);
  }

  async getGroupById(id: string): Promise<Group | null> {
    return this.groupRepository.findOne({
      where: { id },
      relations: ['messages'],
    });
  }

  async getAllGroups(): Promise<Group[]> {
    return this.groupRepository.find({
      relations: ['messages'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateGroup(id: string, updates: Partial<Group>): Promise<Group | null> {
    const group = await this.groupRepository.findOneBy({ id });
    if (!group) return null;

    Object.assign(group, updates);
    return this.groupRepository.save(group);
  }

  async deleteGroup(id: string): Promise<boolean> {
    const result = await this.groupRepository.delete(id);
    return result.affected ? result.affected > 0 : false;
  }

  async addMessage(
    groupId: string,
    content: string,
    sender?: string,
    isMedia = false,
    mediaUrl?: string
  ): Promise<Message> {
    const group = await this.groupRepository.findOneBy({ id: groupId });
    if (!group) {
      throw new Error('Group not found');
    }

    const message = new Message();
    message.content = content;
    // `sender` is a display name, so it belongs on the senderName column. It was
    // being assigned to the User relation, which persisted neither senderId nor
    // a name and silently dropped the sender.
    message.senderName = sender || 'System';
    message.isMedia = isMedia;
    if (mediaUrl) message.mediaUrl = mediaUrl;
    message.group = group;

    return this.messageRepository.save(message);
  }

  async getGroupMessages(
    groupId: string,
    page = 1,
    limit = 50
  ): Promise<{ messages: Message[]; total: number }> {
    const [messages, total] = await this.messageRepository.findAndCount({
      where: { group: { id: groupId } },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { messages, total };
  }
}
