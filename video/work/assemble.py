#!/usr/bin/env python3
"""Assemble the PocketMind demo video: segments, labels, captions, voice chain."""
import subprocess, json, sys, os

FF = '/usr/bin/ffmpeg'
BASE = '/home/hatch/workspace/hackathons/firebase-hybrid-ai/pocketmind/video/work'
CLIPS = f'{BASE}/clips'
AUDIO = f'{BASE}/audio'
CARDS = f'{BASE}/cards'
SEG = f'{BASE}/seg'
os.makedirs(SEG, exist_ok=True)
with open(f'{CLIPS}/scenes.json') as f:
    scene_info = json.load(f)
RAW = scene_info['raw']
M = scene_info['marks']
print('raw:', RAW)
print('marks:', {k: round(v, 2) for k, v in M.items()})
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

def run(cmd, label):
    print('==', label, flush=True)
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[-3000:])
        sys.exit(f'FAILED: {label}')
    return r

def dur(path):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
                       capture_output=True, text=True)
    return float(r.stdout.strip())

# ---- timeline ----
S = {i: dur(f'{AUDIO}/s{i}.mp3') for i in range(1, 7)}
GAP = 0.35
TITLE = 2.2
S1_START = 0.3
seg_dur = {
    'title': TITLE,
    'home': (S[1] - (TITLE - S1_START)) + GAP,
    'library': S[2] + GAP,
    'ask': S[3] + GAP,
    'study': S[4] + GAP,
    'routing': S[5] + GAP,
    'closing': S[6] + 1.6,
}
order = ['title', 'home', 'library', 'ask', 'study', 'routing', 'closing']
starts, t = {}, 0.0
for k in order:
    starts[k] = t
    t += seg_dur[k]
TOTAL = t
audio_at = {1: S1_START, 2: starts['library'], 3: starts['ask'], 4: starts['study'],
            5: starts['routing'], 6: starts['closing']}
print('segment durations:', {k: round(v, 2) for k, v in seg_dur.items()})
print('total:', round(TOTAL, 2))

ENC = ['-c:v', 'libx264', '-crf', '17', '-preset', 'veryfast', '-r', '30', '-pix_fmt', 'yuv420p', '-an']
BASE_VF = 'fps=30,format=yuv420p,scale=1920:1080'

def label_vf(text, show=4.2):
    alpha = f"if(lt(t,0.4),t/0.4,if(lt(t,{show-0.6}),1,if(lt(t,{show}),({show}-t)/0.6,0)))"
    return (f",drawtext=fontfile={FONT}:text='{text}':fontsize=46:fontcolor=white:"
            f"box=1:boxcolor=0x070d1a@0.88:boxborderw=20:x=52:y=44:alpha='{alpha}'")

def zoom_vf(dur_s, amount_w=320, amount_h=180):
    return (f",crop=w='1920-{amount_w}*min(t/{dur_s:.3f},1)':h='1080-{amount_h}*min(t/{dur_s:.3f},1)':"
            f"x='{amount_w//2}*min(t/{dur_s:.3f},1)':y='{amount_h//2}*min(t/{dur_s:.3f},1)',scale=1920:1080")

def seg_from_raw(name, start_key, end_key, seg_key, extra_vf='', start_off=0.0):
    a = M[start_key] + start_off
    b = M[end_key]
    rec = b - a
    target = seg_dur[seg_key]
    vf = BASE_VF
    if rec > target:
        speed = rec / target
        vf += f',setpts=PTS/{speed:.4f}'
        print(f'{name}: speed {speed:.2f}x ({rec:.1f}s -> {target:.1f}s)')
    elif rec < target:
        pad = target - rec
        vf += f',tpad=stop_mode=clone:stop_duration={pad:.3f}'
        print(f'{name}: freeze pad {pad:.1f}s ({rec:.1f}s -> {target:.1f}s)')
    vf += extra_vf
    run([FF, '-y', '-ss', f'{a:.3f}', '-i', RAW, '-t', f'{target:.3f}',
         '-vf', vf, *ENC, f'{SEG}/{name}.mp4'], name)

# ---- segments ----
run([FF, '-y', '-loop', '1', '-t', f"{seg_dur['title']:.3f}", '-i', f'{CARDS}/title.png',
     '-vf', BASE_VF + zoom_vf(seg_dur['title'], 140, 80), *ENC, f'{SEG}/00_title.mp4'], 'title')

seg_from_raw('01_home', 'home_start', 'home_end', 'home',
             zoom_vf(seg_dur['home'], 200, 112) + label_vf('Hybrid status'))
seg_from_raw('02_library', 'library_start', 'library_end', 'library',
             label_vf('Notes library'))
seg_from_raw('03_ask', 'ask_start', 'ask_end', 'ask',
             zoom_vf(seg_dur['ask'], 260, 146) + label_vf('Ask your note'))
seg_from_raw('04_study', 'study_start', 'study_end', 'study',
             label_vf('Summary and flashcards'))
seg_from_raw('05_routing', 'routing_start', 'routing_end', 'routing',
             zoom_vf(seg_dur['routing'], 260, 146) + label_vf('Routing modes'))

# closing: app shot + closing card
app_dur = 6.0
card_dur = seg_dur['closing'] - app_dur
app_rec = M['closing_end'] - M['closing_start']
app_vf = BASE_VF
if app_rec > app_dur:
    app_vf += f',setpts=PTS/{app_rec / app_dur:.4f}'
else:
    app_vf += f',tpad=stop_mode=clone:stop_duration={app_dur - app_rec:.3f}'
app_vf += zoom_vf(app_dur, 200, 112)
run([FF, '-y', '-ss', f"{M['closing_start']:.3f}", '-i', RAW, '-t', f'{app_dur:.3f}',
     '-vf', app_vf, *ENC, f'{SEG}/06_app.mp4'], 'closing app')
run([FF, '-y', '-loop', '1', '-t', f'{card_dur:.3f}', '-i', f'{CARDS}/closing.png',
     '-vf', BASE_VF + zoom_vf(card_dur, 140, 80), *ENC, f'{SEG}/07_card.mp4'], 'closing card')

seg_files = ['00_title', '01_home', '02_library', '03_ask', '04_study', '05_routing', '06_app', '07_card']
with open(f'{SEG}/list.txt', 'w') as f:
    for s in seg_files:
        f.write(f"file '{SEG}/{s}.mp4'\n")
run([FF, '-y', '-f', 'concat', '-safe', '0', '-i', f'{SEG}/list.txt', '-c', 'copy', f'{SEG}/video_only.mp4'], 'concat')
print('video_only duration:', round(dur(f'{SEG}/video_only.mp4'), 2), 'expected:', round(TOTAL, 2))

# ---- narration track ----
inputs, fc = [], []
for i in range(1, 7):
    inputs += ['-i', f'{AUDIO}/s{i}.mp3']
    ms = int(audio_at[i] * 1000)
    fc.append(f'[{i-1}:a]aresample=48000,adelay={ms}:all=1[a{i}]')
fc.append(''.join(f'[a{i}]' for i in range(1, 7)) + 'amix=inputs=6:duration=longest:normalize=0[mix]')
run([FF, '-y', *inputs, '-filter_complex', ';'.join(fc), '-map', '[mix]',
     '-c:a', 'pcm_s16le', '-ar', '48000', f'{AUDIO}/voice_raw.wav'], 'narration mix')

run([FF, '-y', '-i', f'{AUDIO}/voice_raw.wav',
     '-af', 'afftdn=nr=10:nf=-25,highpass=f=90,equalizer=f=3000:t=q:w=1:g=2,equalizer=f=8000:t=q:w=2:g=1.5,'
            'compand=attacks=0.01:decays=0.3:points=-70/-50|-30/-15:soft-knee=6:gain=0',
     '-c:a', 'pcm_s16le', '-ar', '48000', f'{AUDIO}/voice_chain.wav'], 'voice chain')

r = subprocess.run([FF, '-i', f'{AUDIO}/voice_chain.wav', '-af',
                    'loudnorm=I=-14:TP=-1:LRA=11:print_format=json', '-f', 'null', '-'],
                   capture_output=True, text=True)
js = r.stderr[r.stderr.rfind('{'):r.stderr.rfind('}') + 1]
m = json.loads(js)
print('loudnorm measured:', m)
run([FF, '-y', '-i', f'{AUDIO}/voice_chain.wav',
     '-af', (f"loudnorm=I=-14:TP=-1:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
             f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true"),
     '-c:a', 'pcm_s16le', '-ar', '48000', f'{AUDIO}/voice_final.wav'], 'loudnorm apply')

r = subprocess.run([FF, '-hide_banner', '-nostats', '-i', f'{AUDIO}/voice_final.wav', '-af', 'ebur128=peak=true', '-f', 'null', '-'],
                   capture_output=True, text=True)
tail = [l for l in r.stderr.splitlines() if 'Integrated loudness' in l or 'True peak' in l or 'Loudness range' in l]
print('FINAL LOUDNESS:', ' | '.join(x.strip() for x in tail))

# ---- captions (ASS) ----
TEXTS = {
    1: 'Hello, I am Ibrahim Yahaya from Bida, Niger State, Nigeria, a student at the Federal University of Technology Minna. This is PocketMind, my personal AI notebook. It answers questions from my own lecture notes, and it shows me exactly where each answer was computed: on my device, or in the cloud.',
    2: 'My notes are long, my data is expensive, and revision apps want me online. PocketMind keeps my notes on this device, and runs the AI on the device whenever Chrome can.',
    3: 'I open my Photosynthesis note and ask: what traps light? PocketMind answers from the note itself. This recording runs in demo mode, before my Firebase project is connected, and the badge on the answer says so plainly. With Firebase connected, that badge reads On-device or Cloud, from the real inference source.',
    4: 'One tap gives me a revision summary. Another tap turns the note into flashcards I can flip through. Same hybrid engine, same honest badge on every result.',
    5: 'The routing picker maps straight to the four Firebase AI Logic inference modes: on-device first, on-device only, cloud first, or cloud only. Long notes go cloud first, because the on-device window is small, and the app explains why. If a mode cannot run, PocketMind tells me plainly instead of failing quietly.',
    6: 'PocketMind: your notes, answered on-device when possible, in the cloud when needed, and honest about which one ran. Built with Firebase AI Logic hybrid inference. Thank you.',
}
def chunks(text, maxlen=44):
    words, out, cur = text.split(), [], ''
    for w in words:
        if len(cur) + len(w) + 1 > maxlen and cur:
            out.append(cur); cur = w
        else:
            cur = (cur + ' ' + w).strip()
    if cur: out.append(cur)
    return out

def ts(sec):
    h = int(sec // 3600); mnt = int((sec % 3600) // 60); s = sec % 60
    return f'{h}:{mnt:02d}:{s:05.2f}'

lines = ['''[Script Info]
Title: PocketMind demo captions
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,DejaVu Sans,48,&H00FFFFFF,&H000000FF,&H00000000,&H64000000,-1,0,0,0,100,100,0,0,1,3.5,1.5,2,120,120,64,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text''']
for i in range(1, 7):
    start, total = audio_at[i], S[i]
    cs = chunks(TEXTS[i])
    weights = [len(c) for c in cs]
    wsum = sum(weights)
    cur = start
    for c, w in zip(cs, weights):
        d = total * w / wsum
        lines.append(f'Dialogue: 0,{ts(cur)},{ts(cur + d)},Default,,0,0,0,,{c}')
        cur += d
with open(f'{BASE}/captions.ass', 'w') as f:
    f.write('\n'.join(lines) + '\n')
print('captions written')

# ---- final mux: burn captions, fade out, add audio ----
fade_st = TOTAL - 0.8
run([FF, '-y', '-i', f'{SEG}/video_only.mp4', '-i', f'{AUDIO}/voice_final.wav',
     '-filter_complex', f"[0:v]subtitles={BASE}/captions.ass,fade=t=out:st={fade_st:.2f}:d=0.8[v];[1:a]apad,afade=t=out:st={fade_st:.2f}:d=0.8[a]",
     '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-crf', '19', '-preset', 'medium',
     '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
     '-movflags', '+faststart', '-t', f'{TOTAL:.3f}', f'{BASE}/../pocketmind-demo.mp4'], 'final mux')
print('DONE. Final duration:', round(dur(f'{BASE}/../pocketmind-demo.mp4'), 2))
