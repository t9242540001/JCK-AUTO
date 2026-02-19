// In-memory store для пользователей бота

export interface BotUser {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  phone?: string;
  registeredAt: Date;
}

const users = new Map<number, BotUser>();

export function saveUser(from: { id: number; first_name: string; last_name?: string; username?: string }): BotUser {
  const existing = users.get(from.id);
  const user: BotUser = {
    id: from.id,
    firstName: from.first_name,
    lastName: from.last_name,
    username: from.username,
    phone: existing?.phone,
    registeredAt: existing?.registeredAt ?? new Date(),
  };
  users.set(from.id, user);
  return user;
}

export function savePhone(userId: number, phone: string): void {
  const user = users.get(userId);
  if (user) user.phone = phone;
}

export function getUser(userId: number): BotUser | undefined {
  return users.get(userId);
}
