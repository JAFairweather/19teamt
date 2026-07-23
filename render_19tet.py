#!/usr/bin/env python3
"""
19TET WAV Renderer
==================
Enter notes from sheet music and render them as a WAV file in 19-tone equal temperament.
Uses a sax-like synthesizer with breathy attack, harmonics, and vibrato.

USAGE:
  python3 render_19tet.py

The note data is defined in the SCORE list below.
Each entry is: (note_name, octave, duration_in_beats)
  - Use 'R' for rests
  - Duration is in quarter-note beats at the given BPM
  - Note names: C, C#, Db, D, D#, Eb, E, E#, F, F#, Gb, G, G#, Ab, A, A#, Bb, B, B#

For alto sax transposition: the script assumes you enter WRITTEN pitch.
Set TRANSPOSE_SEMITONES_12TET to shift (e.g., -9 for alto sax Eb transposition
mapped to 19TET equivalent).

OUTPUT: closer_to_sun_19tet.wav
"""

import struct
import math
import random
import wave
import os

# ============================================================
#  CONFIGURATION
# ============================================================
BPM = 82
SAMPLE_RATE = 44100
OUTPUT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "closer_to_sun_19tet.wav")

# 19TET: each step = 1200/19 = ~63.158 cents
# Reference: A4 = 440 Hz (19TET step 0 of octave 4 maps to A)
STEPS_PER_OCTAVE = 19

# Mapping from note name to 19TET step offset within an octave
# In 19TET, the chromatic steps are distributed as:
#  C=0, C#=1, Db=2, D=3, D#=4, Eb=5, E=6, E#=7, F=8, F#=9,
#  Gb=10, G=11, G#=12, Ab=13, A=14, A#=15, Bb=16, B=17, B#=18
NOTE_TO_STEP = {
    'C': 0, 'C#': 1, 'Db': 2, 'D': 3, 'D#': 4,
    'Eb': 5, 'E': 6, 'E#': 7, 'Fb': 8, 'F': 8, 'F#': 9,
    'Gb': 10, 'G': 11, 'G#': 12, 'Ab': 13,
    'A': 14, 'A#': 15, 'Bb': 16, 'B': 17, 'B#': 18, 'Cb': 2,
    # Natural accidentals (used when a sharp is cancelled)
    'Cn': 0, 'Dn': 3, 'En': 6, 'Fn': 8, 'Gn': 11, 'An': 14, 'Bn': 17,
}

def note_to_freq(note_name, octave):
    """Convert a note name + octave to a 19TET frequency.
    Reference: A4 = 440 Hz, which is step 14 of octave 4."""
    step_in_oct = NOTE_TO_STEP[note_name]
    # Total 19TET steps from A4
    total_steps = (octave - 4) * 19 + (step_in_oct - 14)
    return 440.0 * (2.0 ** (total_steps / 19.0))


# ============================================================
#  SCORE DATA — ENTER YOUR NOTES HERE
#
#  Format: (note_name, octave, duration_in_beats)
#  Use ('R', 0, beats) for rests
#
#  DURATION CHEAT SHEET (at quarter=1 beat):
#    whole note      = 4
#    dotted half     = 3
#    half note       = 2
#    dotted quarter  = 1.5
#    quarter note    = 1
#    dotted eighth   = 0.75
#    eighth note     = 0.5
#    triplet eighth  = 0.333
#    sixteenth note  = 0.25
#
#  KEY SIGNATURE REMINDER:
#    Your score has 4 sharps: F#, C#, G#, D#
#    So by default every F is F#, every C is C#,
#    every G is G#, every D is D#.
#    Use natural accidentals (Fn, Cn, Gn, Dn) when
#    the score shows a natural sign cancelling a sharp.
#
#  OCTAVE GUIDE (alto sax written pitch, treble clef):
#    Middle line B = B4
#    Notes below:  A4, G#4, F#4, E4, D#4, C#4, B3...
#    Notes above:  C#5, D#5, E5, F#5, G#5, A5, B5...
#    Ledger lines above staff: C#6, D#6, E6...
#
#  8va markings: when you see 8va, the notes sound an
#  octave higher than written. Add 1 to the octave number.
#
#  TIED NOTES: add the durations together into one entry.
#    e.g., quarter tied to eighth = 1.5
#
#  GRACE NOTES: use a very short duration like 0.1
#
#  This piece is 29 bars, 4/4 time, quarter = 82 BPM.
#  Each bar should total 4 beats.
# ============================================================
SCORE = [
    # ---- Bar 1 (F#m) ----
    # ENTER YOUR NOTES HERE, one tuple per note
    # e.g.: ('C#', 5, 1), ('E', 5, 0.5), ('F#', 5, 0.5), ...

    # ---- Bar 2 (F#m -> E) ----

    # ---- Bar 3 (E -> A -> B) ----

    # ...continue through bar 29...
]


# ============================================================
#  SYNTHESIZER
# ============================================================
def synth_note(freq, duration_sec, velocity=0.35):
    """Synthesize a sax-like tone at the given frequency and duration.
    Returns a list of float samples in [-1, 1]."""
    n_samples = int(SAMPLE_RATE * duration_sec)
    samples = [0.0] * n_samples

    if freq <= 0:  # rest
        return samples

    # Pre-generate noise for breath
    noise = [random.uniform(-1, 1) for _ in range(n_samples)]

    for i in range(n_samples):
        t = i / SAMPLE_RATE
        phase = t * freq

        # --- Sawtooth core (sax body) ---
        saw = 2.0 * (phase % 1.0) - 1.0

        # --- Second harmonic, slightly detuned ---
        phase2 = t * freq * 1.002
        harm2 = 2.0 * (phase2 % 1.0) - 1.0

        # --- Vibrato on sustained notes ---
        vib = 0.0
        if duration_sec > 0.3:
            vib_onset = duration_sec * 0.25
            if t > vib_onset:
                vib_depth = min(1.0, (t - vib_onset) / 0.3) * 0.005 * freq
                vib = vib_depth * math.sin(2 * math.pi * 5.2 * t)

        # Apply vibrato to frequency
        if vib != 0:
            mod_phase = t * (freq + vib)
            saw = 2.0 * (mod_phase % 1.0) - 1.0

        # --- Simple bandpass approximation (emphasize formant) ---
        # Mix saw + harmonic + noise
        tone = saw * 0.55 + harm2 * 0.15

        # Breath noise (bandpass-ish: just scale with note)
        breath = noise[i] * 0.08

        # --- Envelope ---
        # Attack: 15ms breathy onset
        attack_t = 0.015
        # Sustain level
        sustain = 0.88
        # Release: last 15% of note
        release_start = duration_sec * 0.85

        if t < attack_t:
            env = (t / attack_t) * 0.7  # breathy start
            breath *= 3.0  # extra breath on attack
        elif t < 0.06:
            env = 0.7 + ((t - attack_t) / (0.06 - attack_t)) * (1.0 - 0.7)
        elif t < release_start:
            env = sustain + (1.0 - sustain) * max(0, 1.0 - t / 0.2)
        else:
            release_progress = (t - release_start) / (duration_sec - release_start + 0.001)
            env = sustain * max(0, 1.0 - release_progress) ** 2

        sample = (tone + breath) * env * velocity
        samples[i] = max(-1.0, min(1.0, sample))

    return samples


def render_score(score, bpm):
    """Render the full score to a list of float samples."""
    beat_duration = 60.0 / bpm
    all_samples = []

    for note_name, octave, beats in score:
        duration_sec = beats * beat_duration

        if note_name == 'R':
            freq = 0
        else:
            freq = note_to_freq(note_name, octave)

        # Slight gap between notes for articulation (92% sustain)
        sustain_dur = duration_sec * 0.92
        gap_dur = duration_sec - sustain_dur

        note_samples = synth_note(freq, sustain_dur)
        gap_samples = [0.0] * int(SAMPLE_RATE * gap_dur)

        all_samples.extend(note_samples)
        all_samples.extend(gap_samples)

    return all_samples


def write_wav(filename, samples, sample_rate=44100):
    """Write float samples to a 16-bit mono WAV file."""
    with wave.open(filename, 'w') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)  # 16-bit
        wf.setframerate(sample_rate)

        # Normalize
        peak = max(abs(s) for s in samples) if samples else 1.0
        if peak == 0:
            peak = 1.0
        scale = 0.85 / peak  # leave headroom

        data = b''
        for s in samples:
            val = int(s * scale * 32767)
            val = max(-32768, min(32767, val))
            data += struct.pack('<h', val)

        wf.writeframes(data)


# ============================================================
#  MAIN
# ============================================================
if __name__ == '__main__':
    print(f"Rendering {len(SCORE)} notes at {BPM} BPM in 19TET...")
    print(f"Sample rate: {SAMPLE_RATE} Hz")

    samples = render_score(SCORE, BPM)
    duration = len(samples) / SAMPLE_RATE

    print(f"Total duration: {duration:.1f} seconds")
    print(f"Writing to: {OUTPUT_FILE}")

    write_wav(OUTPUT_FILE, samples)

    file_size = os.path.getsize(OUTPUT_FILE)
    print(f"Done! File size: {file_size / 1024:.0f} KB")
    print(f"\nTo play: open {OUTPUT_FILE}")
