# CODE PULSE 🚑⚡
### *EVERY SECOND. EVERY SIGNAL. EVERY LIFE.*

An intelligent emergency-response coordination platform designed to reduce the critical time between an emergency occurring and the patient receiving life-saving medical treatment.

---

## 🌟 Primary Innovation: Dynamic Emergency Corridor

Instead of relying on static traffic junctions, **CODE PULSE** creates a moving **Dynamic Emergency Corridor** ahead of the ambulance along its projected route.

```
SOURCE
  🚑 Ambulance (GPS Updating)
   \
    \ ➔ ➔ ➔ DYNAMIC EMERGENCY CORRIDOR (0–1 KM ➔ 1–2 KM AHEAD)
     \
      \ ➔ 🏥 BEST MATCHED HOSPITAL
```

### Route-Aware Ascending Distance Search Engine
- **FIRST RANGE (0 KM ➔ 1 KM Ahead)**: Queries available Traffic Police directly ahead on the ambulance route trajectory.
  - If responder accepts $\rightarrow$ Marks **TAKE LEAD** $\rightarrow$ Halts search expansion.
- **SECOND RANGE (1 KM ➔ 2 KM Ahead)**: If no responder found in 0–1 km $\rightarrow$ automatically expands corridor search.
- **EXPANDING RANGES (2 KM ➔ 5 KM)**: Continuously monitors availability as the ambulance GPS position updates every second.

---

## 🏗️ System Architecture & Technology Stack

**CODE PULSE** is built as **ONE SINGLE UNIFIED APPLICATION**:

- **Frontend**: React + Vite + Leaflet Maps (CartoDB Dark Tiles) + Lucide Icons + Tailwind CSS
- **Backend**: Node.js + Express.js + Socket.IO (Bi-directional Real-Time Event System)
- **Database**: SQLite / MySQL managed via **Prisma ORM**
- **Authentication**: JWT + bcrypt + Role-Based Access Control

---

## 👥 Unified User Roles

After logging in, the application automatically displays the dedicated dashboard based on the user's role:

| Role | Demo Credentials | Primary Dashboard Features |
| :--- | :--- | :--- |
| **Ambulance Driver / Nurse** | `ambulance@codepulse.com` / `password123` | Patient Intake Wizard, Smart Hospital Selector, Moving Corridor Navigation, IoT Live Vitals Stream |
| **Hospital Emergency Dept** | `hospital@codepulse.com` / `password123` | Incoming Pre-Alert Queue, Patient Vitals Stream, ER Readiness Toggles (ACCEPT, MARK READY, REJECT) |
| **Traffic Police Officer** | `police@codepulse.com` / `password123` | Active Emergency Corridor Map, TAKE LEAD Button, Route Clearance & Bottleneck reporter |
| **System Admin** | `admin@codepulse.com` / `password123` | Central Command Analytics, Matching Weight Configurator, Interactive Demo Control Center |

---

## 🏥 Smart Hospital Matching Algorithm

Scored dynamically (0 - 100%) using configurable weights:
- **Medical Specialty Match**: 35%
- **Travel Time & Traffic**: 25%
- **ICU & Bed Availability**: 15%
- **Required Equipment (Cath Lab, CT Scan, MRI)**: 10%
- **Blood Bank & Type Match**: 10%
- **Hospital Readiness Status**: 5%

### Condition-Specific Emergency Optimization:
- **Cardiac**: Cardiology, Cath Lab, ICU, Blood Bank O+
- **Trauma**: Trauma Center, Emergency Surgery, CT Scan
- **Burns**: Burn Unit, Plastic Surgery, ICU
- **Stroke**: Neurology, CT/MRI, ICU
- **Maternity**: Obstetrics, NICU

---

## 🚀 Quick Setup & Local Execution

### Prerequisites
- Node.js `v18+`
- NPM `v9+`

### 1. Installation
```bash
# Clone or navigate to directory
cd codepulse

# Install dependencies
npm install
```

### 2. Database Initialization
```bash
# Push Prisma schema and seed demo dataset (Hyderabad context)
npm run setup
```

### 3. Running the Application
```bash
# Starts both Express backend (Port 5000) and Vite frontend (Port 3000)
npm run dev
```

Open your browser at:
**http://localhost:5000** (or `http://localhost:3000` with dev proxy)

---

## 🎮 Scripted Demo Walkthrough for Evaluators

1. **Log in as Ambulance Driver** (`ambulance@codepulse.com`).
2. Click **NEW PATIENT INTAKE**. Notice pre-filled **Cardiac Emergency** preset (58M, O+, HR 112, SpO2 91%).
3. Click **MATCH BEST HOSPITALS**. Notice **Apollo Hospitals Jubilee Hills** ranked #1 with **83% Suitability Score**.
4. Click **SELECT & SEND PRE-ALERT**.
5. Switch tab or log in as **Hospital ER** (`hospital@codepulse.com`). Observe incoming pre-alert card and click **ACCEPT & MARK READY**.
6. Switch back to Ambulance Cockpit. See **"✅ HOSPITAL CONFIRMED READY"**.
7. Click **START DEMO** in the Admin Control Panel. Observe ambulance move along route on Leaflet Map.
8. Watch the blue/purple **Dynamic Emergency Corridor** move 0–2.0 KM ahead of the ambulance.
9. Click **SIMULATE RESPONDER AVAILABLE** in Demo Controller. Inspector Rajesh appears 1.2 KM ahead on corridor.
10. Log in as **Traffic Police** (`police@codepulse.com`) and click **⭐ TAKE LEAD**.
11. Click **SIMULATE HOSPITAL UNAVAILABLE** in Demo Controller. System triggers **⚠️ PRIMARY HOSPITAL UNAVAILABLE**, auto-calculates **Care Hospitals Gachibowli** as best fallback, and updates route polyline seamlessly.
12. Ambulance arrives at hospital bay $\rightarrow$ Emergency analytics updated.

---

## 📄 License
Designed & Built for CODE PULSE Intelligent Emergency Coordination.
