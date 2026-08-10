/* ------------------------------------------------------------------ *
 *  Thrust reverser: deployment, the blocker door mechanism, and the
 *  thrust that comes out of the two.
 *
 *  Like engineState.js this module knows nothing about Three.js or the
 *  DOM. A deployment takes two seconds and the interesting part of it is
 *  what the interlocks refuse to do, so it has to be runnable under Node.
 *
 *  The prototype's unit (docs/engines/cfm56-7b-nacelle.json, ATA 78) is a
 *  CASCADE reverser of the bypass duct: a sleeve forming the aft section
 *  of the nacelle slides aft, uncovering a band of turning vanes, while
 *  blocker doors swing across the duct so the fan air has nowhere to go
 *  but out through those vanes, forward and outward. The core stream is
 *  not touched - which is the whole point on an engine that moves five
 *  times as much air round the core as through it.
 *
 *  ONE actuator produces both motions. The doors are not driven: each is
 *  hinged to the sleeve and tied by a drag link to an anchor on the fixed
 *  inner wall of the duct. The sleeve carries the hinge aft, the anchor
 *  stays put, the link cannot stretch - so the door is pulled round. Door
 *  angle is therefore a function of sleeve TRAVEL, never of time, and
 *  that is why it is solved here rather than authored as a curve: the
 *  curve that falls out has a shape worth showing (see blockerAngle).
 *
 *  None of the numbers below is published. The reference file lists them
 *  under components.thrust_reverser.not_published; what they are pinned
 *  against instead is written at each one.
 * ------------------------------------------------------------------ */

/* How far the sleeve slides. It is the length of the cascade band - the
   sleeve has to uncover the whole band and no more - so engine.js derives the
   band from this rather than the other way round, and the two cannot drift.
   0.90 units = 0.45 m. */
export const STROKE = 0.9;

/* Deployment and stow times. Both are of the order of the couple of seconds a
   reverser actually takes; stowing is the slower of the two because it is the
   direction nothing is in a hurry about. */
export const DEPLOY_TIME = 2.0; // s
export const STOW_TIME = 3.0; // s

/* Reverse power, as a fraction of the throttle range. Reverse is used well
   below full power on the type, and the sleeve is not stressed for it: 0.75 of
   the range is N1 = 0.18 + 0.82 * 0.75 = 79.5 %. */
export const REV_MAX_THROTTLE = 0.75;

/* How fast the cap may RISE, as a fraction of the throttle range per second.
   Falling is instant - an interlock that bites has to bite at once - but on the
   way up it is rate limited, and that is not a softening of the interlock.

   The cap stands in for a hand on the reverse levers. Released in one frame it
   commands the engine from idle to 75 % instantaneously, which is a slam: since
   the surge work the model has a stability boundary, and a step of that size
   from idle crosses it. Reverse would surge every single time it was selected,
   which is both wrong - a reverser is not a way to break an engine - and would
   have made the documented -19.4 kN unreachable.

   Half the range per second puts the full release at two seconds and the
   reverse release at one and a half, which is about how quickly the levers come
   up in practice and is comfortably clear of the boundary. */
const LIMIT_RATE = 0.5;

/* Six doors per reverser half, hinged on the pylon like the halves themselves.
   A 30 degree pitch reads as a ring of doors rather than as four big flaps and
   leaves room between them for the hinge and link fittings. */
export const DOORS = 12;

/* The mechanism, in the LOCAL frame of one door: where the anchor sits
   relative to the hinge at rest, how far along the door the link attaches, and
   the door chord. Deliberately no station - ST in engine.js is the single
   source of truth for the longitudinal layout, and a copy of -0.79 in this
   file is exactly the drift that convention exists to prevent. Written this
   way the linkage is also true wherever the door is put.

   u0  the anchor is 0.45 units AFT of the hinge at rest (hence the sign:
       u = hinge.x - anchor.x, and the hinge starts forward of the anchor)
   v   and 0.49 units inboard of it
   a   the link attaches at 0.45 of the way along the door - 90 % of the
       chord, near the free end, as on the prototype

   These three were not guessed. They came out of a search against four
   requirements at once: the door angle monotone over the whole stroke, no part
   of the door closer than 0.02 units to the core cowl at any point of the
   sweep, at least 88 % of the duct closed at full travel, and an anchor
   standing clear of the cowl but inside the duct. Most of the parameter space
   fails at least one; a door much longer than this one sweeps THROUGH the core
   cowl on its way round, at ninety degrees, where nobody thinks to look. */
export const LINK = { u0: -0.45, v: 0.49, a: 0.45, chord: 0.5 };

/* Link length. Not a free constant: it is whatever makes the door flush with
   the duct wall when the sleeve is home, which is what "stowed" means. Exported
   because the rod has to be drawn, and a rod drawn at any other length would be
   a link that stretches. */
export const LINK_L = Math.hypot(LINK.u0 + LINK.a, LINK.v);

/* Height of the bypass duct where the door tip lands. Measured off the model's
   own profiles - the inner nacelle wall against the core cowl - which run
   0.50…0.53 units apart across the doors' sweep. It is a property of the duct
   rather than of the reverser, and what keeps it honest is clearance.test.mjs,
   which measures it off the real profiles and compares. Exported so that check
   can be a direct comparison of the two halves of one fact rather than of some
   consequence that might pass for a compensating reason. */
export const DUCT_H = 0.52;

/* And how much of the CIRCUMFERENCE the ring of doors covers. Twelve tapered
   doors leave about 25 mm of gap at each end of each door - close-fitting, but
   not sealed, and they cannot be made to seal: the pitch shrinks from 0.885 at
   the hinge to 0.624 at the radius the tip reaches, so a plate that closed the
   gaps at both ends at once would have to change width as it swung.

   Left out, this is a 3.5 % error in the wrong direction on a number that
   drives the thrust, the flow and the sound alike. It is folded in here rather
   than at the three call sites, and clearance.test.mjs measures the same
   product off the real vertices - radial reach times angular coverage - rather
   than trusting either number. */
const DOOR_COVERAGE = 0.965;

/* Shares of the thrust, and what the cascades do with the fan's share.

   At a bypass ratio of 5.1 the fan makes about 80 % of the thrust and the core
   the rest. Whatever fraction of the fan stream the doors have closed is
   turned forward through the cascades; it leaves at an angle, not straight
   ahead, so only part of its momentum counts against the engine. TURN is that
   part, and it is the one number here tuned to an outcome rather than derived:
   at the reverse power limit it puts the model at -19 kN, and published
   figures for the type put maximum reverse thrust at roughly a fifth of
   take-off thrust. The angle a cascade actually turns the flow through is not
   something the geometry this model draws could be asked.

   It moved from 0.62 to 0.68 when the gaps between the doors were accounted
   for. That is the right thing for a calibration constant to do: the blocked
   fraction became more honest, and TURN is the free parameter that holds the
   result against the published figure. */
const CORE_SHARE = 0.2;
const FAN_SHARE = 0.8;
const TURN = 0.68;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * Angle of a blocker door, radians, from flush in the duct wall.
 *
 * The door is a rigid bar hinged at H = (x0 + travel, R); the link point sits
 * at distance `a` along it, rotated by theta; the link holds that point at a
 * fixed distance L from the anchor A. One equation:
 *
 *     | H + a*(cos t, -sin t) - A | = L
 *
 * Expanded, it is p*cos t + q*sin t = c, which is L*cos(t - phi) = c with
 * phi = atan2(q, p) - a closed form, no solver. Of the two roots the one that
 * continues from theta(0) = 0 is phi + acos(c/h).
 *
 * @param {number} travel sleeve travel, model units
 * @returns {number} radians
 */
export function blockerAngle(travel) {
  /* The sleeve home is the datum, and the closed form only reaches it to
     within rounding. Returning the datum exactly is what keeps a stowed
     reverser from changing the thrust by 1e-17 - the flush door is a fact
     about the hardware, not the output of a trig identity. */
  if (travel <= 0) return 0;
  const u = LINK.u0 + travel;
  const { v, a } = LINK;
  const p = 2 * u * a;
  const q = -2 * v * a;
  const c = LINK_L * LINK_L - u * u - v * v - a * a;
  const h = Math.hypot(p, q);
  const phi = Math.atan2(q, p);
  /* Driven past the point where the link can reach, the geometry has to give
     an angle anyway: a NaN would put a hole in the model rather than raise. At
     the limit the door is simply as far round as the linkage can take it.

     With the constants above only the lower clamp can ever engage, and it
     first does so at travel 1.25, well past the stroke: the link length is
     derived from theta(0) = 0, which makes L^2 = (u0 + a)^2 + v^2 and collapses
     c to (u0 + a)^2 - u^2 - a^2, and u0 + a happens to be zero here.

     The upper clamp is kept because that is a property of a search result, not
     of the mechanism. It goes live as soon as |u0 + a| >= sqrt(a^2 + 2*a*v) -
     0.80 for the present a and v, so u0 outside -1.25…0.35 - because the
     largest ratio occurs at u = 0, which the sleeve passes through at travel
     0.45, in the middle of the stroke. A future search has no reason to stay
     out of that range. */
  if (h < 1e-9) return 0;
  const ratio = c / h;
  if (ratio <= -1) return phi + Math.PI;
  if (ratio >= 1) return phi;
  return phi + Math.acos(ratio);
}

/**
 * How much of the bypass duct the doors have closed, 0..1. They never reach 1:
 * a blocker door does not seal against the core cowl, and the few per cent
 * left open is real rather than a modelling shortfall.
 * @param {number} travel sleeve travel, model units
 */
export function blockedFraction(travel) {
  const radial = clamp((LINK.chord * Math.sin(blockerAngle(travel))) / DUCT_H, 0, 1);
  return radial * DOOR_COVERAGE;
}

/**
 * Signed multiplier on gross thrust. Exactly +1 with the duct open - a stowed
 * reverser must not change the thrust by a rounding error - and about -0.24 at
 * the 0.96 the doors actually reach.
 *
 * It takes the blocked fraction rather than the travel on purpose. The cascades
 * turn whatever the doors send them, and how the doors got to that position is
 * a separate fact about a linkage; keeping the seam here means the thrust
 * arithmetic does not depend on the mechanism, and the caller passes the number
 * it already has instead of paying for two trigonometric solves a frame to
 * recover it.
 *
 * @param {number} blocked how much of the bypass duct is closed, 0..1
 */
export function thrustFactor(blocked) {
  const b = clamp(blocked, 0, 1);
  return CORE_SHARE + FAN_SHARE * (1 - b) - FAN_SHARE * TURN * b;
}

/**
 * The deployment state machine.
 *
 *   stowed -> deploying -> deployed -> stowing -> stowed
 *
 * The two transitions that are not commanded - deploying to deployed and
 * stowing to stowed - happen here, when the sleeve actually arrives, exactly
 * as start-to-run does in engineState.js. The panel therefore has to compare
 * against the displayed mode every frame rather than only when a button is
 * pressed.
 */
export function createReverser() {
  const rev = {
    mode: 'stowed',
    travel: 0, // model units, 0..STROKE - what the geometry wants
    blocked: 0, // 0..1 - what the flow and the sound want
    limit: 1, // the throttle cap, rate limited on the way up

    /**
     * The button. The engine mode comes in as an argument rather than the
     * reverser holding a reference to the engine: the interlock is a fact
     * about the moment the button is pressed, and passing it keeps this module
     * free of every other one.
     *
     * @param {boolean} deploy
     * @param {string} engineMode the mode of the engine state machine
     * @returns {boolean} whether the request was taken
     */
    request(deploy, engineMode) {
      if (deploy) {
        // The model has no aircraft, so it cannot know about weight on wheels.
        // What it can know is that the engine is running, and that is the
        // interlock expressed in terms the model actually has.
        if (engineMode !== 'run') return false;
        if (rev.mode === 'deploying' || rev.mode === 'deployed') return false;
        rev.mode = 'deploying';
        return true;
      }
      if (rev.mode === 'stowing' || rev.mode === 'stowed') return false;
      rev.mode = 'stowing';
      return true;
    },

    /** @param {number} dt seconds */
    update(dt) {
      if (rev.mode === 'deploying') {
        rev.travel += (dt * STROKE) / DEPLOY_TIME;
        if (rev.travel >= STROKE) {
          rev.travel = STROKE;
          rev.mode = 'deployed';
        }
      } else if (rev.mode === 'stowing') {
        rev.travel -= (dt * STROKE) / STOW_TIME;
        if (rev.travel <= 0) {
          rev.travel = 0;
          rev.mode = 'stowed';
        }
      }
      rev.blocked = blockedFraction(rev.travel);

      // the cap drops the moment the interlock applies and is eased back up
      const target = rev.mode === 'deployed' ? REV_MAX_THROTTLE : rev.mode === 'stowed' ? 1 : 0;
      rev.limit =
        target < rev.limit ? target : Math.min(target, rev.limit + LIMIT_RATE * dt);

      return rev.travel;
    },

    /**
     * The largest throttle the lever is allowed to command, as a fraction of
     * the range. Zero while the sleeve is moving: on the aircraft the levers
     * must be at idle before the reverse levers will lift, and the same must
     * be true on the way back. This is a cap applied to what main.js passes to
     * the engine, not a move of the slider - the slider is a lever position,
     * and levers do not move on their own.
     */
    throttleLimit() {
      return rev.limit;
    },
  };

  return rev;
}
