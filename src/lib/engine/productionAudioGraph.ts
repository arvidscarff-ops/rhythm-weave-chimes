/**
 * Shared production audio graph.
 *
 * This is the same graph used by the standalone instrument and the integrated
 * First Crossing proof. It owns signal routing only: authoritative event
 * enumeration remains in the production scheduler and musical position
 * remains in engineClock.
 */

export type ProductionAudioGraphSettings = Readonly<{
  mainVolume: number;
  filterCutoffHz: number;
  delaySeconds: number;
  reverbMix: number;
}>;

export type ProductionAudioGraph = {
  ctx: AudioContext;
  master: GainNode;
  busTrim: GainNode;
  highpass: BiquadFilterNode;
  limiter: DynamicsCompressorNode;
  preFx: GainNode;
  filter: BiquadFilterNode;
  shelf: BiquadFilterNode;
  chorusMix: GainNode;
  chorusRate: AudioParam;
  delayL: DelayNode;
  delayR: DelayNode;
  delayFeedback: GainNode;
  wet: GainNode;
  dryToMaster: GainNode;
  grainDelay: DelayNode;
  grainFeedback: GainNode;
  grainMix: GainNode;
  convolver: ConvolverNode;
  reverbWet: GainNode;
  reverbSend: GainNode;
  irSeconds: number;
  _chorusRateB: AudioParam;
  _chorusDepthA: GainNode;
  _chorusDepthB: GainNode;
  _reverbDamp: BiquadFilterNode;
  _reverbPredelay: DelayNode;
};

type AudioContextConstructor = new (options?: AudioContextOptions) => AudioContext;

function browserAudioContextConstructor(): AudioContextConstructor {
  const browserWindow = window as typeof window & {
    webkitAudioContext?: AudioContextConstructor;
  };
  const Constructor = browserWindow.AudioContext ?? browserWindow.webkitAudioContext;
  if (!Constructor) throw new Error("Web Audio is unavailable on this device.");
  return Constructor;
}

export function createProductionAudioGraph(
  settings: ProductionAudioGraphSettings,
): ProductionAudioGraph {
  const Constructor = browserAudioContextConstructor();
  let ctx: AudioContext;
  try {
    ctx = new Constructor({ sampleRate: 48_000, latencyHint: "interactive" });
  } catch {
    ctx = new Constructor();
  }

  const master = ctx.createGain();
  master.gain.value = settings.mainVolume * 0.7;

  const preFx = ctx.createGain();
  preFx.gain.value = 1;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = settings.filterCutoffHz;
  filter.Q.value = 0.6;

  const shelf = ctx.createBiquadFilter();
  shelf.type = "highshelf";
  shelf.frequency.value = 4_000;
  shelf.gain.value = 0;

  const chorusSplit = ctx.createChannelSplitter(2);
  const chorusMerge = ctx.createChannelMerger(2);
  const chorusDelayL = ctx.createDelay(0.05);
  const chorusDelayR = ctx.createDelay(0.05);
  chorusDelayL.delayTime.value = 0.011;
  chorusDelayR.delayTime.value = 0.017;
  const chorusLfoA = ctx.createOscillator();
  const chorusLfoB = ctx.createOscillator();
  chorusLfoA.frequency.value = 0.35;
  chorusLfoB.frequency.value = 0.35;
  const cosTable = ctx.createPeriodicWave(new Float32Array([0, 0]), new Float32Array([0, 1]));
  chorusLfoB.setPeriodicWave(cosTable);
  const chorusDepthA = ctx.createGain();
  chorusDepthA.gain.value = 0.004;
  const chorusDepthB = ctx.createGain();
  chorusDepthB.gain.value = 0.004;
  chorusLfoA.connect(chorusDepthA);
  chorusDepthA.connect(chorusDelayL.delayTime);
  chorusLfoB.connect(chorusDepthB);
  chorusDepthB.connect(chorusDelayR.delayTime);
  chorusLfoA.start();
  chorusLfoB.start();
  const chorusMix = ctx.createGain();
  chorusMix.gain.value = 0.08;

  const delayL = ctx.createDelay(2.5);
  const delayR = ctx.createDelay(2.5);
  delayL.delayTime.value = settings.delaySeconds;
  delayR.delayTime.value = settings.delaySeconds * 1.5;
  const delayFeedback = ctx.createGain();
  delayFeedback.gain.value = 0.36;
  const wet = ctx.createGain();
  wet.gain.value = settings.reverbMix * 0.35;
  const dryToMaster = ctx.createGain();
  dryToMaster.gain.value = 0.78;

  const irSeconds = 3.2;
  const convolver = ctx.createConvolver();
  convolver.normalize = true;
  const sampleRate = ctx.sampleRate;
  const impulseLength = Math.floor(sampleRate * irSeconds);
  const impulse = ctx.createBuffer(2, impulseLength, sampleRate);
  const impulseLeft = impulse.getChannelData(0);
  const impulseRight = impulse.getChannelData(1);
  for (let index = 0; index < impulseLength; index += 1) {
    const seconds = index / sampleRate;
    const envelope = Math.pow(1 - index / impulseLength, 2.6) * Math.exp(-seconds * 1.4);
    impulseLeft[index] = (Math.random() * 2 - 1) * envelope;
    impulseRight[index] = (Math.random() * 2 - 1) * envelope;
  }
  convolver.buffer = impulse;

  const reverbSend = ctx.createGain();
  reverbSend.gain.value = 1;
  const reverbPredelay = ctx.createDelay(0.2);
  reverbPredelay.delayTime.value = 0.02;
  const reverbDamp = ctx.createBiquadFilter();
  reverbDamp.type = "lowpass";
  reverbDamp.frequency.value = 5_200;
  reverbDamp.Q.value = 0.5;
  const reverbWet = ctx.createGain();
  reverbWet.gain.value = settings.reverbMix * 0.45;

  const grainDelay = ctx.createDelay(0.4);
  grainDelay.delayTime.value = 0.06;
  const grainFeedback = ctx.createGain();
  grainFeedback.gain.value = 0;
  const grainMix = ctx.createGain();
  grainMix.gain.value = 0;

  const busTrim = ctx.createGain();
  busTrim.gain.value = 0.26;
  const highpass = ctx.createBiquadFilter();
  highpass.type = "highpass";
  highpass.frequency.value = 42;
  highpass.Q.value = 0.7;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -16;
  limiter.knee.value = 4;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.12;

  preFx.connect(filter);
  filter.connect(shelf);
  shelf.connect(dryToMaster);
  shelf.connect(chorusSplit);
  chorusSplit.connect(chorusDelayL, 0);
  chorusSplit.connect(chorusDelayR, 1);
  chorusDelayL.connect(chorusMerge, 0, 0);
  chorusDelayR.connect(chorusMerge, 0, 1);
  chorusMerge.connect(chorusMix);
  chorusMix.connect(dryToMaster);
  dryToMaster.connect(busTrim);

  shelf.connect(delayL);
  delayL.connect(delayFeedback);
  delayFeedback.connect(delayR);
  delayR.connect(delayFeedback);
  const pingPongMerge = ctx.createChannelMerger(2);
  delayL.connect(pingPongMerge, 0, 0);
  delayR.connect(pingPongMerge, 0, 1);
  pingPongMerge.connect(wet);
  wet.connect(busTrim);

  shelf.connect(reverbSend);
  reverbSend.connect(reverbPredelay);
  reverbPredelay.connect(reverbDamp);
  reverbDamp.connect(convolver);
  convolver.connect(reverbWet);
  reverbWet.connect(busTrim);

  shelf.connect(grainDelay);
  grainDelay.connect(grainFeedback);
  grainFeedback.connect(grainDelay);
  grainDelay.connect(grainMix);
  grainMix.connect(busTrim);

  busTrim.connect(master);
  master.connect(highpass);
  highpass.connect(limiter);
  limiter.connect(ctx.destination);

  return {
    ctx,
    master,
    busTrim,
    highpass,
    limiter,
    preFx,
    filter,
    shelf,
    chorusMix,
    chorusRate: chorusLfoA.frequency,
    delayL,
    delayR,
    delayFeedback,
    wet,
    dryToMaster,
    grainDelay,
    grainFeedback,
    grainMix,
    convolver,
    reverbWet,
    reverbSend,
    irSeconds,
    _chorusRateB: chorusLfoB.frequency,
    _chorusDepthA: chorusDepthA,
    _chorusDepthB: chorusDepthB,
    _reverbDamp: reverbDamp,
    _reverbPredelay: reverbPredelay,
  };
}
