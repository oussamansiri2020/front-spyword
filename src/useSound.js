/**
 * useSound – Web Audio API sound engine for SpyWord.
 * No external files required; all sounds are synthesised.
 */
import { useRef, useCallback, useEffect } from 'react';

function getAudioContext() {
    if (!window._spyAudioCtx) {
        window._spyAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return window._spyAudioCtx;
}

// ── Low-level helpers ────────────────────────────────────────────────────────

function playTone(ctx, freq, type, startTime, duration, gain = 0.4, fadeOut = true) {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    gainNode.gain.setValueAtTime(gain, startTime);
    if (fadeOut) gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
}

function playNote(ctx, freq, startTime, duration, gain = 0.35) {
    playTone(ctx, freq, 'sine', startTime, duration, gain);
}

// ── Sound recipes ────────────────────────────────────────────────────────────

/** Short click / pop */
function sfxClick(ctx) {
    const t = ctx.currentTime;
    playTone(ctx, 800, 'square', t, 0.06, 0.15);
}

/** Welcoming jingle when game starts */
function sfxGameStart(ctx) {
    const t = ctx.currentTime;
    const notes = [261.6, 329.6, 392.0, 523.2]; // C4 E4 G4 C5
    notes.forEach((f, i) => playNote(ctx, f, t + i * 0.12, 0.25, 0.3));
}

/** Tense beep per second when timer ticks */
function sfxTimerTick(ctx, seconds) {
    const t = ctx.currentTime;
    const freq = seconds <= 5 ? 880 : 660;
    const gain = seconds <= 5 ? 0.25 : 0.12;
    playTone(ctx, freq, 'square', t, 0.05, gain);
}

/** Urgent alarm when time runs out */
function sfxTimeUp(ctx) {
    const t = ctx.currentTime;
    [0, 0.15, 0.30].forEach(offset => playTone(ctx, 440, 'sawtooth', t + offset, 0.12, 0.3));
}

/** Voting phase – mysterious low pulse */
function sfxVoting(ctx) {
    const t = ctx.currentTime;
    [130.8, 110.0, 130.8].forEach((f, i) =>
        playNote(ctx, f, t + i * 0.25, 0.4, 0.25)
    );
}

/** Imposter caught – sad descending scale */
function sfxImposterCaught(ctx) {
    const t = ctx.currentTime;
    [523, 466, 415, 370, 330].forEach((f, i) =>
        playNote(ctx, f, t + i * 0.1, 0.18, 0.3)
    );
}

/** Citizens win – triumphant ascending fanfare */
function sfxCitizensWin(ctx) {
    const t = ctx.currentTime;
    [330, 392, 494, 587, 659].forEach((f, i) =>
        playNote(ctx, f, t + i * 0.11, 0.22, 0.35)
    );
}

/** Imposter wins – eerie resolved chord */
function sfxImposterWins(ctx) {
    const t = ctx.currentTime;
    [220, 261, 311].forEach(f => playNote(ctx, f, t, 0.8, 0.2));
}

/** Elimination / player kicked */
function sfxEliminated(ctx) {
    const t = ctx.currentTime;
    playTone(ctx, 300, 'sawtooth', t, 0.1, 0.3);
    playTone(ctx, 200, 'sawtooth', t + 0.12, 0.2, 0.25);
}

/** Your turn notification */
function sfxYourTurn(ctx) {
    const t = ctx.currentTime;
    [440, 554, 660].forEach((f, i) => playNote(ctx, f, t + i * 0.09, 0.15, 0.3));
}

/** Word submitted */
function sfxWordSent(ctx) {
    const t = ctx.currentTime;
    playNote(ctx, 660, t, 0.08, 0.2);
    playNote(ctx, 880, t + 0.1, 0.08, 0.15);
}

/** Join lobby sound */
function sfxPlayerJoined(ctx) {
    const t = ctx.currentTime;
    playNote(ctx, 440, t, 0.1, 0.2);
    playNote(ctx, 550, t + 0.1, 0.12, 0.2);
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useSound() {
    const mutedRef = useRef(false);
    const prevTurnPlayerRef = useRef(null);

    const play = useCallback((fn) => {
        if (mutedRef.current) return;
        try {
            const ctx = getAudioContext();
            if (ctx.state === 'suspended') ctx.resume();
            fn(ctx);
        } catch (e) {
            console.warn('Audio error:', e);
        }
    }, []);

    const sounds = {
        click: () => play(sfxClick),
        gameStart: () => play(sfxGameStart),
        timerTick: (s) => play((ctx) => sfxTimerTick(ctx, s)),
        timeUp: () => play(sfxTimeUp),
        voting: () => play(sfxVoting),
        imposterCaught: () => play(sfxImposterCaught),
        citizensWin: () => play(sfxCitizensWin),
        imposterWins: () => play(sfxImposterWins),
        eliminated: () => play(sfxEliminated),
        yourTurn: () => play(sfxYourTurn),
        wordSent: () => play(sfxWordSent),
        playerJoined: () => play(sfxPlayerJoined),
        setMuted: (v) => { mutedRef.current = v; },
        isMuted: () => mutedRef.current,
        prevTurnPlayerRef,
    };

    return sounds;
}
