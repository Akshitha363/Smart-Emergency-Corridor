import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding CODE PULSE Hyderabad Demo Dataset...');

  // Clean existing tables
  await prisma.emergencyEvent.deleteMany();
  await prisma.hospitalAlert.deleteMany();
  await prisma.responderAlert.deleteMany();
  await prisma.tripHospitalAttempt.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.vitals.deleteMany();
  await prisma.trafficBottleneck.deleteMany();
  await prisma.trafficSignal.deleteMany();
  await prisma.emergencyTrip.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.responder.deleteMany();
  await prisma.hospitalResource.deleteMany();
  await prisma.hospitalSpecialty.deleteMany();
  await prisma.hospital.deleteMany();
  await prisma.ambulance.deleteMany();
  await prisma.user.deleteMany();
  await prisma.systemConfig.deleteMany();

  // Create default system configuration
  await prisma.systemConfig.create({
    data: {
      id: 'default',
      initialRadiusKm: 1.0,
      radiusStepKm: 1.0,
      maxRadiusKm: 5.0,
      reminderIntervalSec: 30,
      escalationTimeoutSec: 30,
      maxHospitalFallbackAttempts: 5,
      hospitalWeightsJson: JSON.stringify({
        specialty: 0.35,
        travelTime: 0.25,
        icu: 0.15,
        equipment: 0.10,
        blood: 0.10,
        readiness: 0.05,
      }),
    },
  });

  // 1. Demo Users
  const hashedPassword = await bcrypt.hash('password123', 10);

  const users = await Promise.all([
    prisma.user.create({
      data: {
        email: 'ambulance@codepulse.com',
        password: hashedPassword,
        name: 'Paramedic Suresh Kumar',
        role: 'AMBULANCE',
        station: 'Gachibowli Emergency Hub',
      },
    }),
    prisma.user.create({
      data: {
        email: 'hospital@codepulse.com',
        password: hashedPassword,
        name: 'Dr. Ananya Rao (ER Head)',
        role: 'HOSPITAL',
        station: 'Apollo Jubilee Hills Emergency Dept',
      },
    }),
    prisma.user.create({
      data: {
        email: 'police@codepulse.com',
        password: hashedPassword,
        name: 'Inspector Rajesh Varma',
        role: 'TRAFFIC',
        station: 'Cyberabad Traffic Police Sector 4',
      },
    }),
    prisma.user.create({
      data: {
        email: 'admin@codepulse.com',
        password: hashedPassword,
        name: 'System Administrator',
        role: 'ADMIN',
        station: 'Central Command Center',
      },
    }),
    prisma.user.create({
      data: {
        email: 'provider@codepulse.com',
        password: hashedPassword,
        name: 'Sandeep (Highway Emergency Service)',
        role: 'SERVICE_PROVIDER',
        station: 'Cyberabad Rescue Unit',
      },
    }),
  ]);

  console.log(`✅ Created ${users.length} demo users`);

  // 2. Fictional Hyderabad Hospitals
  const hospitalApollo = await prisma.hospital.create({
    data: {
      name: 'Apollo Hospitals (Jubilee Hills)',
      code: 'APOLLO_JH',
      lat: 17.4262,
      lng: 78.4116,
      totalBeds: 450,
      emergencyBeds: 24,
      icuBeds: 60,
      availableIcuBeds: 8,
      readinessStatus: 'READY',
      contactPhone: '+91 40 2360 7777',
      specialties: {
        create: [
          { specialty: 'CARDIOLOGY' },
          { specialty: 'TRAUMA' },
          { specialty: 'NEUROLOGY' },
          { specialty: 'EMERGENCY_SURGERY' },
          { specialty: 'BURNS' },
        ],
      },
      resources: {
        create: [
          { resourceType: 'CATH_LAB', availableCount: 3 },
          { resourceType: 'CT_SCAN', availableCount: 2 },
          { resourceType: 'MRI', availableCount: 2 },
          { resourceType: 'BLOOD_BANK', availableCount: 1 },
          { resourceType: 'BLOOD_O_POS', availableCount: 15 },
          { resourceType: 'BLOOD_A_POS', availableCount: 12 },
          { resourceType: 'BURN_UNIT', availableCount: 4 },
        ],
      },
    },
  });

  const hospitalKims = await prisma.hospital.create({
    data: {
      name: 'KIMS Hospitals (Secunderabad)',
      code: 'KIMS_SEC',
      lat: 17.4375,
      lng: 78.4983,
      totalBeds: 500,
      emergencyBeds: 30,
      icuBeds: 75,
      availableIcuBeds: 12,
      readinessStatus: 'READY',
      contactPhone: '+91 40 4488 5000',
      specialties: {
        create: [
          { specialty: 'CARDIOLOGY' },
          { specialty: 'NEUROLOGY' },
          { specialty: 'EMERGENCY_SURGERY' },
          { specialty: 'PEDIATRICS' },
        ],
      },
      resources: {
        create: [
          { resourceType: 'CATH_LAB', availableCount: 4 },
          { resourceType: 'CT_SCAN', availableCount: 3 },
          { resourceType: 'BLOOD_BANK', availableCount: 1 },
          { resourceType: 'BLOOD_O_POS', availableCount: 20 },
        ],
      },
    },
  });

  const hospitalCare = await prisma.hospital.create({
    data: {
      name: 'Care Hospitals (Gachibowli)',
      code: 'CARE_GACH',
      lat: 17.4435,
      lng: 78.3662,
      totalBeds: 300,
      emergencyBeds: 18,
      icuBeds: 40,
      availableIcuBeds: 5,
      readinessStatus: 'READY',
      contactPhone: '+91 40 6165 6565',
      specialties: {
        create: [
          { specialty: 'TRAUMA' },
          { specialty: 'EMERGENCY_SURGERY' },
          { specialty: 'CARDIOLOGY' },
        ],
      },
      resources: {
        create: [
          { resourceType: 'CT_SCAN', availableCount: 1 },
          { resourceType: 'BLOOD_BANK', availableCount: 1 },
          { resourceType: 'BLOOD_O_POS', availableCount: 8 },
        ],
      },
    },
  });

  const hospitalYashoda = await prisma.hospital.create({
    data: {
      name: 'Yashoda Hospitals (Somajiguda)',
      code: 'YASHODA_SOM',
      lat: 17.4258,
      lng: 78.4578,
      totalBeds: 400,
      emergencyBeds: 20,
      icuBeds: 50,
      availableIcuBeds: 3,
      readinessStatus: 'BUSY',
      contactPhone: '+91 40 4567 4567',
      specialties: {
        create: [
          { specialty: 'NEUROLOGY' },
          { specialty: 'CARDIOLOGY' },
          { specialty: 'TRAUMA' },
        ],
      },
      resources: {
        create: [
          { resourceType: 'MRI', availableCount: 1 },
          { resourceType: 'CT_SCAN', availableCount: 2 },
          { resourceType: 'BLOOD_BANK', availableCount: 1 },
        ],
      },
    },
  });

  const hospitalContinental = await prisma.hospital.create({
    data: {
      name: 'Continental Hospitals (Financial District)',
      code: 'CONTINENTAL_FD',
      lat: 17.4172,
      lng: 78.3441,
      totalBeds: 350,
      emergencyBeds: 15,
      icuBeds: 45,
      availableIcuBeds: 9,
      readinessStatus: 'READY',
      contactPhone: '+91 40 6700 0000',
      specialties: {
        create: [
          { specialty: 'MATERNITY' },
          { specialty: 'PEDIATRICS' },
          { specialty: 'BURNS' },
        ],
      },
      resources: {
        create: [
          { resourceType: 'NICU', availableCount: 6 },
          { resourceType: 'BURN_UNIT', availableCount: 3 },
        ],
      },
    },
  });

  console.log('✅ Created 5 hospitals with specialties & resources');

  // 3. Ambulances
  const ambulances = await Promise.all([
    prisma.ambulance.create({
      data: {
        callSign: 'AMB-108-HYD',
        driverName: 'Suresh Kumar',
        contactNumber: '+91 98765 43210',
        currentLat: 17.4447, // HITEC City / Gachibowli start point
        currentLng: 78.3854,
        speed: 0.0,
        status: 'IDLE',
      },
    }),
    prisma.ambulance.create({
      data: {
        callSign: 'AMB-102-CYB',
        driverName: 'Ramesh Reddy',
        contactNumber: '+91 98765 43211',
        currentLat: 17.4389,
        currentLng: 78.4412,
        speed: 0.0,
        status: 'IDLE',
      },
    }),
    prisma.ambulance.create({
      data: {
        callSign: 'AMB-108-SEC',
        driverName: 'Mohd Imran',
        contactNumber: '+91 98765 43212',
        currentLat: 17.4410,
        currentLng: 78.4810,
        speed: 0.0,
        status: 'IDLE',
      },
    }),
  ]);

  console.log(`✅ Created ${ambulances.length} ambulances`);

  // 4. Responders (Traffic Police Officers & Service Provider First Responders)
  const responders = await Promise.all([
    prisma.responder.create({
      data: {
        name: 'Inspector Rajesh Varma',
        badgeNumber: 'TP-CYB-104',
        type: 'TRAFFIC_POLICE',
        lat: 17.4380, // ~0.8 km ahead on route
        lng: 78.3910,
        heading: 120.0,
        status: 'AVAILABLE',
        contact: '+91 91234 56789',
      },
    }),
    prisma.responder.create({
      data: {
        name: 'Sub-Inspector Vikram Reddy',
        badgeNumber: 'TP-CYB-108',
        type: 'TRAFFIC_POLICE',
        lat: 17.4310, // ~1.8 km ahead on route
        lng: 78.4020,
        heading: 115.0,
        status: 'AVAILABLE',
        contact: '+91 91234 56790',
      },
    }),
    prisma.responder.create({
      data: {
        name: 'Sandeep Sharma (Highway Rescue Lead)',
        badgeNumber: 'SP-HYD-501',
        type: 'SERVICE_PROVIDER',
        lat: 17.4350, // ~1.2 km ahead on route
        lng: 78.3880,
        heading: 90.0,
        status: 'AVAILABLE',
        contact: '+91 98888 12345',
      },
    }),
    prisma.responder.create({
      data: {
        name: 'David Raju (Cyberabad Emergency Towing)',
        badgeNumber: 'SP-CYB-502',
        type: 'SERVICE_PROVIDER',
        lat: 17.4290,
        lng: 78.4050,
        heading: 100.0,
        status: 'AVAILABLE',
        contact: '+91 98888 67890',
      },
    }),
  ]);

  console.log(`✅ Created ${responders.length} traffic police officers and service provider units`);

  // 5. Smart Infrastructure Traffic Signals & Bottlenecks
  await Promise.all([
    prisma.trafficSignal.create({
      data: {
        name: 'IKEA Junction Traffic Signal',
        lat: 17.4415,
        lng: 78.3780,
        status: 'NORMAL',
      },
    }),
    prisma.trafficSignal.create({
      data: {
        name: 'Bio-Diversity Flyover Signal',
        lat: 17.4355,
        lng: 78.3950,
        status: 'NORMAL',
      },
    }),
    prisma.trafficSignal.create({
      data: {
        name: 'Inorbit Mall Signal',
        lat: 17.4330,
        lng: 78.3870,
        status: 'NORMAL',
      },
    }),
    prisma.trafficSignal.create({
      data: {
        name: 'Jubilee Hills Check Post Signal',
        lat: 17.4285,
        lng: 78.4100,
        status: 'NORMAL',
      },
    }),
  ]);

  console.log('✅ Created Smart Traffic Infrastructure Signals');
  console.log('🚀 Seeding finished successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
