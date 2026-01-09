import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GameMode, RoomType } from '../types';

interface LandingProps {
    onJoin: (roomName: string, userName: string, gameMode?: GameMode, roomType?: RoomType) => void;
}

const Landing: React.FC<LandingProps> = ({ onJoin }) => {
    const [name, setName] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [mode, setMode] = useState<'select' | 'create' | 'join'>('select');
    const [selectedGameMode, setSelectedGameMode] = useState<GameMode>('all_results');
    const [selectedRoomType, setSelectedRoomType] = useState<RoomType>('roulette');
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
            onJoin(code, name, selectedGameMode, selectedRoomType);
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
            <div className="landing-page">
                <div className="hero-background">
                    <div className="floating-ball ball-1"></div>
                    <div className="floating-ball ball-2"></div>
                    <div className="floating-ball ball-3"></div>
                    <div className="floating-ball ball-4"></div>
                    <div className="floating-ball ball-5"></div>
                    <div className="floating-ball ball-6"></div>
                    <div className="glow-effect"></div>
                </div>
                <div className="landing-hero">
                    <div className="hero-content">
                        <div className="logo-container">
                            <div className="roulette-icon">
                                <div className="roulette-wheel">
                                    <div className="wheel-inner"></div>
                                    <div className="wheel-pointer"></div>
                                </div>
                            </div>
                        </div>
                        <h1 className="hero-title">룰렛 투게더</h1>
                        <p className="hero-subtitle">친구들과 함께하는 실시간 룰렛 게임</p>
                        <div className="hero-buttons">
                            <button
                                className="hero-btn hero-btn-primary"
                                onClick={() => setMode('create')}
                            >
                                <span className="btn-icon">+</span>
                                방 만들기
                            </button>
                            <button
                                className="hero-btn hero-btn-secondary"
                                onClick={() => setMode('join')}
                            >
                                <span className="btn-icon">&rarr;</span>
                                방 참가하기
                            </button>
                        </div>
                        <div className="hero-features">
                            <div className="feature">
                                <span className="feature-icon">*</span>
                                <span>실시간 동기화</span>
                            </div>
                            <div className="feature">
                                <span className="feature-icon">@</span>
                                <span>다양한 게임 모드</span>
                            </div>
                            <div className="feature">
                                <span className="feature-icon">#</span>
                                <span>그리기 기능</span>
                            </div>
                        </div>
                    </div>
                </div>
                <style>{`
                    .landing-page {
                        min-height: 100vh;
                        width: 100%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 20px;
                        position: relative;
                        overflow: hidden;
                        box-sizing: border-box;
                    }
                    .hero-background {
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        pointer-events: none;
                        z-index: 0;
                    }
                    .glow-effect {
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        width: 600px;
                        height: 600px;
                        background: radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, rgba(129, 140, 248, 0.1) 40%, transparent 70%);
                        animation: pulse 4s ease-in-out infinite;
                    }
                    @keyframes pulse {
                        0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
                        50% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
                    }
                    .landing-hero {
                        text-align: center;
                        position: relative;
                        z-index: 1;
                        width: 100%;
                        max-width: 500px;
                        margin: 0 auto;
                    }
                    .floating-ball {
                        position: absolute;
                        border-radius: 50%;
                        opacity: 0.5;
                        animation: float 8s ease-in-out infinite;
                    }
                    .ball-1 {
                        width: 100px;
                        height: 100px;
                        background: linear-gradient(135deg, #ff6b6b, #ee5a6f);
                        top: 8%;
                        left: 8%;
                        animation-delay: 0s;
                    }
                    .ball-2 {
                        width: 70px;
                        height: 70px;
                        background: linear-gradient(135deg, #feca57, #ff9f43);
                        top: 15%;
                        right: 12%;
                        animation-delay: 1.5s;
                    }
                    .ball-3 {
                        width: 120px;
                        height: 120px;
                        background: linear-gradient(135deg, #54a0ff, #2e86de);
                        bottom: 15%;
                        left: 5%;
                        animation-delay: 3s;
                    }
                    .ball-4 {
                        width: 60px;
                        height: 60px;
                        background: linear-gradient(135deg, #5f27cd, #341f97);
                        bottom: 25%;
                        right: 8%;
                        animation-delay: 4.5s;
                    }
                    .ball-5 {
                        width: 80px;
                        height: 80px;
                        background: linear-gradient(135deg, #48dbfb, #0abde3);
                        top: 45%;
                        right: 5%;
                        animation-delay: 2s;
                    }
                    .ball-6 {
                        width: 50px;
                        height: 50px;
                        background: linear-gradient(135deg, #f472b6, #ec4899);
                        top: 60%;
                        left: 10%;
                        animation-delay: 5s;
                    }
                    @keyframes float {
                        0%, 100% {
                            transform: translateY(0) rotate(0deg) scale(1);
                        }
                        25% {
                            transform: translateY(-20px) rotate(90deg) scale(1.05);
                        }
                        50% {
                            transform: translateY(-40px) rotate(180deg) scale(1);
                        }
                        75% {
                            transform: translateY(-20px) rotate(270deg) scale(0.95);
                        }
                    }
                    .hero-content {
                        position: relative;
                        z-index: 2;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                    }
                    .logo-container {
                        margin-bottom: 2rem;
                    }
                    .roulette-icon {
                        width: 140px;
                        height: 140px;
                        margin: 0 auto;
                        position: relative;
                    }
                    .roulette-wheel {
                        width: 100%;
                        height: 100%;
                        border-radius: 50%;
                        background: conic-gradient(
                            #ff6b6b 0deg 60deg,
                            #feca57 60deg 120deg,
                            #54a0ff 120deg 180deg,
                            #5f27cd 180deg 240deg,
                            #48dbfb 240deg 300deg,
                            #ff9f43 300deg 360deg
                        );
                        animation: spin 10s linear infinite;
                        box-shadow: 0 0 60px rgba(56, 189, 248, 0.4),
                                    0 0 100px rgba(129, 140, 248, 0.2),
                                    inset 0 0 30px rgba(0, 0, 0, 0.3);
                        position: relative;
                    }
                    .wheel-inner {
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        width: 50px;
                        height: 50px;
                        background: linear-gradient(135deg, #1e293b, #0f172a);
                        border-radius: 50%;
                        box-shadow: 0 0 15px rgba(0, 0, 0, 0.5);
                        border: 3px solid rgba(255, 255, 255, 0.2);
                    }
                    .wheel-pointer {
                        position: absolute;
                        top: -15px;
                        left: 50%;
                        transform: translateX(-50%);
                        width: 0;
                        height: 0;
                        border-left: 12px solid transparent;
                        border-right: 12px solid transparent;
                        border-top: 20px solid #ffd700;
                        filter: drop-shadow(0 0 10px rgba(255, 215, 0, 0.5));
                    }
                    @keyframes spin {
                        from {
                            transform: rotate(0deg);
                        }
                        to {
                            transform: rotate(360deg);
                        }
                    }
                    .hero-title {
                        font-size: 4rem;
                        font-weight: 800;
                        margin: 0 0 1rem 0;
                        background: linear-gradient(135deg, #38bdf8 0%, #818cf8 50%, #f472b6 100%);
                        -webkit-background-clip: text;
                        -webkit-text-fill-color: transparent;
                        background-clip: text;
                        letter-spacing: -0.02em;
                        animation: titleGlow 3s ease-in-out infinite;
                    }
                    @keyframes titleGlow {
                        0%, 100% { filter: drop-shadow(0 0 20px rgba(56, 189, 248, 0.3)); }
                        50% { filter: drop-shadow(0 0 40px rgba(129, 140, 248, 0.5)); }
                    }
                    .hero-subtitle {
                        font-size: 1.3rem;
                        color: rgba(255, 255, 255, 0.8);
                        margin: 0 0 3rem 0;
                        font-weight: 400;
                    }
                    .hero-buttons {
                        display: flex;
                        flex-direction: column;
                        gap: 1.25rem;
                        width: 100%;
                        max-width: 340px;
                        margin: 0 auto 3rem auto;
                    }
                    .hero-btn {
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 0.75rem;
                        padding: 1.4rem 2.5rem;
                        font-size: 1.25rem;
                        font-weight: 600;
                        border: none;
                        border-radius: 20px;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        position: relative;
                        overflow: hidden;
                    }
                    .hero-btn::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: -100%;
                        width: 100%;
                        height: 100%;
                        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
                        transition: left 0.6s;
                    }
                    .hero-btn:hover::before {
                        left: 100%;
                    }
                    .hero-btn-primary {
                        background: linear-gradient(135deg, #38bdf8, #818cf8, #f472b6);
                        background-size: 200% 200%;
                        color: white;
                        box-shadow: 0 10px 40px rgba(56, 189, 248, 0.4);
                        animation: gradientShift 5s ease infinite;
                    }
                    @keyframes gradientShift {
                        0% { background-position: 0% 50%; }
                        50% { background-position: 100% 50%; }
                        100% { background-position: 0% 50%; }
                    }
                    .hero-btn-primary:hover {
                        transform: translateY(-4px) scale(1.02);
                        box-shadow: 0 15px 50px rgba(56, 189, 248, 0.5);
                    }
                    .hero-btn-secondary {
                        background: rgba(255, 255, 255, 0.08);
                        color: white;
                        border: 2px solid rgba(255, 255, 255, 0.25);
                        backdrop-filter: blur(10px);
                    }
                    .hero-btn-secondary:hover {
                        background: rgba(255, 255, 255, 0.15);
                        border-color: rgba(255, 255, 255, 0.4);
                        transform: translateY(-4px);
                        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
                    }
                    .btn-icon {
                        font-size: 1.5rem;
                        font-weight: bold;
                    }
                    .hero-features {
                        display: flex;
                        justify-content: center;
                        gap: 2.5rem;
                        flex-wrap: wrap;
                    }
                    .feature {
                        display: flex;
                        align-items: center;
                        gap: 0.6rem;
                        color: rgba(255, 255, 255, 0.7);
                        font-size: 0.95rem;
                    }
                    .feature-icon {
                        width: 32px;
                        height: 32px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: rgba(255, 255, 255, 0.1);
                        border-radius: 10px;
                        font-size: 1.1rem;
                    }
                    @media (max-width: 480px) {
                        .hero-title {
                            font-size: 2.8rem;
                        }
                        .hero-subtitle {
                            font-size: 1.1rem;
                        }
                        .hero-features {
                            gap: 1.5rem;
                        }
                        .feature {
                            font-size: 0.85rem;
                        }
                        .roulette-icon {
                            width: 110px;
                            height: 110px;
                        }
                    }
                `}</style>
            </div>
        );
    }

    if (mode === 'create') {
        return (
            <div className="landing-page">
                <div className="form-container">
                    <button className="back-btn" onClick={() => setMode('select')}>
                        <span>&larr;</span> 뒤로
                    </button>
                    <h1 className="form-title">방 만들기</h1>
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
                            <label>방 타입</label>
                            <div className="room-type-select">
                                <button
                                    type="button"
                                    className={`room-type-option ${selectedRoomType === 'roulette' ? 'active' : ''}`}
                                    onClick={() => setSelectedRoomType('roulette')}
                                >
                                    <span className="room-type-icon">🎰</span>
                                    <span className="room-type-title">룰렛</span>
                                    <span className="room-type-desc">공이 떨어지며 결과 결정</span>
                                </button>
                                <button
                                    type="button"
                                    className={`room-type-option ${selectedRoomType === 'betting' ? 'active' : ''}`}
                                    onClick={() => setSelectedRoomType('betting')}
                                >
                                    <span className="room-type-icon">🎲</span>
                                    <span className="room-type-title">내기</span>
                                    <span className="room-type-desc">참가자가 직접 선택</span>
                                </button>
                            </div>
                        </div>
                        {selectedRoomType === 'roulette' && (
                            <div className="input-group">
                                <label>게임 모드</label>
                                <div className="game-mode-select">
                                    <button
                                        type="button"
                                        className={`mode-option ${selectedGameMode === 'all_results' ? 'active' : ''}`}
                                        onClick={() => setSelectedGameMode('all_results')}
                                    >
                                        <span className="mode-title">전체 결과</span>
                                        <span className="mode-desc">모든 참가자의 결과 표시</span>
                                    </button>
                                    <button
                                        type="button"
                                        className={`mode-option ${selectedGameMode === 'winner_only' ? 'active' : ''}`}
                                        onClick={() => setSelectedGameMode('winner_only')}
                                    >
                                        <span className="mode-title">1등만</span>
                                        <span className="mode-desc">첫 번째 완료자만 표시</span>
                                    </button>
                                    <button
                                        type="button"
                                        className={`mode-option ${selectedGameMode === 'loser_only' ? 'active' : ''}`}
                                        onClick={() => setSelectedGameMode('loser_only')}
                                    >
                                        <span className="mode-title">꼴찌만</span>
                                        <span className="mode-desc">마지막 완료자 표시</span>
                                    </button>
                                </div>
                            </div>
                        )}
                        <div className="info-box">
                            <span className="info-icon">i</span>
                            {selectedRoomType === 'roulette'
                                ? '방을 만들면 자동으로 초대 코드가 생성됩니다. 다른 사람들과 코드를 공유하세요!'
                                : '내기 모드: 방장이 선택지를 만들고, 참가자들이 원하는 선택지에 베팅합니다. 마감 후 방장이 승자를 결정합니다.'}
                        </div>
                        <button type="submit" className="submit-btn">
                            방 만들기
                        </button>
                    </form>
                </div>
                <style>{`
                    .landing-page {
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 20px;
                    }
                    .form-container {
                        width: 100%;
                        max-width: 420px;
                        background: rgba(255, 255, 255, 0.05);
                        backdrop-filter: blur(20px);
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        border-radius: 24px;
                        padding: 2.5rem;
                        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
                    }
                    .back-btn {
                        display: flex;
                        align-items: center;
                        gap: 0.5rem;
                        background: none;
                        border: none;
                        color: rgba(255, 255, 255, 0.6);
                        cursor: pointer;
                        font-size: 1rem;
                        margin-bottom: 1.5rem;
                        padding: 0.5rem 0;
                        transition: color 0.3s;
                    }
                    .back-btn:hover {
                        color: white;
                    }
                    .form-title {
                        font-size: 2rem;
                        font-weight: 700;
                        margin: 0 0 2rem 0;
                        text-align: center;
                        background: linear-gradient(135deg, #38bdf8, #818cf8);
                        -webkit-background-clip: text;
                        -webkit-text-fill-color: transparent;
                        background-clip: text;
                    }
                    .form {
                        display: flex;
                        flex-direction: column;
                        gap: 1.5rem;
                    }
                    .input-group {
                        display: flex;
                        flex-direction: column;
                        gap: 0.5rem;
                    }
                    .input-group label {
                        font-size: 0.9rem;
                        color: rgba(255, 255, 255, 0.7);
                        font-weight: 500;
                    }
                    .input-group input {
                        background: rgba(0, 0, 0, 0.3);
                        border: 2px solid rgba(255, 255, 255, 0.1);
                        padding: 1rem;
                        border-radius: 12px;
                        color: white;
                        font-size: 1rem;
                        transition: border-color 0.3s, background 0.3s;
                    }
                    .input-group input:focus {
                        outline: none;
                        border-color: #38bdf8;
                        background: rgba(0, 0, 0, 0.4);
                    }
                    .input-group input::placeholder {
                        color: rgba(255, 255, 255, 0.4);
                    }
                    .game-mode-select {
                        display: flex;
                        flex-direction: column;
                        gap: 0.75rem;
                    }
                    .mode-option {
                        background: rgba(255, 255, 255, 0.05);
                        border: 2px solid rgba(255, 255, 255, 0.1);
                        border-radius: 12px;
                        padding: 1rem 1.25rem;
                        color: white;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        text-align: left;
                        display: flex;
                        flex-direction: column;
                        gap: 0.25rem;
                    }
                    .mode-title {
                        font-weight: 600;
                        font-size: 1rem;
                    }
                    .mode-desc {
                        font-size: 0.8rem;
                        color: rgba(255, 255, 255, 0.5);
                    }
                    .mode-option:hover {
                        background: rgba(255, 255, 255, 0.1);
                        border-color: rgba(255, 255, 255, 0.2);
                    }
                    .mode-option.active {
                        background: linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(129, 140, 248, 0.2));
                        border-color: #38bdf8;
                    }
                    .mode-option.active .mode-desc {
                        color: rgba(255, 255, 255, 0.8);
                    }
                    .room-type-select {
                        display: flex;
                        gap: 1rem;
                    }
                    .room-type-option {
                        flex: 1;
                        background: rgba(255, 255, 255, 0.05);
                        border: 2px solid rgba(255, 255, 255, 0.1);
                        border-radius: 16px;
                        padding: 1.25rem;
                        color: white;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        text-align: center;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 0.5rem;
                    }
                    .room-type-icon {
                        font-size: 2.5rem;
                    }
                    .room-type-title {
                        font-weight: 700;
                        font-size: 1.1rem;
                    }
                    .room-type-desc {
                        font-size: 0.75rem;
                        color: rgba(255, 255, 255, 0.5);
                    }
                    .room-type-option:hover {
                        background: rgba(255, 255, 255, 0.1);
                        border-color: rgba(255, 255, 255, 0.2);
                        transform: translateY(-2px);
                    }
                    .room-type-option.active {
                        background: linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(129, 140, 248, 0.2));
                        border-color: #38bdf8;
                        box-shadow: 0 0 20px rgba(56, 189, 248, 0.2);
                    }
                    .room-type-option.active .room-type-desc {
                        color: rgba(255, 255, 255, 0.8);
                    }
                    .info-box {
                        display: flex;
                        align-items: flex-start;
                        gap: 0.75rem;
                        background: rgba(56, 189, 248, 0.1);
                        border: 1px solid rgba(56, 189, 248, 0.2);
                        border-radius: 12px;
                        padding: 1rem;
                        font-size: 0.9rem;
                        color: rgba(255, 255, 255, 0.8);
                        line-height: 1.5;
                    }
                    .info-icon {
                        width: 20px;
                        height: 20px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: rgba(56, 189, 248, 0.3);
                        border-radius: 50%;
                        font-size: 0.75rem;
                        font-weight: bold;
                        flex-shrink: 0;
                    }
                    .submit-btn {
                        background: linear-gradient(135deg, #38bdf8, #818cf8);
                        border: none;
                        padding: 1.25rem;
                        border-radius: 12px;
                        color: white;
                        font-weight: 600;
                        font-size: 1.1rem;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        box-shadow: 0 4px 20px rgba(56, 189, 248, 0.3);
                    }
                    .submit-btn:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 6px 25px rgba(56, 189, 248, 0.4);
                    }
                `}</style>
            </div>
        );
    }

    // mode === 'join'
    return (
        <div className="landing-page">
            <div className="form-container">
                <button className="back-btn" onClick={() => setMode('select')}>
                    <span>&larr;</span> 뒤로
                </button>
                <h1 className="form-title">방 참가하기</h1>
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
                            placeholder="ABC123"
                            maxLength={6}
                            className="code-input"
                            required
                        />
                    </div>
                    <button type="submit" className="submit-btn">
                        방 참가하기
                    </button>
                </form>
            </div>
            <style>{`
                .landing-page {
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                }
                .form-container {
                    width: 100%;
                    max-width: 420px;
                    background: rgba(255, 255, 255, 0.05);
                    backdrop-filter: blur(20px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 24px;
                    padding: 2.5rem;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
                }
                .back-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    background: none;
                    border: none;
                    color: rgba(255, 255, 255, 0.6);
                    cursor: pointer;
                    font-size: 1rem;
                    margin-bottom: 1.5rem;
                    padding: 0.5rem 0;
                    transition: color 0.3s;
                }
                .back-btn:hover {
                    color: white;
                }
                .form-title {
                    font-size: 2rem;
                    font-weight: 700;
                    margin: 0 0 2rem 0;
                    text-align: center;
                    background: linear-gradient(135deg, #38bdf8, #818cf8);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }
                .form {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }
                .input-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                .input-group label {
                    font-size: 0.9rem;
                    color: rgba(255, 255, 255, 0.7);
                    font-weight: 500;
                }
                .input-group input {
                    background: rgba(0, 0, 0, 0.3);
                    border: 2px solid rgba(255, 255, 255, 0.1);
                    padding: 1rem;
                    border-radius: 12px;
                    color: white;
                    font-size: 1rem;
                    transition: border-color 0.3s, background 0.3s;
                }
                .input-group input:focus {
                    outline: none;
                    border-color: #38bdf8;
                    background: rgba(0, 0, 0, 0.4);
                }
                .input-group input::placeholder {
                    color: rgba(255, 255, 255, 0.4);
                }
                .code-input {
                    text-transform: uppercase;
                    letter-spacing: 0.3em;
                    font-size: 1.5rem !important;
                    text-align: center;
                    font-weight: 600;
                    font-family: 'Courier New', monospace;
                }
                .submit-btn {
                    background: linear-gradient(135deg, #38bdf8, #818cf8);
                    border: none;
                    padding: 1.25rem;
                    border-radius: 12px;
                    color: white;
                    font-weight: 600;
                    font-size: 1.1rem;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 20px rgba(56, 189, 248, 0.3);
                }
                .submit-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 25px rgba(56, 189, 248, 0.4);
                }
            `}</style>
        </div>
    );
};

export default Landing;
