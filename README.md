# 🚑 CODE PULSE

### Smart Emergency Corridor — Real-Time Emergency Response Coordination Platform

CODE PULSE is a real-time emergency response coordination platform designed to improve coordination between **ambulances, hospitals, traffic police, and administrators** during emergency situations.

The system combines dynamic emergency corridor coordination, route-aware responder discovery, smart hospital matching, real-time communication, and role-based dashboards in one platform.

## 🌐 Live Demo

🔗 **[Open CODE PULSE](https://smart-emergency-corridor.onrender.com/)**

## 🎥 Working Demo & Workflow Video

Watch the complete working demonstration of CODE PULSE, including the emergency corridor, ambulance coordination, hospital matching, traffic police coordination, and role-based dashboards.

▶️ **[Watch the CODE PULSE Workflow Demo](https://drive.google.com/file/d/1jktIkW7O4Pt-l3y0-IzDxQpAwe6R_con/view?usp=sharing)**

---

## ✨ Key Features

### 🚑 Ambulance Coordination

* Real-time ambulance tracking
* Emergency request management
* Dynamic emergency corridor creation
* Route-aware responder discovery
* Live GPS updates
* Emergency status updates
* Hospital recommendation and navigation

### 🏥 Hospital Coordination

* Hospital availability monitoring
* Emergency case matching
* Condition-specific hospital recommendations
* ICU and bed availability
* Equipment and specialty matching
* Blood bank availability
* Hospital readiness tracking

### 🚦 Traffic Police Coordination

* Emergency route monitoring
* Traffic coordination
* Nearby emergency alerts
* Route assistance for ambulances
* Real-time emergency status updates

### 👨‍💼 Admin Dashboard

* Monitor emergency operations
* Manage users and emergency services
* View system activity
* Monitor ambulances, hospitals, and traffic coordination

---

## 🚨 Dynamic Emergency Corridor

CODE PULSE uses a **route-aware ascending-distance search** to identify responders and coordinate an emergency corridor.

```text
Emergency Request
       │
       ▼
  0–1 KM Search
       │
       ├── Responder accepts
       │        │
       │        ▼
       │     TAKE LEAD
       │
       └── No response
                │
                ▼
           1–2 KM Search
                │
                └── No response
                         │
                         ▼
                    2–5 KM Search
```

The system expands the search area progressively instead of immediately searching the entire network.

This helps prioritize nearby responders while maintaining a fallback mechanism when no suitable responder is available.

---

## 🏥 Smart Hospital Matching

Hospitals are evaluated using multiple factors to identify suitable emergency destinations.

| Factor                  | Weight |
| ----------------------- | -----: |
| Medical Specialty       |    35% |
| Travel Time & Traffic   |    25% |
| ICU / Bed Availability  |    15% |
| Required Equipment      |    10% |
| Blood Bank / Blood Type |    10% |
| Hospital Readiness      |     5% |

### Emergency-Specific Matching

Different emergency conditions consider different medical requirements:

* **Cardiac:** Cardiology, Cath Lab, ICU, Blood Bank
* **Trauma:** Trauma Center, Emergency Surgery, CT
* **Burns:** Burn Unit, Plastic Surgery, ICU
* **Stroke:** Neurology, CT/MRI, ICU
* **Maternity:** Obstetrics, NICU

---

## ⚡ Real-Time Communication

The platform uses **Socket.IO** for real-time communication between system components.

```text
Ambulance
    │
    ├──── Emergency Updates ────► Server
    │                              │
    │                              ├──► Hospital
    │                              │
    │                              ├──► Traffic Police
    │                              │
    │                              └──► Admin
    │
    └──── Live Location Updates ─► Server
```

This allows important emergency information to be reflected across dashboards without requiring constant manual refreshes.

---

## 🔄 Application Workflow

```text
Emergency Report
       │
       ▼
Ambulance Assigned
       │
       ▼
Emergency Location Identified
       │
       ▼
Dynamic Corridor Created
       │
       ▼
Nearby Responders Coordinated
       │
       ▼
Emergency Condition Identified
       │
       ▼
Hospitals Evaluated
       │
       ▼
Best-Matching Hospital Selected
       │
       ▼
Traffic Coordination
       │
       ▼
Ambulance Reaches Hospital
```

---

## 🏗️ System Architecture

```text
┌─────────────────────────────────────────┐
│              React Frontend             │
│                                         │
│ Ambulance │ Hospital │ Police │ Admin   │
└───────────────────┬─────────────────────┘
                    │
                    │ REST API / Socket.IO
                    ▼
┌─────────────────────────────────────────┐
│          Node.js + Express Server       │
│                                         │
│ Authentication │ Emergency Logic        │
│ Hospital Match │ Real-Time Events       │
└───────────────────┬─────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│              Prisma ORM                 │
│                                         │
│        SQLite / MySQL Database          │
└─────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Technology     | Purpose                        |
| -------------- | ------------------------------ |
| React          | Frontend interface             |
| Vite           | Frontend development and build |
| Tailwind CSS   | UI styling                     |
| Leaflet        | Interactive maps               |
| Node.js        | Backend runtime                |
| Express.js     | REST API server                |
| Socket.IO      | Real-time communication        |
| Prisma         | Database ORM                   |
| SQLite / MySQL | Data storage                   |
| JWT            | Authentication                 |
| bcrypt         | Password security              |
| JavaScript     | Application development        |

---

## 📁 Project Structure

```text
CODE PULSE/
│
├── prisma/
│   └── Database schema and Prisma configuration
│
├── server/
│   └── Backend and API logic
│
├── src/
│   └── React frontend
│
├── .gitignore
├── index.html
├── package.json
├── package-lock.json
├── postcss.config.js
├── tailwind.config.js
├── vite.config.js
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

* Node.js 18+
* npm 9+

### Installation

```bash
git clone https://github.com/Akshitha363/Smart-Emergency-Corridor.git
cd Smart-Emergency-Corridor
npm install
```

### Database Setup

```bash
npm run setup
```

### Start the Application

```bash
npm run dev
```

The application can then be accessed through the local development server.

---

## 🔐 Authentication & Access Control

CODE PULSE uses role-based authentication to provide different functionality to different users.

```text
User Login
    │
    ▼
Authentication
    │
    ▼
Role Verification
    │
    ├── Ambulance
    ├── Hospital
    ├── Traffic Police
    └── Admin
```

Each role receives a dashboard and functionality relevant to its responsibilities.

---

## 🎯 Demonstration Features

The working demonstration showcases:

* Emergency request creation
* Ambulance dashboard
* Dynamic emergency corridor
* Real-time location updates
* Responder coordination
* Hospital matching
* Emergency-condition-based hospital selection
* Traffic police coordination
* Role-based dashboards
* Real-time system updates

▶️ **[View the complete workflow demonstration](https://drive.google.com/file/d/1jktIkW7O4Pt-l3y0-IzDxQpAwe6R_con/view?usp=sharing)**

---

## 🔮 Future Enhancements

* Real-world traffic API integration
* Advanced route optimization
* GPS and navigation service integration
* Push notifications
* Mobile application for emergency responders
* Hospital API integration
* Advanced emergency analytics
* Cloud-based scalable infrastructure
* Production-grade security and monitoring

---

## 📚 Learning Outcomes

Through this project, I gained practical experience in:

* Full-stack web application development
* REST API development
* Real-time communication using Socket.IO
* Role-based authentication and authorization
* Interactive map integration
* Database design and ORM usage
* Emergency workflow modelling
* Multi-role dashboard development
* Deployment of a full-stack application

---

## 👩‍💻 Author

**Akshitha Gasikanti**

B.Tech Information Technology
VNR Vignana Jyothi Institute of Engineering & Technology

GitHub: [Akshitha363](https://github.com/Akshitha363)

---

## 📄 License

No license specified.

---

> **Note:** CODE PULSE is a student/hackathon prototype developed for demonstration and educational purposes. It is not intended for real-world medical, navigation, traffic-control, or emergency-response decisions.
