"""Make a quiet, original thunder roll for optional storm audio. Run with Blender."""
from pathlib import Path
import wave
import numpy as np
root=Path(__file__).resolve().parents[1]
rate=32000;duration=5.5
rng=np.random.default_rng(20261101);time=np.arange(int(rate*duration))/rate
noise=rng.normal(size=len(time))
freq=np.fft.rfftfreq(len(time),1/rate)
spectrum=np.fft.rfft(noise)
low=np.fft.irfft(spectrum/(1+(freq/170)**2),n=len(time));low/=max(abs(low))
mid=np.fft.irfft(spectrum/(1+(freq/1100)**2),n=len(time));mid/=max(abs(mid))
env=(1-np.exp(-time*18))*np.exp(-time*.77)*(1+.28*np.sin(time*9)+.13*np.cos(time*17))
crack=np.exp(-time*38)*(1-np.exp(-time*320))
signal=low*env*.72+mid*crack*.35
for delay,gain in [(.43,.23),(.86,.15),(1.25,.08)]:
 n=int(delay*rate);signal[n:]+=low[:-n]*np.exp(-time[:-n]*1.3)*gain
signal*=np.minimum(1,(duration-time)/.6)
signal=signal/max(abs(signal))*.65
out=root/'public/assets/audio/thunder.wav';out.parent.mkdir(exist_ok=True)
with wave.open(str(out),'wb') as wav:
 wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(rate);wav.writeframes((signal*32767).astype('<i2').tobytes())
print('THUNDER_READY',out.stat().st_size)
