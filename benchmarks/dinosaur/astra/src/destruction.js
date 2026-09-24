import { T, box, group, geo, material, C, rng, clamp, smooth } from "./common.js";
function makeDestruction(scene, targets) {
  const dustGeo = new T.BoxGeometry(1, 1, 1);
  let bursts = [], rubble = [], events = [];
  function burst(point, t, color, seed, mode) {
    let random = rng(seed);
    const dustMat = new T.MeshStandardMaterial({ color: 11971213, transparent: true, opacity: 0.36, roughness: 1, depthWrite: false });
    let dust = new T.InstancedMesh(dustGeo, dustMat, 24);
    dust.frustumCulled = false;
    scene.add(dust);
    let chunks = new T.InstancedMesh(geo, material(color), 28);
    chunks.castShadow = true;
    chunks.receiveShadow = true;
    chunks.frustumCulled = false;
    scene.add(chunks);
    let particles = Array.from({ length: 28 }, (_, i) => ({ x: (random() - 0.5) * 3, z: (random() - 0.5) * 3, y: 1 + random() * 2.8, size: 0.08 + random() * 0.16, rot: random() * 6 }));
    bursts.push({ point: point.clone(), t, dust, chunks, particles, mode });
  }
  function hit(target, t, point) {
    target.at = t;
    target.state = "damaged";
    events.push({ id: target.id, time: +t.toFixed(3), contact: point.toArray().map((v) => +v.toFixed(3)), distance: +target.bounds.distanceToPoint(point).toFixed(3) });
    let rand = rng(target.id === "stomp" ? 1 : target.id === "ram" ? 2 : 3);
    target.parts.forEach((p) => {
      let affected = target.id === "stomp" || target.id === "ram" && (p.col < 2 || p.level > 0) || (target.id === "tail" || target.id === "fixture") && (p.level > 0 || p.col === 0);
      if (!affected) return;
      const origin = p.mesh.position.clone();
      let direction = target.id === "ram" ? 1 : target.id === "tail" || target.id === "fixture" ? -1 : 0;
      const rx = rand() - 0.5, rz = rand() - 0.5;
      let delay = p.level * 0.17 + (target.id === "ram" ? p.col * 0.06 : 0);
      let targetPos = new T.Vector3(origin.x + direction * (0.7 + rand() * 1.1) + rx * 0.8, 0.25 + p.size.y * 0.22 + (p.level === 0 ? 0 : rand() * 0.33), origin.z + rz * 2.6 + (target.id === "tail" ? -1.1 : 0));
      let endRot = new T.Vector3((rand() - 0.5) * 0.6, (rand() - 0.5) * 0.75, (target.id === "ram" ? -1 : 1) * (0.28 + rand() * 0.7));
      if (target.id === "fixture") {
        endRot.set(-1.48, 0.3, 0.18);
        targetPos.set(-0.4, 0.2, -0.7);
      }
      if (target.id === "stomp") {
        endRot.set(rx * 0.18, rz * 0.3, rx * 0.18);
        targetPos.y = 0.22;
      }
      rubble.push({ p, origin, targetPos, endRot, t: t + delay, duration: target.id === "stomp" ? 0.5 : 1 + rand() * 0.45, flatten: target.id === "stomp" ? 0.16 : 0.48 });
    });
    burst(point, t, target.color, events.length * 19, target.id);
  }
  const windows = { stomp: [18.12, 19.1], ram: [25.15, 27], tail: [35, 38.5] };
  const radii = { stomp: 0.04, ram: 0.09, tail: 0.18 };
  function update(t, contacts) {
    for (let target of targets) {
      const attack = target.attack || target.id;
      const [a, b] = windows[attack];
      if (target.at === null && t >= a && t <= b) {
        const points = Array.isArray(contacts[attack]) ? contacts[attack] : [contacts[attack]];
        let point = points.find((p) => target.bounds.distanceToPoint(p) <= radii[attack]);
        if (point) hit(target, t, point);
      }
    }
    for (let r of rubble) {
      let u = clamp((t - r.t) / r.duration), e = smooth(u);
      r.p.mesh.position.lerpVectors(r.origin, r.targetPos, e);
      r.p.mesh.position.y += Math.sin(u * Math.PI) * 0.2;
      r.p.mesh.rotation.set(r.endRot.x * e, r.endRot.y * e, r.endRot.z * e);
      r.p.mesh.scale.y = 1 - (1 - r.flatten) * e;
      if (u > 0) {
        r.p.mesh.updateWorldMatrix(true, true);
        let b = new T.Box3().setFromObject(r.p.mesh);
        if (b.min.y < 0.09) r.p.mesh.position.y += 0.09 - b.min.y;
        else if (u > 0.85) r.p.mesh.position.y += (0.09 - b.min.y) * smooth((u - 0.85) / 0.15);
      }
    }
    const dummy = new T.Object3D();
    for (let b of bursts) {
      let age = t - b.t;
      b.dust.visible = age < 4.5;
      b.dust.material.opacity = 0.33 * (1 - clamp(age / 4.5));
      b.particles.forEach((p, i) => {
        let a = clamp(age, 0, 2.6), land = 2 * p.y / 7;
        let flight = Math.min(a, land);
        dummy.position.set(b.point.x + p.x * flight, b.point.y + p.y * flight - 3.5 * flight * flight, b.point.z + p.z * flight);
        let ground = p.size * 0.8 + 0.1;
        dummy.position.y = Math.max(ground, dummy.position.y - 3 * Math.max(0, a - land));
        dummy.rotation.set(p.rot * flight, p.rot * 0.3 * flight, p.rot * 0.6 * flight);
        dummy.scale.setScalar(p.size);
        dummy.updateMatrix();
        b.chunks.setMatrixAt(i, dummy.matrix);
        if (i < 24) {
          dummy.position.set(b.point.x + p.x * age * 0.45, Math.max(0.4, b.point.y * 0.55) + age * 0.45, b.point.z + p.z * age * 0.45);
          dummy.scale.setScalar((0.3 + age * 0.25) * (1 + Math.sin(i) * 0.2));
          dummy.updateMatrix();
          b.dust.setMatrixAt(i, dummy.matrix);
        }
      });
      b.chunks.instanceMatrix.needsUpdate = true;
      b.dust.instanceMatrix.needsUpdate = true;
    }
    targets.forEach((o) => {
      if (o.at !== null && t - o.at > 2.4) o.state = "ruin";
    });
  }
  function reset() {
    for (let t of targets) {
      t.at = null;
      t.state = "intact";
      t.parts.forEach((p) => {
        p.mesh.position.copy(p.origin);
        p.mesh.rotation.copy(p.rotation);
        p.mesh.scale.set(1, 1, 1);
      });
    }
    for (let b of bursts) {
      scene.remove(b.dust, b.chunks);
      b.dust.material.dispose();
      b.dust.dispose();
      b.chunks.dispose();
    }
    bursts = [];
    rubble = [];
    events = [];
  }
  return { update, reset, get events() {
    return events;
  }, get debrisCount() {
    return rubble.length + bursts.length * 28;
  }, get activeDust() {
    return bursts.filter((b) => b.dust.visible).length;
  }, get settledMinY() {
    return rubble.length ? Math.min(...rubble.map((r) => (r.p.mesh.updateWorldMatrix(true, true), new T.Box3().setFromObject(r.p.mesh).min.y))) : null;
  } };
}
export {
  makeDestruction
};
