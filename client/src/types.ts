export interface Participant {
    id: string; // Socket ID
    name: string;
}

export interface Rule {
    id: string;
    label: string;
    weight: number; // For physics simulation size/probability if needed, or just visual
}

export interface GameState {
    participants: Participant[];
    rules: Rule[];
    status: 'waiting' | 'playing' | 'finished';
    simulationId?: string; // To sync specific runs
}

export type GameMode = 'all_results' | 'winner_only' | 'loser_only';

export interface EmoticonMessage {
    userId: string;
    userName: string;
    emoticon: string;
    timestamp: number;
}

export interface UserNotification {
    userName: string;
    type: 'join' | 'leave';
    timestamp: number;
}

export interface ClientToServerEvents {
    join_room: (data: { roomName: string; userName: string }) => void;
    create_rule: (data: { roomName: string; rule: Rule }) => void;
    start_game: (data: { roomName: string }) => void;
    set_game_mode: (data: { roomName: string; mode: GameMode }) => void;
    send_emoticon: (data: { roomName: string; emoticon: string }) => void;
}

export interface ServerToClientEvents {
    participant_list: (participants: Participant[]) => void;
    rule_list: (rules: Rule[]) => void;
    game_started: (data: { simulationId: string; seed: number }) => void;
    host_status: (data: { isHost: boolean; hostId: string }) => void;
    game_mode_updated: (data: { mode: GameMode }) => void;
    error_message: (data: { message: string }) => void;
    error: (message: string) => void;
    emoticon_received: (data: EmoticonMessage) => void;
    user_notification: (data: UserNotification) => void;
}

// Dummy runtime export to ensure this file is treated as a module
export const TYPES_VERSION = '1.0.0';
