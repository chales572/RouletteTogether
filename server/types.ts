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

export interface ClientToServerEvents {
    join_room: (data: { roomName: string; userName: string }) => void;
    create_rule: (data: { roomName: string; rule: Rule }) => void;
    start_game: (data: { roomName: string }) => void;
}

export interface ServerToClientEvents {
    participant_list: (participants: Participant[]) => void;
    rule_list: (rules: Rule[]) => void;
    game_started: (data: { simulationId: string; seed: number }) => void;
    error: (message: string) => void;
}
