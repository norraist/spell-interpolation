const MODULE_ID = "spell-interpolation";

const CUSTOM_DAMAGE_TYPES = Object.freeze({
  tarnish: {
    label: "Tarnish",
    isPhysical: false
  },
  frost: {
    label: "Frost",
    isPhysical: false
  },
  spark: {
    label: "Spark",
    isPhysical: false
  },
  wither: {
    label: "Wither",
    isPhysical: false
  },
  corrosive: {
    label: "Corrosive",
    isPhysical: true
  },
  alkaline: {
    label: "Alkaline",
    isPhysical: false
  },
  hydraulic: {
    label: "Hydraulic",
    isPhysical: false
  },
  venom: {
    label: "Venom",
    isPhysical: true
  },
  spiritual: {
    label: "Spiritual",
    isPhysical: false
  },
  stress: {
    label: "Stress",
    isPhysical: false
  },
  tempest: {
    label: "Tempest",
    isPhysical: false
  },
  void: {
    label: "Void",
    isPhysical: false
  },
  ice: {
    label: "Ice",
    isPhysical: true
  },
  storm: {
    label: "Storm",
    isPhysical: false
  },
  vitriol: {
    label: "Vitriol",
    isPhysical: false
  },
  synaptic: {
    label: "Synaptic",
    isPhysical: false
  },
  divine: {
    label: "Divine",
    isPhysical: false
  },
  righteous: {
    label: "Righteous",
    isPhysical: true
  }
});

const DAMAGE_TYPE_INTERPOLATIONS = Object.freeze({
  tarnish: {
    from: null,
    to: "acid",
    f: 0.33
  },
  frost: {
    from: null,
    to: "cold",
    f: 0.31
  },
  spark: {
    from: null,
    to: "lightning",
    f: 0.40
  },
  wither: {
    from: null,
    to: "necrotic",
    f: 0.31
  },
  corrosive: {
    from: "acid",
    to: "bludgeoning",
    f: 0.33
  },
  alkaline: {
    from: "acid",
    to: "cold",
    f: 0.64
  },
  hydraulic: {
    from: "acid",
    to: "force",
    f: 0.33
  },
  venom: {
    from: "acid",
    to: "piercing",
    f: 0.67
  },
  spiritual: {
    from: "acid",
    to: "radiant",
    f: 0.60
  },
  stress: {
    from: "cold",
    to: "fire",
    f: 0.69
  },
  tempest: {
    from: "cold",
    to: "lightning",
    f: 0.73
  },
  void: {
    from: "cold",
    to: "necrotic",
    f: 0.50
  },
  ice: {
    from: "cold",
    to: "slashing",
    f: 0.40
  },
  storm: {
    from: "cold",
    to: "thunder",
    f: 0.73
  },
  vitriol: {
    from: "force",
    to: "poison",
    f: 0.67
  },
  synaptic: {
    from: "lightning",
    to: "psychic",
    f: 0.67
  },
  divine: {
    from: "necrotic",
    to: "radiant",
    f: 0.69
  },
  righteous: {
    from: "radiant",
    to: "slashing",
    f: 0.33
  }
});

function registerCustomDamageTypes() {
  if (!globalThis.CONFIG?.DND5E?.damageTypes) {
    console.warn(`${MODULE_ID} | CONFIG.DND5E.damageTypes was not available. Is the dnd5e system active?`);
    return;
  }

  for (const [key, data] of Object.entries(CUSTOM_DAMAGE_TYPES)) {
    CONFIG.DND5E.damageTypes[key] = {
      label: data.label,
      isPhysical: data.isPhysical,
      icon: "",
      color: new Color(0x666666),
      reference: ""
    };
  }

  console.log(`${MODULE_ID} | Registered custom damage types:`, Object.keys(CUSTOM_DAMAGE_TYPES));
}

function registerModuleSettings() {
  game.settings.register(MODULE_ID, "enableDamageInterpolation", {
    name: "Enable Damage Interpolation",
    hint: "Applies interpolated resistance, immunity, and vulnerability handling to Spell Interpolation damage types.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: false
  });

  game.settings.register(MODULE_ID, "debugDamageApplication", {
    name: "Debug Damage Application",
    hint: "Logs concise Spell Interpolation damage adjustments to the browser console. Use only while testing.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: false
  });
}

function normalizeDamageType(damageType) {
  if (damageType === null || damageType === undefined || damageType === "") return null;
  return String(damageType).trim().toLowerCase();
}

function normalizeTraitValue(value) {
  if (!value) return new Set();

  if (value instanceof Set) {
    return new Set([...value].map(normalizeDamageType).filter(Boolean));
  }

  if (Array.isArray(value)) {
    return new Set(value.map(normalizeDamageType).filter(Boolean));
  }

  if (typeof value === "string") {
    return new Set(
      value
        .split(/[;,]/)
        .map(normalizeDamageType)
        .filter(Boolean)
    );
  }

  if (typeof value.values === "function") {
    return new Set([...value.values()].map(normalizeDamageType).filter(Boolean));
  }

  return new Set();
}

function normalizeTraitInput(traits) {
  return {
    di: normalizeTraitValue(traits?.di?.value ?? traits?.di),
    dr: normalizeTraitValue(traits?.dr?.value ?? traits?.dr),
    dv: normalizeTraitValue(traits?.dv?.value ?? traits?.dv)
  };
}

function getActorTraitInput(actor) {
  return {
    di: actor?.system?.traits?.di?.value,
    dr: actor?.system?.traits?.dr?.value,
    dv: actor?.system?.traits?.dv?.value
  };
}

function getTraitFlagsForTraits(traits, damageType) {
  const type = normalizeDamageType(damageType);
  const normalizedTraits = normalizeTraitInput(traits);

  if (!type) {
    return {
      immune: false,
      resistant: false,
      vulnerable: false,
      any: false
    };
  }

  const immune = normalizedTraits.di.has(type);
  const resistant = normalizedTraits.dr.has(type);
  const vulnerable = normalizedTraits.dv.has(type);

  return {
    immune,
    resistant,
    vulnerable,
    any: immune || resistant || vulnerable
  };
}

function getFactorFromTraitFlags(flags) {
  if (flags.immune) return 0;

  let factor = 1;

  if (flags.resistant) factor *= 0.5;
  if (flags.vulnerable) factor *= 2;

  return factor;
}

function getDirectDamageFactorForTraits(traits, damageType) {
  const flags = getTraitFlagsForTraits(traits, damageType);
  return getFactorFromTraitFlags(flags);
}

function getInterpolatedDamageFactorForTraits(traits, damageType) {
  const type = normalizeDamageType(damageType);
  if (!type) return 1;

  const directFlags = getTraitFlagsForTraits(traits, type);

  // Specific custom resistance/immunity/vulnerability wins.
  //
  // Example:
  // If a creature has direct void resistance, it takes 50% void damage.
  // We do not also apply inherited cold/necrotic calculations.
  if (directFlags.any) return getFactorFromTraitFlags(directFlags);

  const interpolation = DAMAGE_TYPE_INTERPOLATIONS[type];

  // If this is not one of our custom interpolated damage types,
  // do not reinterpret it here. Midi-qol/dnd5e should handle normal damage types.
  if (!interpolation) return 1;

  const f = Number(interpolation.f);
  const r1 = getDirectDamageFactorForTraits(traits, interpolation.from);
  const r2 = getDirectDamageFactorForTraits(traits, interpolation.to);

  return ((1 - f) * r1) + (f * r2);
}

function getInterpolatedDamageFactor(actor, damageType) {
  return getInterpolatedDamageFactorForTraits(getActorTraitInput(actor), damageType);
}

function getInterpolationConfig(damageType) {
  const type = normalizeDamageType(damageType);
  if (!type) return null;

  return DAMAGE_TYPE_INTERPOLATIONS[type] ?? null;
}

function isInterpolatedDamageType(damageType) {
  const type = normalizeDamageType(damageType);
  return Boolean(type && DAMAGE_TYPE_INTERPOLATIONS[type]);
}

function getDamageAmount(detail) {
  const value = Number(detail?.value ?? detail?.damage ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function setDamageAmount(detail, amount) {
  if (!detail || typeof detail !== "object") return;

  const safeAmount = Math.max(0, Number(amount) || 0);

  if ("damage" in detail) detail.damage = safeAmount;
  if ("value" in detail) detail.value = safeAmount;

  detail.damage = safeAmount;
  detail.value = safeAmount;
}

function roundDamage(amount) {
  return Math.max(0, Math.floor(Number(amount) || 0));
}

function getDamageItemSaveMultiplier(damageItem) {
  const multiplier = Number(
    damageItem?.calcDamageOptions?.midi?.saveMultiplier
      ?? damageItem?.saveMultiplier
      ?? 1
  );

  if (Number.isFinite(multiplier) && multiplier >= 0) return multiplier;

  return 1;
}

function getBaseDamageAmountForInterpolation(detail, rawDetail, damageItem) {
  const currentDamage = getDamageAmount(detail);
  const rawDamage = getDamageAmount(rawDetail);

  // midi-qol may keep rawDamageDetail as the pre-save damage.
  // For successful saves, use:
  //
  // raw damage × midi save multiplier
  //
  // Example:
  // raw 20 void, successful save multiplier 0.5, cold resistance interpolation 0.75
  // => 20 × 0.5 × 0.75 = 7.5 => 7
  if (rawDetail && rawDamage > 0) {
    return rawDamage * getDamageItemSaveMultiplier(damageItem);
  }

  return currentDamage;
}

function sumDamageDetails(details) {
  if (!Array.isArray(details)) return 0;
  return details.reduce((total, detail) => total + getDamageAmount(detail), 0);
}

function setArrayDamageSummary(details) {
  if (!Array.isArray(details)) return;

  const amount = sumDamageDetails(details);

  details.amount = amount;
  details.temp = Number(details.temp ?? 0);
  details.tempMax = Number(details.tempMax ?? 0);
}

function getRawDamageDetailArray(damageItem, damageDetailsKey) {
  const damageDetails = damageItem?.damageDetails;
  const rawKey = damageDetailsKey ? `raw${damageDetailsKey}` : null;

  if (rawKey && Array.isArray(damageDetails?.[rawKey])) {
    return damageDetails[rawKey];
  }

  if (Array.isArray(damageItem?.rawDamageDetail)) {
    return damageItem.rawDamageDetail;
  }

  return null;
}

function adjustDamageDetailArray(details, rawDetails, actorTraits, damageItem, seenDetails = new WeakSet()) {
  if (!Array.isArray(details)) {
    return {
      changed: false,
      adjustments: []
    };
  }

  const adjustments = [];

  details.forEach((detail, index) => {
    if (!detail || typeof detail !== "object") return;

    if (seenDetails.has(detail)) return;
    seenDetails.add(detail);

    const rawDetail = rawDetails?.[index] ?? detail;
    const damageType = normalizeDamageType(detail?.type ?? rawDetail?.type);

    if (!isInterpolatedDamageType(damageType)) return;

    const rawDamage = getDamageAmount(rawDetail);
    const currentDamage = getDamageAmount(detail);
    const baseDamage = getBaseDamageAmountForInterpolation(detail, rawDetail, damageItem);
    const factor = getInterpolatedDamageFactorForTraits(actorTraits, damageType);
    const adjustedDamage = roundDamage(baseDamage * factor);

    setDamageAmount(detail, adjustedDamage);

    if (!detail.active || typeof detail.active !== "object") {
      detail.active = {};
    }

    detail.active.multiplier = factor;

    adjustments.push({
      index,
      type: damageType,
      rawDamage,
      currentDamage,
      baseDamage,
      saveMultiplier: getDamageItemSaveMultiplier(damageItem),
      factor,
      adjustedDamage
    });
  });

  setArrayDamageSummary(details);

  return {
    changed: adjustments.length > 0,
    adjustments
  };
}

function recomputeDamageApplicationFields(damageItem, totalDamage) {
  if (!damageItem || typeof damageItem !== "object") return;

  const safeTotalDamage = roundDamage(totalDamage);
  const oldHP = Number(damageItem.oldHP ?? 0);
  const oldTempHP = Number(damageItem.oldTempHP ?? 0);

  const tempDamage = Math.min(oldTempHP, safeTotalDamage);
  const hpDamage = safeTotalDamage - tempDamage;

  damageItem.totalDamage = safeTotalDamage;
  damageItem.healingAdjustedTotalDamage = safeTotalDamage;
  damageItem.tempDamage = tempDamage;
  damageItem.hpDamage = hpDamage;
  damageItem.newTempHP = Math.max(0, oldTempHP - tempDamage);
  damageItem.newHP = Math.max(0, oldHP - hpDamage);

  const selector = damageItem.damageSelector;
  const selectedDetails = selector ? damageItem.damageDetails?.[selector] : null;

  if (Array.isArray(damageItem.damageDetail)) {
    setArrayDamageSummary(damageItem.damageDetail);
  }

  if (Array.isArray(selectedDetails)) {
    setArrayDamageSummary(selectedDetails);
  }
}

function markDamageItemApplied(damageItem) {
  try {
    Object.defineProperty(damageItem, "__spellInterpolationApplied", {
      value: true,
      writable: true,
      configurable: true
    });
  } catch (_error) {
    damageItem.__spellInterpolationApplied = true;
  }
}

function adjustDamageItemForInterpolation(damageItem, targetActor) {
  if (!damageItem || typeof damageItem !== "object") {
    return {
      changed: false,
      reason: "No damage item."
    };
  }

  if (damageItem.__spellInterpolationApplied) {
    return {
      changed: false,
      reason: "Damage item already adjusted."
    };
  }

  if (!targetActor) {
    return {
      changed: false,
      reason: "No target actor."
    };
  }

  const actorTraits = getActorTraitInput(targetActor);
  const allAdjustments = [];
  const seenDetails = new WeakSet();

  const mainRawDetails = getRawDamageDetailArray(damageItem, damageItem.damageSelector);
  const mainResult = adjustDamageDetailArray(
    damageItem.damageDetail,
    mainRawDetails,
    actorTraits,
    damageItem,
    seenDetails
  );

  allAdjustments.push(...mainResult.adjustments);

  const damageDetails = damageItem.damageDetails;

  if (damageDetails && typeof damageDetails === "object") {
    for (const key of ["combinedDamage", "defaultDamage", "bonusDamage", "otherDamage"]) {
      const detailArray = damageDetails[key];

      if (!Array.isArray(detailArray)) continue;

      const rawDetails = getRawDamageDetailArray(damageItem, key);
      const result = adjustDamageDetailArray(
        detailArray,
        rawDetails,
        actorTraits,
        damageItem,
        seenDetails
      );

      allAdjustments.push(
        ...result.adjustments.map((adjustment) => ({
          ...adjustment,
          damageDetailsKey: key
        }))
      );
    }
  }

  if (allAdjustments.length === 0) {
    markDamageItemApplied(damageItem);

    return {
      changed: false,
      reason: "No interpolated damage types found."
    };
  }

  const selectedDetails =
    damageItem.damageSelector && Array.isArray(damageItem.damageDetails?.[damageItem.damageSelector])
      ? damageItem.damageDetails[damageItem.damageSelector]
      : damageItem.damageDetail;

  const adjustedTotal = Array.isArray(selectedDetails)
    ? sumDamageDetails(selectedDetails)
    : sumDamageDetails(damageItem.damageDetail);

  recomputeDamageApplicationFields(damageItem, adjustedTotal);
  markDamageItemApplied(damageItem);

  return {
    changed: true,
    adjustedTotal,
    adjustments: allAdjustments
  };
}

function registerMidiQolDamageInterpolationHook() {
  Hooks.on("midi-qol.preTargetDamageApplication", (targetToken, context) => {
    try {
      if (!game.settings.get(MODULE_ID, "enableDamageInterpolation")) return true;

      const targetActor = targetToken?.actor;
      const damageItems = [
        context?.damageItem,
        context?.ditem,
        context?.workflow?.damageItem,
        ...(Array.isArray(context?.workflow?.damageList) ? context.workflow.damageList : [])
      ].filter(Boolean);

      const uniqueDamageItems = [...new Set(damageItems)];
      const results = uniqueDamageItems.map((damageItem) => adjustDamageItemForInterpolation(damageItem, targetActor));
      const changedResults = results.filter((result) => result.changed);

      if (game.settings.get(MODULE_ID, "debugDamageApplication") && changedResults.length > 0) {
        console.groupCollapsed(`${MODULE_ID} | Applied interpolated damage`);
        console.log("Target:", targetToken?.name ?? targetActor?.name ?? targetToken);
        console.log("Results:", changedResults);
        console.log("Context:", context);
        console.groupEnd();
      }
    } catch (error) {
      console.error(`${MODULE_ID} | Error while applying interpolated damage:`, error);
    }

    return true;
  });

  console.log(`${MODULE_ID} | Registered midi-qol interpolated damage hook.`);
}

const API = Object.freeze({
  customDamageTypes: CUSTOM_DAMAGE_TYPES,
  damageTypeInterpolations: DAMAGE_TYPE_INTERPOLATIONS,
  getInterpolationConfig,
  getInterpolatedDamageFactor,
  getInterpolatedDamageFactorForTraits,
  getDirectDamageFactorForTraits,
  getTraitFlagsForTraits,
  isInterpolatedDamageType
});

Hooks.once("init", () => {
  registerCustomDamageTypes();
  registerModuleSettings();
});

Hooks.once("ready", () => {
  const module = game.modules.get(MODULE_ID);

  if (module) {
    module.api = API;
  }

  globalThis.SpellInterpolation = API;

  registerMidiQolDamageInterpolationHook();

  if (!game.modules.get("midi-qol")?.active) {
    console.warn(`${MODULE_ID} | midi-qol is not active. Damage interpolation cannot be applied until midi-qol is enabled.`);
  }

  console.log(
    `${MODULE_ID} | API ready. Try: SpellInterpolation.getInterpolatedDamageFactorForTraits({ dr: ["cold"] }, "void")`
  );
});