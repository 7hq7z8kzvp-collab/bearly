
export enum TaskStatus {
  PENDING = 'PENDING',
  COUNTDOWN = 'COUNTDOWN',
  WAITING_FOR_START_CONFIRMATION = 'WAITING_FOR_START_CONFIRMATION',
  WAITING_FOR_COMPLETION = 'WAITING_FOR_COMPLETION',
  BLOCKED = 'BLOCKED',
  COMPLETED = 'COMPLETED'
}

export interface Task {
  id: string;
  title: string;
  scheduledTime: number; // Date.now() timestamp
  status: TaskStatus;
  retryCount: number;
  lastActionTime: number;
  category?: string;
  priority?: number; // 1 (High) to 3 (Low)
  imageUrl?: string;
  isParsing?: boolean;
  isImageLoading?: boolean;
  modalDismissed?: boolean;
}

export interface VoiceConfig {
  name: string;
}
