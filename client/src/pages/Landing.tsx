import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GameMode } from '../types';

interface LandingProps {
    onJoin: (roomName: string, userName: string, gameMode?: GameMode) => void;
}

const Landing: React.FC<LandingProps> = ({ onJoin }) => {
    const [name, setName] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [mode, setMode] = useState<'select' | 'create' | 'join'>('select');
    const [selectedGameMode, setSelectedGameMode] = useState<GameMode>('all_results');
    const navigate = useNavigate();

    const generateInviteCode = () => {
        // Generate 6-character alphanumeric code
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    };

    const handleCreateRoom = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim()) {
            const code = generateInviteCode();
            onJoin(code, name, selectedGameMode);
            navigate(`/room/${code}`);
        }
    };

    const handleJoinRoom = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim() && inviteCode.trim()) {
            onJoin(inviteCode.toUpperCase(), name);
            navigate(`/room/${inviteCode.toUpperCase()}`);
        }
    };

    if (mode === 'select') {
        return (
            <div className="landing-container">
                <div className="glass-card">
                    <h1 className="title">룰렛 투게더</h1>
                    <div className="mode-selection">
                        <button
                            className="btn-primary mode-btn"
                            onClick={() => setMode('create')}
                        >
                            방 만들기
                        </button>
                        <button
                            className="btn-secondary mode-btn"
                            onClick={() => setMode('join')}
                        >
                            방 참가하기
                        </button>
                    </div>
                </div>
                <style>{`
                    .mode-selection {
                        display: flex;
                        flex-direction: column;
                        gap: 1rem;
                        margin-top: 2rem;
                    }
                    .mode-btn {
                        width: 100%;
                        padding: 1.5rem;
                        font-size: 1.1rem;
                    }
                `}</style>
            </div>
        );
    }

    if (mode === 'create') {
        return (
            <div className="landing-container">
                <div className="glass-card">
                    <button className="back-btn" onClick={() => setMode('select')}>← 뒤로</button>
                    <h1 className="title">방 만들기</h1>
                    <form onSubmit={handleCreateRoom} className="form">
                        <div className="input-group">
                            <label htmlFor="name">이름</label>
                            <input
                                id="name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="이름을 입력하세요"
                                required
                            />
                        </div>
                        <div className="input-group">
                            <label>게임 모드</label>
                            <div className="game-mode-select">
                                <button
                                    type="button"
                                    className={`mode-option ${selectedGameMode === 'all_results' ? 'active' : ''}`}
                                    onClick={() => setSelectedGameMode('all_results')}
                                >
                                    전체 결과
                                    <small>모든 참가자의 결과 표시</small>
                                </button>
                                <button
                                    type="button"
                                    className={`mode-option ${selectedGameMode === 'winner_only' ? 'active' : ''}`}
                                    onClick={() => setSelectedGameMode('winner_only')}
                                >
                                    1등만
                                    <small>첫 번째 완료자만 표시</small>
                                </button>
                                <button
                                    type="button"
                                    className={`mode-option ${selectedGameMode === 'loser_only' ? 'active' : ''}`}
                                    onClick={() => setSelectedGameMode('loser_only')}
                                >
                                    꼴찌만
                                    <small>마지막 완료자 표시</small>
                                </button>
                            </div>
                        </div>
                        <div className="info-box">
                            방을 만들면 자동으로 초대 코드가 생성됩니다.
                            다른 사람들과 코드를 공유하세요!
                        </div>
                        <button type="submit" className="btn-primary">
                            방 만들기
                        </button>
                    </form>
                </div>
                <style>{`
                    .back-btn {
                        background: none;
                        border: none;
                        color: var(--primary-color);
                        cursor: pointer;
                        font-size: 1rem;
                        margin-bottom: 1rem;
                        padding: 0.5rem;
                    }
                    .back-btn:hover {
                        opacity: 0.8;
                    }
                    .info-box {
                        background: rgba(255, 255, 255, 0.05);
                        border-radius: 8px;
                        padding: 1rem;
                        margin: 1rem 0;
                        font-size: 0.9rem;
                        color: rgba(255, 255, 255, 0.7);
                    }
                    .game-mode-select {
                        display: flex;
                        flex-direction: column;
                        gap: 0.5rem;
                        margin-top: 0.5rem;
                    }
                    .mode-option {
                        background: rgba(255, 255, 255, 0.05);
                        border: 2px solid rgba(255, 255, 255, 0.1);
                        border-radius: 8px;
                        padding: 1rem;
                        color: white;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        text-align: left;
                        display: flex;
                        flex-direction: column;
                        gap: 0.3rem;
                    }
                    .mode-option small {
                        font-size: 0.8rem;
                        color: rgba(255, 255, 255, 0.6);
                    }
                    .mode-option:hover {
                        background: rgba(255, 255, 255, 0.1);
                        border-color: rgba(255, 255, 255, 0.3);
                    }
                    .mode-option.active {
                        background: linear-gradient(135deg, #667eea, #764ba2);
                        border-color: #667eea;
                        font-weight: bold;
                    }
                    .mode-option.active small {
                        color: rgba(255, 255, 255, 0.9);
                    }
                `}</style>
            </div>
        );
    }

    // mode === 'join'
    return (
        <div className="landing-container">
            <div className="glass-card">
                <button className="back-btn" onClick={() => setMode('select')}>← 뒤로</button>
                <h1 className="title">방 참가하기</h1>
                <form onSubmit={handleJoinRoom} className="form">
                    <div className="input-group">
                        <label htmlFor="name">이름</label>
                        <input
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="이름을 입력하세요"
                            required
                        />
                    </div>
                    <div className="input-group">
                        <label htmlFor="inviteCode">초대 코드</label>
                        <input
                            id="inviteCode"
                            type="text"
                            value={inviteCode}
                            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                            placeholder="6자리 초대 코드 입력"
                            maxLength={6}
                            style={{ textTransform: 'uppercase', letterSpacing: '0.2em', fontSize: '1.2rem', textAlign: 'center' }}
                            required
                        />
                    </div>
                    <button type="submit" className="btn-primary">
                        방 참가하기
                    </button>
                </form>
            </div>
            <style>{`
                .back-btn {
                    background: none;
                    border: none;
                    color: var(--primary-color);
                    cursor: pointer;
                    font-size: 1rem;
                    margin-bottom: 1rem;
                    padding: 0.5rem;
                }
                .back-btn:hover {
                    opacity: 0.8;
                }
            `}</style>
        </div>
    );
};

export default Landing;
