import math
import wave
import numpy as np
from pathlib import Path

out = Path(__file__).with_name('soundtrack.wav')
sr = 48000
seconds = 18
t = np.arange(sr * seconds, dtype=np.float64) / sr
audio = np.zeros_like(t)

def env_at(start, end, attack=.12, release=.35):
    x = t - start
    return np.clip(x / attack, 0, 1) * np.clip((end - t) / release, 0, 1)

def tone(freq, start, end, amp, attack=.08, release=.42):
    global audio
    x = t - start
    env = env_at(start, end, attack, release)
    phase = 2 * np.pi * freq * x
    wavepart = np.sin(phase) + .24*np.sin(phase*2.01) + .11*np.sin(phase*3.03)
    audio += amp * wavepart * env

# A restrained four chord pulse, mixed well below the text-led visuals.
for start, root in [(0, 110), (3.6, 130.81), (7.2, 146.83), (11.8, 164.81), (15, 130.81)]:
    end = min(seconds, start + 4.3)
    tone(root, start, end, .055, .55, .8)
    tone(root*1.5, start, end, .029, .65, .8)
    tone(root*2, start, end, .017, .7, .8)

for beat in np.arange(.45, 17.6, .6):
    x = t-beat
    decay = np.exp(-np.maximum(x,0)*24) * (x>=0) * (x<.22)
    audio += .015 * np.sin(2*np.pi*630*x) * decay

for beat in [0.45, 3.55, 7.25, 11.85, 15.0]:
    x = t-beat
    decay = np.exp(-np.maximum(x,0)*9) * (x>=0) * (x<.55)
    audio += .07 * np.sin(2*np.pi*(70*x-38*x*x)) * decay

for hit in [2.2, 5.0, 8.9, 13.4, 15.6]:
    x=t-hit
    env=np.exp(-np.maximum(x,0)*12)*(x>=0)*(x<.5)
    audio += .021*(np.sin(2*np.pi*880*x)+.3*np.sin(2*np.pi*1320*x))*env

audio *= np.clip(t/.35, 0, 1) * np.clip((seconds-t)/.9, 0, 1)
audio = np.tanh(audio*1.5)
peak = max(np.max(np.abs(audio)), 1e-8)
audio = np.int16(np.clip(audio/peak*.68, -1, 1)*32767)
with wave.open(str(out),'wb') as f:
    f.setnchannels(1)
    f.setsampwidth(2)
    f.setframerate(sr)
    f.writeframes(audio.tobytes())
print(out)
