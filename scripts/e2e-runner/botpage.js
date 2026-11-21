// runs in the page: a player who plays by itself (mode: good | idle | wrong | decent)
window.__bot = (mode) => {
  const R = window.__runner; let jumpedAt = -9;
  const tick = () => {
    const r = R.run; if (r.phase === 'done' || R.state() === 'end') return;
    requestAnimationFrame(tick);
    if (mode === 'idle' || R.state() !== 'run') return;
    const g = r.nextGate;
    if (g && g.prepared && g.z - r.z < 16 && (mode === 'good' || mode === 'wrong' || mode === 'decent')) {
      let want = g.correct - 1;
      if (mode === 'wrong' || (mode === 'decent' && r.gatesDone === 2)) want = [0, 1, 2].filter((i) => i !== g.correct && g.nums[i] !== null)[0] - 1;
      if (r.target < want) R.act({ kind: 'move', dir: 1, via: 'swipe' }); else if (r.target > want) R.act({ kind: 'move', dir: -1, via: 'swipe' });
    }
    if (mode === 'good' || mode === 'decent') {
      for (const o of r.obstacles) {
        if (o.done || o.z < r.z || o.z - r.z > 7) continue;
        if (o.lane !== r.target) continue;
        if (o.kind === 'high') { const f = [-1, 0, 1].filter((l) => !r.obstacles.some((q) => q.z === o.z && q.lane === l && q.kind === 'high')); const to = f.sort((a, b) => Math.abs(a - r.target) - Math.abs(b - r.target))[0]; if (to > r.target) R.act({ kind: 'move', dir: 1, via: 'swipe' }); else if (to < r.target) R.act({ kind: 'move', dir: -1, via: 'swipe' }); }
        else if (o.z - r.z < 2.6 && r.t - jumpedAt > 0.9) { jumpedAt = r.t; R.act({ kind: 'jump', via: 'tap' }); }
      }
    }
  };
  requestAnimationFrame(tick);
};
