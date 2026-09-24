"""程序化配乐：氛围垫音 + 场景切换处的低音冲击与高音闪烁，对齐 promo.html 的时间轴。"""
import wave
import numpy as np

SR, DUR = 44100, 38.0
t = np.arange(int(SR * DUR)) / SR
L = np.zeros_like(t); R = np.zeros_like(t)

def hz(midi): return 440.0 * 2 ** ((midi - 69) / 12)

def env(start, end, a=1.5, r=2.0):
    e = np.clip((t - start) / a, 0, 1) * np.clip((end - t) / r, 0, 1)
    return np.sin(e * np.pi / 2) ** 2

def pad(notes, start, end, gain=0.05):
    global L, R
    e = env(start, end)
    m = e > 0
    for i, n in enumerate(notes):
        f = hz(n)
        for det, pan in ((-0.12, 0.3), (0.12, 0.7)):   # 双振荡器微失谐，左右分开
            ph = 2 * np.pi * f * (1 + det / 100) * t[m]
            s = np.sin(ph) + 0.3 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph)
            s *= 1 + 0.15 * np.sin(2 * np.pi * 0.2 * t[m] + i)
            L[m] += s * e[m] * gain * (1 - pan); R[m] += s * e[m] * gain * pan

def boom(at, gain=0.5):
    global L, R
    m = (t >= at) & (t < at + 3)
    x = t[m] - at
    f = 55 * np.exp(-x * 3) + 38
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-x * 1.8)
    L[m] += s * gain; R[m] += s * gain

def chime(at, midi, gain=0.08, pan=0.5):
    global L, R
    m = (t >= at) & (t < at + 4)
    x = t[m] - at
    f = hz(midi)
    s = (np.sin(2 * np.pi * f * x) + 0.4 * np.sin(2 * np.pi * f * 2.01 * x) + 0.15 * np.sin(2 * np.pi * f * 3.98 * x)) * np.exp(-x * 1.6)
    L[m] += s * gain * (1 - pan) * 2 * 0.5; R[m] += s * gain * pan * 2 * 0.5

def riser(start, end, gain=0.05):
    global L, R
    m = (t >= start) & (t < end)
    x = (t[m] - start) / (end - start)
    rng = np.random.default_rng(3)
    n = rng.standard_normal(m.sum())
    # 简单一阶低通，截止随时间上升
    alpha = 0.02 + 0.5 * x ** 2
    y = np.zeros_like(n); acc = 0.0
    for i in range(len(n)):
        acc += alpha[i] * (n[i] - acc); y[i] = acc
    y *= x ** 2 * gain
    L[m] += y; R[m] += y

# 和声进行：D 大调 → Bm → G → A（对应开场/标题/三段/收尾）
D, Bm, G, A, Dadd = [50, 57, 62, 66, 69], [47, 54, 59, 62, 66], [43, 50, 55, 59, 62], [45, 52, 57, 61, 64], [50, 57, 62, 64, 66, 69]
pad(D, 0.0, 7.6, 0.035)
pad(Dadd, 7.2, 16.6, 0.04)
pad(Bm, 16.2, 22.4, 0.04)
pad(G, 22.0, 28.0, 0.04)
pad(A, 27.6, 32.6, 0.045)
pad(Dadd, 32.2, 38.0, 0.045)

# 开场打字：轻微键盘敲击
rng = np.random.default_rng(9)
for s0, s1, n in ((0.9, 1.9, 6), (2.2, 3.6, 11)):
    for k in range(n):
        at = s0 + (s1 - s0) * k / n
        m = (t >= at) & (t < at + 0.04)
        x = t[m] - at
        click = rng.standard_normal(m.sum()) * np.exp(-x * 180) * 0.05
        L[m] += click; R[m] += click

riser(5.2, 7.35, 0.06)
boom(7.35, 0.55); chime(7.35, 86, 0.1); chime(7.5, 93, 0.06, 0.7)
for at, n in ((10.6, 81), (16.4, 78), (22.2, 74)):
    boom(at, 0.22); chime(at + 0.1, n, 0.08, 0.35)
# 思维树叶子亮起 / 进度节点 / 工具验证勾
for k in range(8): chime(12.2 + k * 0.28, [74, 78, 81, 86][k % 4], 0.035, 0.2 + 0.08 * k)
for k in range(4): chime(17.2 + k * 1.27, [74, 78, 81, 86][k], 0.06, 0.3 + 0.13 * k)
for k in range(6): chime(25.2 + k * 0.15, 86 + [0, 2, 4, 7, 9, 12][k], 0.03, 0.2 + 0.12 * k)
# 关键词快切：每个词一下
for k in range(6):
    boom(27.9 + k * 0.62, 0.12); chime(27.9 + k * 0.62, [74, 76, 78, 81, 83, 86][k], 0.05, 0.3 + 0.08 * k)
riser(30.8, 32.3, 0.05)
boom(32.3, 0.6); chime(32.35, 74, 0.1); chime(32.5, 81, 0.07, 0.3); chime(32.7, 86, 0.06, 0.7); chime(33.3, 90, 0.04)

# 简易混响：几个多路延迟
def verb(x):
    y = x.copy()
    for d, g in ((0.043, 0.35), (0.071, 0.3), (0.113, 0.25), (0.167, 0.2), (0.251, 0.15)):
        n = int(d * SR); y[n:] += x[:-n] * g
    return y
L, R = verb(L), verb(R[::1])
fade = np.clip((DUR - t) / 1.2, 0, 1)
out = np.stack([L * fade, R * fade], 1)
out /= np.max(np.abs(out)) / 0.89
pcm = (out * 32767).astype('<i2')
with wave.open('out/score.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok', out.shape)
