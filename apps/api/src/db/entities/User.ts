import bcrypt from 'bcryptjs';
import { Exclude } from 'class-transformer';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
  OneToMany,
} from 'typeorm';
import type { Relation } from 'typeorm';

import { dateColumnType } from '../column-types';

import { Group } from './Group';
import { Message } from './Message';

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true })
  email!: string;

  @Column({ type: 'varchar' })
  @Exclude()
  password!: string;

  @Column({ type: 'varchar', nullable: true })
  name?: string;

  @Column({
    type: 'simple-enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role!: UserRole;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: dateColumnType, nullable: true })
  lastLogin?: Date;

  @OneToMany(() => Group, (group) => group.owner)
  ownedGroups!: Relation<Group[]>;

  @OneToMany(() => Group, (group) => group.members)
  groups!: Relation<Group[]>;

  @OneToMany(() => Message, (message) => message.sender)
  messages!: Relation<Message[]>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.password && !this.password.startsWith('$2a$')) {
      this.password = await bcrypt.hash(this.password, 10);
    }
  }

  async validatePassword(password: string): Promise<boolean> {
    if (!password || !this.password) return false;
    return bcrypt.compare(password, this.password);
  }

  toJSON() {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...user } = this;
    return user;
  }
}
