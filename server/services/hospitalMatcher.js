import prisma from '../config/prisma.js';

// Default scoring weights
export let currentWeights = {
  specialty: 0.35,
  travelTime: 0.25,
  icu: 0.15,
  equipment: 0.10,
  blood: 0.10,
  readiness: 0.05,
};

export async function loadSystemWeights() {
  try {
    const config = await prisma.systemConfig.findUnique({ where: { id: 'default' } });
    if (config && config.hospitalWeightsJson) {
      const parsed = JSON.parse(config.hospitalWeightsJson);
      currentWeights = { ...currentWeights, ...parsed };
    }
  } catch (err) {
    console.error('Failed to load system hospital weights from DB:', err);
  }
  return currentWeights;
}

export function updateWeights(newWeights) {
  currentWeights = { ...currentWeights, ...newWeights };
  return currentWeights;
}

// Distance calculation using Haversine formula (in KM)
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of Earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Condition to specialty / resource mapping
 */
const CONDITION_REQUIREMENTS = {
  CARDIAC: {
    specialties: ['CARDIOLOGY', 'EMERGENCY_SURGERY'],
    resources: ['CATH_LAB', 'BLOOD_BANK', 'BLOOD_O_POS'],
  },
  TRAUMA: {
    specialties: ['TRAUMA', 'EMERGENCY_SURGERY'],
    resources: ['BLOOD_BANK', 'CT_SCAN', 'BLOOD_O_POS'],
  },
  BURNS: {
    specialties: ['BURNS', 'EMERGENCY_SURGERY'],
    resources: ['BURN_UNIT', 'BLOOD_BANK'],
  },
  STROKE: {
    specialties: ['NEUROLOGY', 'EMERGENCY_SURGERY'],
    resources: ['CT_SCAN', 'MRI'],
  },
  MATERNITY: {
    specialties: ['MATERNITY'],
    resources: ['NICU', 'BLOOD_BANK'],
  },
  PEDIATRIC: {
    specialties: ['PEDIATRICS'],
    resources: ['NICU'],
  },
  RESPIRATORY: {
    specialties: ['CARDIOLOGY', 'TRAUMA'],
    resources: ['CT_SCAN'],
  },
  ACCIDENT: {
    specialties: ['TRAUMA', 'EMERGENCY_SURGERY'],
    resources: ['BLOOD_BANK', 'CT_SCAN'],
  },
  OTHER: {
    specialties: ['TRAUMA'],
    resources: [],
  },
};

/**
 * Calculates hospital suitability score (0 - 100)
 */
export async function calculateHospitalScore(hospital, patient, ambulanceLat, ambulanceLng) {
  await loadSystemWeights();

  const distKm = haversineDistance(ambulanceLat, ambulanceLng, hospital.lat, hospital.lng);
  
  // 1. Travel time score (25% weight): Assume avg 30 km/h in emergency traffic -> ~2 mins per km
  const estimatedTimeMin = Math.max(1, Math.round(distKm * 2.5));
  // Score max 100 if under 3 min, decreasing to 0 at 30 min
  const travelTimeScore = Math.max(0, Math.min(100, 100 - (estimatedTimeMin - 3) * 3.5));

  // 2. Medical Specialty score (35% weight)
  const reqs = CONDITION_REQUIREMENTS[patient.condition] || CONDITION_REQUIREMENTS.OTHER;
  const hospitalSpecs = hospital.specialties.map(s => s.specialty);
  let specialtyMatchCount = 0;
  reqs.specialties.forEach(spec => {
    if (hospitalSpecs.includes(spec)) specialtyMatchCount++;
  });
  const specialtyScore = reqs.specialties.length > 0 
    ? (specialtyMatchCount / reqs.specialties.length) * 100 
    : 80;

  // 3. ICU / Bed Availability score (15% weight)
  const icuRatio = hospital.icuBeds > 0 ? hospital.availableIcuBeds / hospital.icuBeds : 0;
  const emergencyRatio = hospital.totalBeds > 0 ? hospital.emergencyBeds / 50 : 0;
  const icuScore = Math.min(100, (icuRatio * 70 + emergencyRatio * 30));

  // 4. Required Equipment score (10% weight)
  const hospitalRes = hospital.resources.map(r => r.resourceType);
  let equipMatchCount = 0;
  reqs.resources.forEach(res => {
    if (hospitalRes.includes(res)) equipMatchCount++;
  });
  const equipmentScore = reqs.resources.length > 0
    ? (equipMatchCount / reqs.resources.length) * 100
    : 90;

  // 5. Blood Availability score (10% weight)
  const patientBlood = patient.bloodGroup;
  const hasBlood = hospitalRes.includes(`BLOOD_${patientBlood.replace('+', '_POS').replace('-', '_NEG')}`) || hospitalRes.includes('BLOOD_BANK');
  const bloodScore = hasBlood ? 100 : 40;

  // 6. Hospital Readiness score (5% weight)
  let readinessScore = 50;
  if (hospital.readinessStatus === 'READY') readinessScore = 100;
  else if (hospital.readinessStatus === 'BUSY') readinessScore = 60;
  else if (hospital.readinessStatus === 'CRITICAL_ONLY') readinessScore = 40;
  else if (hospital.readinessStatus === 'FULL') readinessScore = 0;

  // Total weighted score
  const totalScore = Math.round(
    specialtyScore * currentWeights.specialty +
    travelTimeScore * currentWeights.travelTime +
    icuScore * currentWeights.icu +
    equipmentScore * currentWeights.equipment +
    bloodScore * currentWeights.blood +
    readinessScore * currentWeights.readiness
  );

  return {
    hospitalId: hospital.id,
    hospitalName: hospital.name,
    code: hospital.code,
    lat: hospital.lat,
    lng: hospital.lng,
    readinessStatus: hospital.readinessStatus,
    availableIcuBeds: hospital.availableIcuBeds,
    distanceKm: parseFloat(distKm.toFixed(2)),
    estimatedTimeMin,
    totalScore,
    breakdown: {
      specialtyScore: Math.round(specialtyScore),
      travelTimeScore: Math.round(travelTimeScore),
      icuScore: Math.round(icuScore),
      equipmentScore: Math.round(equipmentScore),
      bloodScore: Math.round(bloodScore),
      readinessScore: Math.round(readinessScore),
    },
    specialties: hospitalSpecs,
    contactPhone: hospital.contactPhone,
  };
}

/**
 * Finds best hospitals ranked by suitability score
 */
export async function findBestHospital(patient, ambulanceLat, ambulanceLng, excludeHospitalIds = []) {
  const hospitals = await prisma.hospital.findMany({
    include: {
      specialties: true,
      resources: true,
    },
  });

  const scoredHospitals = [];
  for (const h of hospitals) {
    if (excludeHospitalIds.includes(h.id)) continue;
    // Skip hospitals that are marked FULL unless emergency
    if (h.readinessStatus === 'FULL' && patient.priority !== 'CRITICAL') continue;

    const scoreData = await calculateHospitalScore(h, patient, ambulanceLat, ambulanceLng);
    scoredHospitals.push(scoreData);
  }

  // Sort descending by total score
  scoredHospitals.sort((a, b) => b.totalScore - a.totalScore);
  return scoredHospitals;
}

/**
 * Finds best fallback hospital when primary hospital rejects or becomes unavailable
 */
export async function findFallbackHospital(patient, ambulanceLat, ambulanceLng, excludeIds = []) {
  let excluded = Array.isArray(excludeIds) ? excludeIds : [excludeIds];
  const alternatives = await findBestHospital(patient, ambulanceLat, ambulanceLng, excluded);
  return alternatives.length > 0 ? alternatives[0] : null;
}
