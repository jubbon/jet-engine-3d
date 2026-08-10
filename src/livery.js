/* ---------------------- markings on the nacelle skin ------------------ *
 *  A real nacelle is not a blank white body. It is cut up by the joints
 *  between the intake, the two fan cowl doors and the reverser, and it is
 *  covered in service placards. Without them the model reads as a moulded
 *  plastic mock-up: there is nothing on the surface for the eye to take a
 *  scale from, and a nacelle 2.44 m across looks exactly like one 0.5 m
 *  across.
 *
 *  There are no image files in this project, so the markings are drawn into
 *  a canvas at start-up and used as the colour map of the outer skin. One
 *  texture on one mesh costs one draw call; decals laid over the surface
 *  would cost one each and would z-fight with the skin at grazing angles -
 *  which is most of the nacelle, seen from any normal camera position.
 *
 *  The placement relies on how LatheGeometry lays out its UVs: u runs around
 *  the circumference, v along the profile by point INDEX. That is why the
 *  skin profile is resampled at uniform arc length before it gets here (see
 *  smoothProfile() in engine.js): with the raw control points - six of them
 *  crowded into the lip and one for the whole barrel - v would be bunched up
 *  at the nose and the titles would be smeared over the cowl. Evenly spaced,
 *  v is proportional to distance along the generatrix, and a marking can be
 *  asked for by station.
 *
 *  Which way round the texture goes follows from lathe(): a vertex at angle
 *  phi ends up at world Y = -r sin(phi), Z = r cos(phi). So u = 0 is the +Z
 *  side, u = 0.25 the bottom, u = 0.5 the -Z side, u = 0.75 the top. The
 *  bottom is where flattenBelly() deforms the surface, so nothing is placed
 *  there - it would be the one place the paint visibly stretches.
 *
 *  The lettering is deliberately NOT run through t(). These are markings
 *  painted on the hardware, and on real hardware they are in English
 *  whatever the language of the person reading the interface.
 * -------------------------------------------------------------------- */

import * as THREE from 'three';

const W = 2048;
const H = 1024;

/* Drawing units per model unit. The markings are described in model units
   (1 unit = 0.50 m), but a canvas transform of ~140 px/unit would leave the
   titles asking for a font of half a pixel before the transform. Working a
   hundred times larger keeps every font size and line width in a range the
   canvas rasteriser handles without rounding. */
const CU = 100;

/* The map is multiplied by the material colour and then lit by an environment
   bright enough to wash out anything subtle, so the marks are drawn darker
   than they would be measured on the real cowl - by the time they reach the
   screen a mid grey is barely a shade off white. */
const PAINT = '#ffffff'; // the material tint is applied on top of the map
const SEAM = '#c3cad1'; // the lit edge of the panel behind the gap
const SEAM_DARK = '#5d666f'; // the gap itself
const RIVET = '#98a1aa';
const TITLE = '#1b2440'; // the dark blue the model designation is painted in
const STENCIL = '#2b333c';
const PLACARD = '#f4f6f8';
const PLACARD_TEXT = '#79818a';

/* ------------------------- profile arithmetic ------------------------ */

// profile entries are [radius, x] and x increases along the array
function bracket(profile, x) {
  const n = profile.length;
  for (let i = 1; i < n; i++) {
    const a = profile[i - 1][1];
    const b = profile[i][1];
    if (x <= b || i === n - 1) {
      const t = b === a ? 0 : (x - a) / (b - a);
      return { i, t: THREE.MathUtils.clamp(t, 0, 1) };
    }
  }
  return { i: n - 1, t: 1 };
}

// v exactly as LatheGeometry hands it out: by point index
function vAt(profile, x) {
  const { i, t } = bracket(profile, x);
  return (i - 1 + t) / (profile.length - 1);
}

function radiusAt(profile, x) {
  const { i, t } = bracket(profile, x);
  return THREE.MathUtils.lerp(profile[i - 1][0], profile[i][0], t);
}

/* Drawing scale along the axis, in px per model unit.
 *
 * v is handed out by point INDEX, so the honest conversion is "pixels per
 * index step" divided by "model units per index step" - not H / arcLength.
 * The two agree only while the samples are evenly spaced, and they no longer
 * are: engine.js inserts a point at each station where the skin comes apart,
 * which leaves one interval split in two and every other one carrying a
 * slightly larger share of v than the arc length says. At one cut that is a
 * 1.6 % error in the size of every marking; with the three or four cuts a full
 * structural breakdown would need it becomes 5 %.
 *
 * The median segment stands in for the uniform spacing: it is unmoved by a
 * handful of inserted points, which is exactly the property wanted here. */
function pxPerModelUnit(profile, height) {
  const seg = [];
  for (let i = 1; i < profile.length; i++) {
    seg.push(Math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1]));
  }
  seg.sort((a, b) => a - b);
  const median = seg[seg.length >> 1];
  return height / ((profile.length - 1) * median);
}

/**
 * Builds the colour map of the nacelle outer skin.
 *
 * @param {Array<[number, number]>} profile the resampled skin profile, [radius, x]
 * @param {Record<string, number>} ST the longitudinal stations from engine.js
 * @returns {THREE.CanvasTexture | null} null under Node, where the tests build
 *   the scene without a DOM; the skin then simply stays unpainted
 */
export function createNacelleLivery(profile, ST) {
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = PAINT;
  ctx.fillRect(0, 0, W, H);

  // Texture v grows aft, canvas y grows downwards, and CanvasTexture is
  // flipped on load - so aft ends up at the top of the image.
  const pxPerV = pxPerModelUnit(profile, H);
  const yOf = (x) => (1 - vAt(profile, x)) * H;
  const pxPerU = (x) => W / (2 * Math.PI * radiusAt(profile, x));

  /* The fan cowl runs from the joint with the intake to the leading edge of
     the reverser; the reverser makes up the rest of the nacelle. Both joints
     are stations now - the skin is lathed in two pieces so the sleeve can
     slide - so both are read from ST rather than guessed at as a fraction of
     the barrel. */
  const cowlAft = ST.reverser;

  /* ---------------------------- joints ------------------------------- */

  // A joint reads as a narrow dark gap with the light catching the edge of the
  // panel behind it; a single flat line looks drawn on rather than built in.
  function joint(x) {
    const y = yOf(x);
    ctx.strokeStyle = SEAM_DARK;
    ctx.lineWidth = 0.036 * pxPerV;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
    ctx.strokeStyle = SEAM;
    ctx.lineWidth = 0.018 * pxPerV;
    ctx.beginPath();
    ctx.moveTo(0, y + 0.032 * pxPerV);
    ctx.lineTo(W, y + 0.032 * pxPerV);
    ctx.stroke();
  }

  // A row of fasteners along a joint. The pitch is given in model units and
  // converted to an angle, so the dots stay evenly spaced on the real surface
  // rather than in the texture.
  function rivetRing(x, offset, pitch = 0.14) {
    const y = yOf(x) + offset * pxPerV;
    const step = (pitch / (2 * Math.PI * radiusAt(profile, x))) * W;
    ctx.fillStyle = RIVET;
    for (let px = step / 2; px < W; px += step) {
      ctx.beginPath();
      ctx.arc(px, y, 0.018 * pxPerV, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // The lengthwise split between the left and right halves of a cowl.
  function splitLine(u, x0, x1) {
    const px = u * W;
    ctx.strokeStyle = SEAM_DARK;
    ctx.lineWidth = 0.022 * pxPerV;
    ctx.beginPath();
    ctx.moveTo(px, yOf(x0));
    ctx.lineTo(px, yOf(x1));
    ctx.stroke();
  }

  /* -------------------------- stamped marks -------------------------- *
   *  Everything below is drawn in a frame centred on a station and an angle,
   *  with the axis running the way it does when that side of the nacelle is
   *  looked at from outside: the nose to the left, the tail to the right, the
   *  top of the nacelle up. Which of the two 90 degree rotations achieves
   *  that depends on which side of the engine the mark is on.
   * ------------------------------------------------------------------ */

  function stamp(x, u, draw) {
    const sx = pxPerU(x) / CU; // around the circumference
    const sy = pxPerV / CU; // along the axis
    // u < 0.25 or u > 0.75 is the +Z side, where increasing u goes downwards.
    const nearZ = u < 0.25 || u > 0.75;
    const cx = ((u % 1) + 1) % 1;
    // drawn three times so a mark sitting on the u = 0 seam is not cut in half
    for (const off of [-W, 0, W]) {
      ctx.save();
      ctx.translate(cx * W + off, yOf(x));
      ctx.rotate(nearZ ? -Math.PI / 2 : Math.PI / 2);
      ctx.scale(sy, sx); // the rotation has already swapped the two axes
      draw(ctx);
      ctx.restore();
    }
  }

  /* The model designation the prototype carries on its cowl. It is set to a
     fixed fraction of the cowl rather than to a cap height in metres, because
     what the eye judges is the proportion: at 60 % of the length from the
     intake joint to the nozzle it comes out about 1.5 m long with 0.15 m
     capitals, which is what the reference photograph shows.

     It straddles the joint between the fan cowl and the reverser, and that is
     not an oversight. Titles this size are painted on the assembled nacelle
     and matched panel to panel; keeping the whole of it clear of the joint
     would mean shrinking it to a third of the size it is painted at. */
  const TITLE_TEXT = 'BOEING 737-800';

  function title(u) {
    stamp(THREE.MathUtils.lerp(ST.a1, ST.bypassExit, 0.63), u - 0.045, (c) => {
      c.fillStyle = TITLE;
      c.font = `600 ${0.3 * CU}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      const wide = 1.06; // the letters on the real thing are a shade wide
      const k = ((ST.bypassExit - ST.a1) * 0.5 * CU) / (c.measureText(TITLE_TEXT).width * wide);
      c.scale(wide * k, k);
      c.fillText(TITLE_TEXT, 0, 0);
    });
  }

  // Circle with a bar through it: do not stand here. On the fan cowl it warns
  // that the door is not structure and will not take a foot.
  function noStep(x, u) {
    stamp(x, u, (c) => {
      const d = 0.46 * CU;
      c.strokeStyle = STENCIL;
      c.lineWidth = 0.035 * CU;
      c.beginPath();
      c.arc(0, 0, d / 2, 0, Math.PI * 2);
      c.stroke();
      c.beginPath();
      c.moveTo(-d * 0.35, d * 0.35);
      c.lineTo(d * 0.35, -d * 0.35);
      c.stroke();
      c.fillStyle = STENCIL;
      c.font = `700 ${0.13 * CU}px Arial, sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'top';
      c.fillText('NO STEP', 0, d * 0.62);
    });
  }

  // A service door: outline, a shadow along the hinge side, and the fasteners
  // that hold the frame down.
  function door(x, u, len, height) {
    stamp(x, u, (c) => {
      const w = len * CU;
      const h = height * CU;
      const r = 0.08 * CU;
      c.strokeStyle = SEAM_DARK;
      c.lineWidth = 0.018 * CU;
      c.beginPath();
      c.roundRect(-w / 2, -h / 2, w, h, r);
      c.stroke();
      c.strokeStyle = SEAM;
      c.lineWidth = 0.01 * CU;
      c.beginPath();
      c.roundRect(-w / 2 + 0.03 * CU, -h / 2 + 0.03 * CU, w - 0.06 * CU, h - 0.06 * CU, r * 0.7);
      c.stroke();
      c.fillStyle = RIVET;
      const n = Math.max(3, Math.round(len / 0.16));
      for (let i = 0; i <= n; i++) {
        const px = -w / 2 + (i / n) * w;
        for (const py of [-h / 2, h / 2]) {
          c.beginPath();
          c.arc(px, py, 0.014 * CU, 0, Math.PI * 2);
          c.fill();
        }
      }
    });
  }

  // A placard. At any camera distance the model allows, the print on a real
  // placard is below the resolution of the texture - so it is drawn as the
  // grey banding the eye actually sees, rather than as invented wording.
  function placard(x, u, len, height) {
    stamp(x, u, (c) => {
      const w = len * CU;
      const h = height * CU;
      c.fillStyle = PLACARD;
      c.fillRect(-w / 2, -h / 2, w, h);
      c.strokeStyle = SEAM;
      c.lineWidth = 0.012 * CU;
      c.strokeRect(-w / 2, -h / 2, w, h);
      c.fillStyle = PLACARD_TEXT;
      const rows = 4;
      for (let i = 0; i < rows; i++) {
        const py = -h / 2 + (h * (i + 0.8)) / (rows + 0.6);
        const wide = i === 0 ? 0.8 : 0.55 + 0.3 * ((i * 7) % 3) * 0.5;
        c.fillRect(-w * 0.38, py, w * 0.76 * wide, h * 0.06);
      }
    });
  }

  // A round access port - the oil level sight glass sits on the fan cowl at
  // about this height so that it can be read from the ground.
  function port(x, u, d) {
    stamp(x, u, (c) => {
      c.fillStyle = '#5c646d';
      c.beginPath();
      c.arc(0, 0, (d / 2) * CU, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = SEAM_DARK;
      c.lineWidth = 0.02 * CU;
      c.stroke();
    });
  }

  /* --------------------------- the layout ---------------------------- */

  // Intake to fan cowl - the joint at flange A1, the one the intake bolts to.
  joint(ST.a1);
  rivetRing(ST.a1, -0.09);
  // Fan cowl to reverser.
  joint(cowlAft);
  rivetRing(cowlAft, 0.09);
  // Reverser fixed structure to translating sleeve. This one is not a panel
  // joint but a sliding one: it is the line the nacelle opens along, and on the
  // real thing it is the widest gap on the cowl.
  joint(ST.sleeve);

  // The fan cowl is two doors hinged at the top, on the pylon, and latched at
  // the bottom; the reverser halves are hinged the same way. The top split
  // runs under the pylon and is never seen, but it costs nothing to be right.
  splitLine(0.25, ST.a1, ST.bypassExit);
  splitLine(0.75, ST.a1, ST.bypassExit);

  // Both sides carry the same marks: an aircraft is symmetrical, and the model
  // can be orbited to either side.
  for (const side of [0, 0.5]) {
    title(side);
    /* The servicing marks all sit on the fan cowl, and all of them below the
       title: that is the half of the door a person standing on the ground can
       reach. They are spaced so that nothing overlaps anything else - in the
       texture the angular gaps look generous, but a tenth of a turn is only
       1.5 m of skin, and two marks a tenth apart very nearly touch. */
    port(THREE.MathUtils.lerp(ST.a1, cowlAft, 0.14), side + 0.1, 0.26);
    door(THREE.MathUtils.lerp(ST.a1, cowlAft, 0.4), side + 0.02, 1.3, 0.9);
    // The cowl door is a fairing, not structure, and will not take a foot.
    noStep(THREE.MathUtils.lerp(ST.a1, cowlAft, 0.65), side + 0.075);
    placard(THREE.MathUtils.lerp(ST.a1, cowlAft, 0.88), side + 0.02, 0.5, 0.34);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
