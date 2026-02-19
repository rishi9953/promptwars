import * as Tone from 'tone';

class AudioSystem {
    private synth: Tone.PolySynth;
    private membrane: Tone.MembraneSynth;
    private metal: Tone.MetalSynth;
    private noise: Tone.NoiseSynth;
    private bgmLoop: Tone.Loop | null = null;
    private isInitialized = false;

    constructor() {
        this.synth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: "sawtooth" },
            envelope: { attack: 0.1, decay: 0.3, sustain: 0.4, release: 2 }
        }).toDestination();
        this.synth.volume.value = -12;

        this.membrane = new Tone.MembraneSynth().toDestination();
        this.membrane.volume.value = -10;

        this.metal = new Tone.MetalSynth({
            envelope: { attack: 0.001, decay: 0.1, release: 0.01 },
            harmonicity: 5.1,
            modulationIndex: 32,
            resonance: 4000,
            octaves: 1.5
        }).toDestination();
        this.metal.volume.value = -15;

        this.noise = new Tone.NoiseSynth({
            noise: { type: 'pink' },
            envelope: { attack: 0.005, decay: 0.1, sustain: 0 }
        }).toDestination();
        this.noise.volume.value = -20;
    }

    async init() {
        if (!this.isInitialized) {
            await Tone.start();
            this.isInitialized = true;
        }
        this.startBGM();
    }

    startBGM() {
        if (this.bgmLoop) return;

        // Rhythmic Game Synth BGM
        const bassSynth = new Tone.MonoSynth({
            oscillator: { type: "triangle" },
            envelope: { attack: 0.1, decay: 0.2, sustain: 0.4, release: 0.1 },
            filter: { Q: 2, type: "lowpass", rolloff: -12 },
            filterEnvelope: { attack: 0.05, decay: 0.2, sustain: 0.2, baseFrequency: 200, octaves: 3 }
        }).toDestination();
        bassSynth.volume.value = -15;

        const synthLead = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: "square" },
            envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 1 }
        }).toDestination();
        synthLead.volume.value = -20;

        const kick = new Tone.MembraneSynth().toDestination();
        kick.volume.value = -10;

        const bassSequence = ["C2", "C2", "Eb2", "F2", "C2", "C2", "Bb1", "G1"];
        const leadSequence = ["G3", null, "Bb3", "C4", "G3", null, "F3", "Eb3"];
        let step = 0;

        this.bgmLoop = new Tone.Loop(time => {
            // Bass
            bassSynth.triggerAttackRelease(bassSequence[step % bassSequence.length], "8n", time);

            // Kick on every beat
            if (step % 4 === 0) kick.triggerAttackRelease("C1", "8n", time);

            // Lead
            const note = leadSequence[step % leadSequence.length];
            if (note) synthLead.triggerAttackRelease(note, "16n", time);

            step++;
        }, "8n").start(0);

        Tone.Transport.bpm.value = 110;
        Tone.Transport.start();
    }

    stopBGM() {
        if (this.bgmLoop) {
            this.bgmLoop.stop();
            this.bgmLoop.dispose();
            this.bgmLoop = null;
        }
        Tone.Transport.stop();
    }

    playJump() {
        if (!this.isInitialized) return;
        this.membrane.triggerAttackRelease("C2", "8n");
    }

    playShoot() {
        if (!this.isInitialized) return;
        this.noise.triggerAttackRelease("32n");
        this.synth.triggerAttackRelease("C6", "32n", undefined, 0.1);
    }

    playImpact() {
        if (!this.isInitialized) return;
        this.metal.triggerAttackRelease("16n", undefined, 1); // Metallic crash
        this.noise.triggerAttackRelease("16n"); // Burst
    }

    playFreeze() {
        if (!this.isInitialized) return;
        this.metal.triggerAttackRelease("32n", undefined, 2);
    }

    playPowerUp() {
        if (!this.isInitialized) return;
        const now = Tone.now();
        this.synth.triggerAttackRelease("C5", "16n", now);
        this.synth.triggerAttackRelease("E5", "16n", now + 0.1);
        this.synth.triggerAttackRelease("G5", "16n", now + 0.2);
    }

    toggleMute(): boolean {
        Tone.getDestination().mute = !Tone.getDestination().mute;
        return Tone.getDestination().mute;
    }

    getIsMuted(): boolean {
        return Tone.getDestination().mute;
    }

    playGameOver() {
        if (!this.isInitialized) return;
        const now = Tone.now();
        this.synth.triggerAttackRelease("C3", "4n", now);
        this.synth.triggerAttackRelease("Eb3", "4n", now + 0.5);
        this.synth.triggerAttackRelease("C2", "2n", now + 1.0);
        this.stopBGM();
    }
}

export const audioSystem = new AudioSystem();
