const NS = "http://www.w3.org/2000/svg";
const VIEW = { width: 1000, height: 520, axisY: 280, opticX: 520, xMin: 20, xMax: 980, yMin: 20, yMax: 500 };
const SCALE = { x: 13, y: 20 };

const OPTICS = {
  convexLens: {
    label: "Convex Lens",
    kind: "lens",
    signF: 1,
    steps: [
      "Ray 1 (red): from object tip parallel to axis, then refract through the far focus.",
      "Ray 2 (gold): from object tip through optical center; it continues straight.",
      "Ray 3 (violet): from object tip through near focus, then refract parallel to the axis."
    ],
    finalNote: "Image tip is where refracted rays intersect."
  },
  concaveLens: {
    label: "Concave Lens",
    kind: "lens",
    signF: -1,
    steps: [
      "Ray 1 (red): from object tip parallel to axis, then refract diverging as if from near focus.",
      "Ray 2 (gold): from object tip through optical center; it continues straight.",
      "Ray 3 (violet): from object tip toward far focus, then refract parallel to axis."
    ],
    finalNote: "Extend refracted rays backward (dashed) to find the virtual image."
  },
  concaveMirror: {
    label: "Concave Mirror",
    kind: "mirror",
    signF: 1,
    steps: [
      "Ray 1 (red): from object tip parallel to axis, then reflect through focus.",
      "Ray 2 (gold): from object tip through C (center of curvature), then reflect back on itself.",
      "Ray 3 (violet): from object tip through focus, then reflect parallel to axis."
    ],
    finalNote: "Image tip is where reflected rays intersect (or dashed extensions for virtual cases)."
  },
  convexMirror: {
    label: "Convex Mirror",
    kind: "mirror",
    signF: -1,
    steps: [
      "Ray 1 (red): from object tip parallel to axis, then reflect as if from focus behind mirror.",
      "Ray 2 (gold): from object tip toward C behind mirror, then reflect back on itself.",
      "Ray 3 (violet): from object tip toward focus behind mirror, then reflect parallel to axis."
    ],
    finalNote: "Use dashed backward extensions behind mirror to locate the virtual image."
  }
};

const ui = {
  themeToggleButton: document.getElementById("themeToggleButton"),
  opticType: document.getElementById("opticType"),
  focalLength: document.getElementById("focalLength"),
  objectDistance: document.getElementById("objectDistance"),
  objectHeight: document.getElementById("objectHeight"),
  focalValue: document.getElementById("focalValue"),
  distanceValue: document.getElementById("distanceValue"),
  heightValue: document.getElementById("heightValue"),
  ray1: document.getElementById("ray1"),
  ray2: document.getElementById("ray2"),
  ray3: document.getElementById("ray3"),
  svg: document.getElementById("simSvg"),
  metrics: document.getElementById("metrics"),
  raySteps: document.getElementById("raySteps"),
  guideStatus: document.getElementById("guideStatus"),
  currentInstruction: document.getElementById("currentInstruction"),
  startGuideBtn: document.getElementById("startGuideBtn"),
  nextGuideBtn: document.getElementById("nextGuideBtn"),
  showAllGuideBtn: document.getElementById("showAllGuideBtn"),
  resetGuideBtn: document.getElementById("resetGuideBtn"),
  feedback: document.getElementById("feedback"),
  challengePrompt: document.getElementById("challengePrompt"),
  resetBtn: document.getElementById("resetBtn"),
  challengeBtn: document.getElementById("challengeBtn"),
  checkBtn: document.getElementById("checkBtn"),
  revealBtn: document.getElementById("revealBtn"),
  guessDi: document.getElementById("guessDi"),
  guessHi: document.getElementById("guessHi"),
  guessType: document.getElementById("guessType")
};

const challenge = {
  active: false,
  revealed: false
};

const guide = {
  step: 1
};

function applyTheme(theme) {
  const safeTheme = theme === "light" ? "light" : "dark";
  document.body.dataset.theme = safeTheme;
  ui.themeToggleButton.textContent = safeTheme === "dark" ? "Switch to Light Theme" : "Switch to Dark Theme";
  ui.themeToggleButton.setAttribute("aria-pressed", safeTheme === "dark" ? "true" : "false");
  try {
    localStorage.setItem("image-lab-theme", safeTheme);
  } catch {
    // Ignore storage failures.
  }
}

function initTheme() {
  let theme = "dark";
  try {
    const stored = localStorage.getItem("image-lab-theme");
    if (stored === "dark" || stored === "light") {
      theme = stored;
    }
  } catch {
    theme = "dark";
  }
  applyTheme(theme);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function fmt(value, digits = 2) {
  return `${value.toFixed(digits)} cm`;
}

function createSvg(tag, attrs = {}) {
  const el = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([key, value]) => {
    el.setAttribute(key, String(value));
  });
  return el;
}

function clearChildren(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function pointAtX(a, b, x) {
  const dx = b.x - a.x;
  if (Math.abs(dx) < 1e-6) {
    return { x, y: a.y };
  }
  const t = (x - a.x) / dx;
  return { x, y: a.y + t * (b.y - a.y) };
}

function computeImage(optic, doCm, fCm, hoCm) {
  const invDi = 1 / fCm - 1 / doCm;
  const isInfinity = Math.abs(invDi) < 1e-4;

  if (isInfinity) {
    return {
      di: Number.POSITIVE_INFINITY,
      hi: Number.POSITIVE_INFINITY,
      m: Number.POSITIVE_INFINITY,
      isInfinity: true,
      imageType: "real",
      orientation: "undefined"
    };
  }

  const di = 1 / invDi;
  const m = -di / doCm;
  const hi = m * hoCm;

  return {
    di,
    hi,
    m,
    isInfinity: false,
    imageType: di > 0 ? "real" : "virtual",
    orientation: hi >= 0 ? "upright" : "inverted"
  };
}

function getVisibleRays() {
  return [ui.ray1.checked, ui.ray2.checked, ui.ray3.checked];
}

function getScenario() {
  const opticKey = ui.opticType.value;
  const optic = OPTICS[opticKey];
  const absF = Number(ui.focalLength.value);
  const fCm = optic.signF * absF;
  const doCm = Number(ui.objectDistance.value);
  const hoCm = Number(ui.objectHeight.value);
  const image = computeImage(optic, doCm, fCm, hoCm);

  const objectBase = { x: VIEW.opticX - doCm * SCALE.x, y: VIEW.axisY };
  const objectTop = { x: objectBase.x, y: VIEW.axisY - hoCm * SCALE.y };

  let imageTop = null;
  if (!image.isInfinity) {
    const imageX = optic.kind === "lens" ? VIEW.opticX + image.di * SCALE.x : VIEW.opticX - image.di * SCALE.x;
    const imageY = VIEW.axisY - image.hi * SCALE.y;
    imageTop = { x: imageX, y: imageY };
  }

  return {
    optic,
    absF,
    fCm,
    doCm,
    hoCm,
    image,
    objectBase,
    objectTop,
    imageTop,
    showRay: getVisibleRays()
  };
}

function drawArrow(group, base, top, className, label) {
  const shaft = createSvg("line", {
    x1: base.x,
    y1: base.y,
    x2: top.x,
    y2: top.y,
    class: className
  });
  group.append(shaft);

  const up = top.y < base.y;
  group.append(
    createSvg("line", {
      x1: top.x,
      y1: top.y,
      x2: top.x - 8,
      y2: top.y + (up ? 10 : -10),
      class: className
    }),
    createSvg("line", {
      x1: top.x,
      y1: top.y,
      x2: top.x + 8,
      y2: top.y + (up ? 10 : -10),
      class: className
    })
  );

  const text = createSvg("text", {
    x: top.x,
    y: top.y + (up ? -9 : 17),
    class: "image-label",
    "text-anchor": "middle"
  });
  text.textContent = label;
  group.append(text);
}

function addMarker(group, x, label, y = VIEW.axisY) {
  group.append(
    createSvg("line", { x1: x, y1: y - 10, x2: x, y2: y + 10, class: "marker" }),
    createSvg("text", { x, y: y + 26, class: "marker-label", "text-anchor": "middle" })
  );
  group.lastChild.textContent = label;
}

function drawOpticElements(root, scenario) {
  const { optic, absF } = scenario;
  const fPx = absF * SCALE.x;

  root.append(
    createSvg("line", {
      x1: VIEW.xMin,
      y1: VIEW.axisY,
      x2: VIEW.xMax,
      y2: VIEW.axisY,
      class: "axis"
    })
  );

  if (optic.kind === "lens") {
    const isConvex = optic.signF > 0;
    const yTop = 116;
    const yBottom = 444;
    const pathD = isConvex
      ? `M ${VIEW.opticX - 14} ${yTop} Q ${VIEW.opticX - 46} ${VIEW.axisY} ${VIEW.opticX - 14} ${yBottom} L ${
          VIEW.opticX + 14
        } ${yBottom} Q ${VIEW.opticX + 46} ${VIEW.axisY} ${VIEW.opticX + 14} ${yTop} Z`
      : `M ${VIEW.opticX - 22} ${yTop} Q ${VIEW.opticX + 8} ${VIEW.axisY} ${VIEW.opticX - 22} ${yBottom} L ${
          VIEW.opticX + 22
        } ${yBottom} Q ${VIEW.opticX - 8} ${VIEW.axisY} ${VIEW.opticX + 22} ${yTop} Z`;

    root.append(createSvg("path", { d: pathD, class: "optic-fill" }));
    root.append(
      createSvg("line", {
        x1: VIEW.opticX,
        y1: yTop - 8,
        x2: VIEW.opticX,
        y2: yBottom + 8,
        class: "optic-midline"
      })
    );
    addMarker(root, VIEW.opticX - fPx, "F");
    addMarker(root, VIEW.opticX + fPx, "F");
    addMarker(root, VIEW.opticX - 2 * fPx, "2F");
    addMarker(root, VIEW.opticX + 2 * fPx, "2F");
  } else {
    const isConcave = optic.signF > 0;
    const yTop = 116;
    const yBottom = 444;
    const controlX = isConcave ? VIEW.opticX + 24 : VIEW.opticX - 24;
    const pathD = `M ${VIEW.opticX} ${yTop} Q ${controlX} ${VIEW.axisY} ${VIEW.opticX} ${yBottom}`;

    root.append(createSvg("path", { d: pathD, class: "optic-line" }));

    const fSign = isConcave ? -1 : 1;
    addMarker(root, VIEW.opticX + fSign * fPx, "F");
    addMarker(root, VIEW.opticX + fSign * 2 * fPx, "C");
  }

  const centerLabel = createSvg("text", {
    x: VIEW.opticX,
    y: VIEW.axisY - 13,
    class: "marker-label",
    "text-anchor": "middle"
  });
  centerLabel.textContent = optic.kind === "lens" ? "Optical Center" : "Mirror Vertex";
  root.append(centerLabel);
}

function raySpec(scenario) {
  const { optic, absF, objectTop } = scenario;
  const opticKey = ui.opticType.value;
  const fPx = absF * SCALE.x;
  const focusLeft = { x: VIEW.opticX - fPx, y: VIEW.axisY };
  const focusRight = { x: VIEW.opticX + fPx, y: VIEW.axisY };
  const centerLeft = { x: VIEW.opticX - 2 * fPx, y: VIEW.axisY };
  const centerRight = { x: VIEW.opticX + 2 * fPx, y: VIEW.axisY };

  const rayData = {
    incoming: [null, null, null],
    outgoing: [null, null, null]
  };

  if (opticKey === "convexLens") {
    rayData.incoming[0] = { from: objectTop, hit: { x: VIEW.opticX, y: objectTop.y } };
    rayData.outgoing[0] = { mode: "through", ref: focusRight, side: "right" };

    rayData.incoming[1] = { from: objectTop, hit: { x: VIEW.opticX, y: VIEW.axisY } };
    rayData.outgoing[1] = { mode: "through", ref: objectTop, side: "right" };

    const hit3 = pointAtX(objectTop, focusLeft, VIEW.opticX);
    rayData.incoming[2] = { from: objectTop, hit: hit3 };
    rayData.outgoing[2] = { mode: "parallel", y: hit3.y, side: "right" };
  }

  if (opticKey === "concaveLens") {
    rayData.incoming[0] = { from: objectTop, hit: { x: VIEW.opticX, y: objectTop.y } };
    rayData.outgoing[0] = { mode: "through", ref: focusLeft, side: "right" };

    rayData.incoming[1] = { from: objectTop, hit: { x: VIEW.opticX, y: VIEW.axisY } };
    rayData.outgoing[1] = { mode: "through", ref: objectTop, side: "right" };

    const hit3 = pointAtX(objectTop, focusRight, VIEW.opticX);
    rayData.incoming[2] = { from: objectTop, hit: hit3 };
    rayData.outgoing[2] = { mode: "parallel", y: hit3.y, side: "right" };
  }

  if (opticKey === "concaveMirror") {
    rayData.incoming[0] = { from: objectTop, hit: { x: VIEW.opticX, y: objectTop.y } };
    rayData.outgoing[0] = { mode: "through", ref: focusLeft, side: "left" };

    const hit2 = pointAtX(objectTop, centerLeft, VIEW.opticX);
    rayData.incoming[1] = { from: objectTop, hit: hit2 };
    rayData.outgoing[1] = { mode: "through", ref: objectTop, side: "left" };

    const hit3 = pointAtX(objectTop, focusLeft, VIEW.opticX);
    rayData.incoming[2] = { from: objectTop, hit: hit3 };
    rayData.outgoing[2] = { mode: "parallel", y: hit3.y, side: "left" };
  }

  if (opticKey === "convexMirror") {
    rayData.incoming[0] = { from: objectTop, hit: { x: VIEW.opticX, y: objectTop.y } };
    rayData.outgoing[0] = { mode: "through", ref: focusRight, side: "left" };

    const hit2 = pointAtX(objectTop, centerRight, VIEW.opticX);
    rayData.incoming[1] = { from: objectTop, hit: hit2 };
    rayData.outgoing[1] = { mode: "through", ref: objectTop, side: "left" };

    const hit3 = pointAtX(objectTop, focusRight, VIEW.opticX);
    rayData.incoming[2] = { from: objectTop, hit: hit3 };
    rayData.outgoing[2] = { mode: "parallel", y: hit3.y, side: "left" };
  }

  if (optic.kind === "mirror") {
    return rayData;
  }

  return rayData;
}

function endpointForRay(hit, outSpec) {
  const xEdge = outSpec.side === "right" ? VIEW.xMax : VIEW.xMin;
  if (outSpec.mode === "parallel") {
    return { x: xEdge, y: outSpec.y };
  }
  return pointAtX(hit, outSpec.ref, xEdge);
}

function drawRays(root, scenario) {
  const spec = raySpec(scenario);
  const rayClass = ["r1", "r2", "r3"];
  const imagePoint = scenario.imageTop;
  const imageVirtual = !scenario.image.isInfinity && scenario.image.imageType === "virtual";

  for (let i = 0; i < 3; i += 1) {
    if (!scenario.showRay[i]) continue;

    const incoming = spec.incoming[i];
    const outgoing = spec.outgoing[i];
    const hit = incoming.hit;

    root.append(
      createSvg("line", {
        x1: incoming.from.x,
        y1: incoming.from.y,
        x2: hit.x,
        y2: hit.y,
        class: `ray ${rayClass[i]}`
      })
    );

    let endPoint = endpointForRay(hit, outgoing);

    if (!scenario.image.isInfinity && imagePoint) {
      const realSideRight = outgoing.side === "right" && imagePoint.x > VIEW.opticX;
      const realSideLeft = outgoing.side === "left" && imagePoint.x < VIEW.opticX;
      if (realSideRight || realSideLeft) {
        endPoint = imagePoint;
      }
    }

    root.append(
      createSvg("line", {
        x1: hit.x,
        y1: hit.y,
        x2: endPoint.x,
        y2: endPoint.y,
        class: `ray ${rayClass[i]}`
      })
    );

    if (imageVirtual && imagePoint) {
      root.append(
        createSvg("line", {
          x1: hit.x,
          y1: hit.y,
          x2: imagePoint.x,
          y2: imagePoint.y,
          class: "ray extension"
        })
      );
    }
  }
}

function drawScene(scenario) {
  clearChildren(ui.svg);

  const layer = createSvg("g", {});
  ui.svg.append(layer);

  drawOpticElements(layer, scenario);

  const objectGroup = createSvg("g", {});
  layer.append(objectGroup);
  drawArrow(objectGroup, scenario.objectBase, scenario.objectTop, "object", "Object");

  layer.append(
    createSvg("line", {
      x1: scenario.objectTop.x,
      y1: scenario.objectTop.y,
      x2: scenario.objectTop.x,
      y2: VIEW.axisY,
      class: "guide"
    })
  );

  drawRays(layer, scenario);

  const visibleRayCount = scenario.showRay.filter(Boolean).length;
  if (visibleRayCount === 0) {
    const noRayLabel = createSvg("text", {
      x: 500,
      y: 62,
      class: "value-label",
      "text-anchor": "middle"
    });
    noRayLabel.textContent = "No rays shown. Use Start Guide or the ray checkboxes.";
    layer.append(noRayLabel);
  }

  if (!scenario.image.isInfinity && scenario.imageTop) {
    const x = scenario.imageTop.x;
    const y = scenario.imageTop.y;
    const isVisible = x > VIEW.xMin + 4 && x < VIEW.xMax - 4 && y > VIEW.yMin - 120 && y < VIEW.yMax + 120;

    if (isVisible) {
      const imgClass = `image ${scenario.image.imageType === "real" ? "real" : "virtual"}`;
      drawArrow(layer, { x, y: VIEW.axisY }, { x, y }, imgClass, "Image");
      layer.append(
        createSvg("line", {
          x1: x,
          y1: y,
          x2: x,
          y2: VIEW.axisY,
          class: "guide"
        })
      );
    } else {
      const edgeX = clamp(x, VIEW.xMin + 20, VIEW.xMax - 20);
      const edgeLabel = createSvg("text", {
        x: edgeX,
        y: 84,
        class: "value-label",
        "text-anchor": "middle"
      });
      edgeLabel.textContent = "Image is outside this frame. Use numeric readout.";
      layer.append(edgeLabel);
    }
  }

  if (scenario.image.isInfinity) {
    const infLabel = createSvg("text", {
      x: 760,
      y: 62,
      class: "value-label",
      "text-anchor": "middle"
    });
    infLabel.textContent = "Image forms at infinity (parallel output rays).";
    layer.append(infLabel);
  }
}

function locationText(scenario) {
  if (scenario.image.isInfinity) return "at infinity";

  const distance = Math.abs(scenario.image.di).toFixed(2);

  if (scenario.optic.kind === "lens") {
    return scenario.image.di > 0 ? `${distance} cm on opposite side of lens` : `${distance} cm on object side of lens`;
  }
  return scenario.image.di > 0 ? `${distance} cm in front of mirror` : `${distance} cm behind mirror`;
}

function safeHide(value) {
  return challenge.active && !challenge.revealed ? "Hidden until check/reveal" : value;
}

function renderMetrics(scenario) {
  const rows = [];
  rows.push(["Element", scenario.optic.label]);
  rows.push(["f", `${scenario.fCm.toFixed(2)} cm`]);
  rows.push(["do", fmt(scenario.doCm)]);
  rows.push(["ho", fmt(scenario.hoCm)]);

  if (scenario.image.isInfinity) {
    rows.push(["di", safeHide("Infinity")]);
    rows.push(["hi", safeHide("Infinity")]);
    rows.push(["m", safeHide("Infinity")]);
    rows.push(["Type", safeHide("real at infinity")]);
  } else {
    rows.push(["di", safeHide(fmt(scenario.image.di))]);
    rows.push(["hi", safeHide(fmt(scenario.image.hi))]);
    rows.push(["m", safeHide(scenario.image.m.toFixed(3))]);
    rows.push(["Type", safeHide(scenario.image.imageType)]);
    rows.push(["Orientation", safeHide(scenario.image.orientation)]);
    rows.push(["Location", safeHide(locationText(scenario))]);
  }

  rows.push(["Formula", "1/do + 1/di = 1/f"]);

  clearChildren(ui.metrics);
  rows.forEach(([term, description]) => {
    const item = document.createElement("div");
    item.className = "metric-item";
    const label = document.createElement("span");
    label.className = "metric-label";
    label.textContent = term;
    const value = document.createElement("span");
    value.className = "metric-value";
    value.textContent = description;
    item.append(label, value);
    ui.metrics.append(item);
  });
}

function renderGuidance(scenario) {
  clearChildren(ui.raySteps);

  scenario.optic.steps.forEach((step, index) => {
    const li = document.createElement("li");
    li.textContent = step;
    if (guide.step === index + 1) {
      li.classList.add("active");
    }
    ui.raySteps.append(li);
  });

  ui.nextGuideBtn.disabled = guide.step >= 4;

  if (guide.step <= 0) {
    ui.guideStatus.textContent = "Guide reset: no rays shown.";
    ui.currentInstruction.textContent = "Press Start Guide to begin with Ray 1.";
    return;
  }

  if (guide.step <= 3) {
    ui.guideStatus.textContent = `Step ${guide.step} of 3.`;
    ui.currentInstruction.textContent = scenario.optic.steps[guide.step - 1];
    return;
  }

  ui.guideStatus.textContent = "Complete diagram shown.";
  ui.currentInstruction.textContent = scenario.optic.finalNote;
}

function updateValueLabels() {
  ui.focalValue.textContent = `${Number(ui.focalLength.value).toFixed(1)} cm`;
  ui.distanceValue.textContent = `${Number(ui.objectDistance.value).toFixed(1)} cm`;
  ui.heightValue.textContent = `${Number(ui.objectHeight.value).toFixed(1)} cm`;
}

function update() {
  updateValueLabels();
  const scenario = getScenario();
  drawScene(scenario);
  renderMetrics(scenario);
  renderGuidance(scenario);
}

function resetScenario() {
  ui.opticType.value = "convexLens";
  ui.focalLength.value = "8";
  ui.objectDistance.value = "16";
  ui.objectHeight.value = "4";
  applyGuideStep(1);

  challenge.active = false;
  challenge.revealed = false;
  ui.feedback.textContent = "Scenario reset.";
  ui.challengePrompt.textContent = "Challenge: Predict the image values before checking.";

  ui.guessDi.value = "";
  ui.guessHi.value = "";
  ui.guessType.value = "";

  update();
}

function pickRandom(min, max, step = 0.5) {
  const count = Math.floor((max - min) / step);
  const n = Math.floor(Math.random() * (count + 1));
  return min + n * step;
}

function newChallenge() {
  const keys = Object.keys(OPTICS);
  const opticKey = keys[Math.floor(Math.random() * keys.length)];
  const optic = OPTICS[opticKey];

  let absF = pickRandom(4, 14, 0.5);
  let doCm = pickRandom(6, 34, 0.5);

  if (optic.signF > 0) {
    while (Math.abs(doCm - absF) < 1.2) {
      doCm = pickRandom(6, 34, 0.5);
    }
  }

  let tries = 0;
  while (tries < 50) {
    const image = computeImage(optic, doCm, optic.signF * absF, 4);
    const finite = !image.isInfinity;
    const bounded = finite && Math.abs(image.di) < 45 && Math.abs(image.hi) < 18;
    if (bounded) break;

    absF = pickRandom(4, 14, 0.5);
    doCm = pickRandom(6, 34, 0.5);
    if (optic.signF > 0) {
      while (Math.abs(doCm - absF) < 1.2) {
        doCm = pickRandom(6, 34, 0.5);
      }
    }
    tries += 1;
  }

  const hoCm = pickRandom(2, 6, 0.5);

  ui.opticType.value = opticKey;
  ui.focalLength.value = String(absF);
  ui.objectDistance.value = String(doCm);
  ui.objectHeight.value = String(hoCm);

  challenge.active = true;
  challenge.revealed = false;
  applyGuideStep(1);

  ui.challengePrompt.textContent = `Practice challenge: ${optic.label}. Predict di, hi, and image type.`;
  ui.feedback.textContent = "Enter your predictions, then click Check Prediction.";

  ui.guessDi.value = "";
  ui.guessHi.value = "";
  ui.guessType.value = "";

  update();
}

function evaluatePrediction() {
  const scenario = getScenario();

  if (scenario.image.isInfinity) {
    ui.feedback.textContent = "This setup gives an image at infinity. Try another challenge for numeric checking.";
    return;
  }

  const gDi = Number(ui.guessDi.value);
  const gHi = Number(ui.guessHi.value);
  const gType = ui.guessType.value;

  if (!Number.isFinite(gDi) || !Number.isFinite(gHi) || !gType) {
    ui.feedback.textContent = "Complete di, hi, and image type before checking.";
    return;
  }

  const tolDi = Math.max(0.7, Math.abs(scenario.image.di) * 0.06);
  const tolHi = Math.max(0.4, Math.abs(scenario.image.hi) * 0.08);

  const diOk = Math.abs(gDi - scenario.image.di) <= tolDi;
  const hiOk = Math.abs(gHi - scenario.image.hi) <= tolHi;
  const typeOk = gType === scenario.image.imageType;

  const misses = [];
  if (!diOk) misses.push("di");
  if (!hiOk) misses.push("hi");
  if (!typeOk) misses.push("type");

  if (misses.length === 0) {
    challenge.active = true;
    challenge.revealed = true;
    ui.feedback.textContent = "Correct within tolerance.";
  } else {
    ui.feedback.textContent = `Not yet. Recheck: ${misses.join(", ")}.`;
  }

  update();
}

function revealAnswer() {
  challenge.active = true;
  challenge.revealed = true;
  ui.feedback.textContent = "Answer revealed.";
  update();
}

function applyGuideStep(step) {
  guide.step = clamp(step, 0, 4);
  if (guide.step <= 0) {
    ui.ray1.checked = false;
    ui.ray2.checked = false;
    ui.ray3.checked = false;
    return;
  }
  if (guide.step === 1) {
    ui.ray1.checked = true;
    ui.ray2.checked = false;
    ui.ray3.checked = false;
    return;
  }
  if (guide.step === 2) {
    ui.ray1.checked = true;
    ui.ray2.checked = true;
    ui.ray3.checked = false;
    return;
  }
  ui.ray1.checked = true;
  ui.ray2.checked = true;
  ui.ray3.checked = true;
}

[
  ui.opticType,
  ui.focalLength,
  ui.objectDistance,
  ui.objectHeight,
  ui.ray1,
  ui.ray2,
  ui.ray3
].forEach((control) => {
  control.addEventListener("input", () => {
    if (challenge.active) {
      challenge.revealed = false;
    }
    if (control === ui.opticType) {
      applyGuideStep(1);
    }

    if (control === ui.ray1 || control === ui.ray2 || control === ui.ray3) {
      if (!ui.ray1.checked && !ui.ray2.checked && !ui.ray3.checked) {
        guide.step = 0;
      } else if (ui.ray1.checked && !ui.ray2.checked && !ui.ray3.checked) {
        guide.step = 1;
      } else if (ui.ray1.checked && ui.ray2.checked && !ui.ray3.checked) {
        guide.step = 2;
      } else if (ui.ray1.checked && ui.ray2.checked && ui.ray3.checked) {
        guide.step = 3;
      } else {
        guide.step = 4;
      }
    }

    update();
  });
});

ui.startGuideBtn.addEventListener("click", () => {
  applyGuideStep(1);
  update();
});

ui.nextGuideBtn.addEventListener("click", () => {
  applyGuideStep(guide.step + 1);
  update();
});

ui.showAllGuideBtn.addEventListener("click", () => {
  applyGuideStep(4);
  update();
});

ui.resetGuideBtn.addEventListener("click", () => {
  applyGuideStep(0);
  update();
});

ui.themeToggleButton.addEventListener("click", () => {
  const nextTheme = document.body.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
});

ui.resetBtn.addEventListener("click", resetScenario);
ui.challengeBtn.addEventListener("click", newChallenge);
ui.checkBtn.addEventListener("click", evaluatePrediction);
ui.revealBtn.addEventListener("click", revealAnswer);

initTheme();
update();
