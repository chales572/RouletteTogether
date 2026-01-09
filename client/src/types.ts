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

// Room type: roulette (original) or betting (new mode)
export type RoomType = 'roulette' | 'betting';

// Betting mode types
export interface Bet {
    odrederId: string;
    odrerName: string;
    ruleId: string;
    timestamp: number;
}

export interface BettingState {
    bets: Bet[];
    bettingOpen: boolean;
    winningRuleId?: string;
    bettingTitle: string;
}

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

export interface ChatMessage {
    userId: string;
    userName: string;
    message: string;
    timestamp: number;
}

export interface DrawingData {
    odrawId: string;
    odrawType: 'pin' | 'line';
    x: number;
    y: number;
    x2?: number;
    y2?: number;
    userId: string;
    userName: string;
}

export interface ClientToServerEvents {
    join_room: (data: { roomName: string; userName: string; roomType?: RoomType }) => void;
    create_rule: (data: { roomName: string; rule: Rule }) => void;
    start_game: (data: { roomName: string }) => void;
    set_game_mode: (data: { roomName: string; mode: GameMode }) => void;
    send_emoticon: (data: { roomName: string; emoticon: string }) => void;
    send_chat: (data: { roomName: string; message: string }) => void;
    kick_user: (data: { roomName: string; userId: string }) => void;
    destroy_room: (data: { roomName: string }) => void;
    request_host_status: (data: { roomName: string }) => void;
    draw_object: (data: { roomName: string; drawing: DrawingData }) => void;
    request_room_sync: (data: { roomName: string }) => void;
    report_result: (data: { roomName: string; result: GameResult }) => void;
    clear_results: (data: { roomName: string }) => void;
    game_finished: (data: { roomName: string }) => void;
    // Betting mode events
    set_betting_title: (data: { roomName: string; title: string }) => void;
    place_bet: (data: { roomName: string; ruleId: string }) => void;
    close_betting: (data: { roomName: string }) => void;
    select_winner: (data: { roomName: string; ruleId: string }) => void;
    reset_betting: (data: { roomName: string }) => void;
}

export interface GameResult {
    participantId: string;
    participantName: string;
    ruleId: string;
    ruleLabel: string;
    order: number; // Arrival order (1 = first, 2 = second, etc.)
    timestamp: number;
}

export interface RoomSyncData {
    participants: Participant[];
    rules: Rule[];
    drawings: DrawingData[];
    gameMode: GameMode;
    status: 'waiting' | 'playing' | 'finished';
    hostId: string;
    gameResults: GameResult[]; // Results from last game
    roomType: RoomType;
    bettingState?: BettingState;
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
    chat_received: (data: ChatMessage) => void;
    user_notification: (data: UserNotification) => void;
    kicked: () => void;
    room_destroyed: () => void;
    drawing_received: (data: DrawingData) => void;
    room_sync: (data: RoomSyncData) => void;
    game_reset: () => void;
    // Betting mode events
    room_type: (data: { roomType: RoomType }) => void;
    betting_state_updated: (data: BettingState) => void;
    betting_result: (data: { winningRuleId: string; winners: Participant[]; losers: Participant[] }) => void;
}

// Dummy runtime export to ensure this file is treated as a module
export const TYPES_VERSION = '1.0.0';
