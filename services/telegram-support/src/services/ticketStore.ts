export interface Ticket {
  userId: number;
  username?: string;
  displayName: string;
  source?: string;
  siteUserId?: string;
  createdAt: number;
}

/** Maps support-group message_id → user ticket */
const ticketsByGroupMessage = new Map<number, Ticket>();

let ticketCounter = 0;

export function nextTicketNumber(): number {
  ticketCounter += 1;
  return ticketCounter;
}

export function saveTicket(groupMessageId: number, ticket: Ticket): void {
  ticketsByGroupMessage.set(groupMessageId, ticket);
}

export function getTicketByGroupMessage(groupMessageId: number): Ticket | undefined {
  return ticketsByGroupMessage.get(groupMessageId);
}

export function ticketCount(): number {
  return ticketsByGroupMessage.size;
}
