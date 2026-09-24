import React, { useState } from 'react';
import { useEmergency } from '../context/EmergencyContext';
import { useAuth } from '../context/AuthContext';
import { Activity, Hospital, CheckCircle2, ShieldAlert, ArrowRight, X } from 'lucide-react';

export default function PatientIntakeModal({ isOpen, onClose }) {
  const { token } = useAuth();
  const { fetchActiveTrip, addEventLog } = useEmergency();
  const [step, setStep] = useState(1); // 1: Patient Intake Form, 2: Smart Hospital Matching
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    age: 58,
    gender: 'Male',
    bloodGroup: 'O+',
    symptoms: 'Sudden severe chest pain radiating to left arm, acute breathlessness',
    condition: 'CARDIAC',
    priority: 'CRITICAL',
    consciousness: 'Conscious',
    injuryType: 'None',
    heartRate: 112,
    spO2: 91,
    sysBp: 90,
    diaBp: 60,
    temp: 98.6,
    respRate: 22,
    notes: 'Prior history of hypertension. Immediate Cath Lab required.',
  });

  const [matchedHospitals, setMatchedHospitals] = useState([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState(null);

  if (!isOpen) return null;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Step 1 Submit -> Request Smart Hospital Matching
  const handleIntakeSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const authToken = token || localStorage.getItem('codepulse_token');
    try {
      const res = await fetch('/api/hospitals/match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          patient: formData,
          ambulanceLat: 17.4447, // Gachibowli emergency location
          ambulanceLng: 78.3854,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMatchedHospitals(data.matches || []);
        if (data.matches && data.matches.length > 0) {
          setSelectedHospitalId(data.matches[0].hospitalId);
        }
        setStep(2);
      }
    } catch (err) {
      console.error('Matching error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Step 2 Submit -> Create Emergency Trip & Send Hospital Pre-Alert
  const handleConfirmHospital = async () => {
    if (!selectedHospitalId) return;
    setLoading(true);
    const authToken = token || localStorage.getItem('codepulse_token');
    try {
      const res = await fetch('/api/trips/intake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          patientData: formData,
          ambulanceId: 'AMB-108-HYD',
          selectedHospitalId,
          ambulanceLat: 17.4447,
          ambulanceLng: 78.3854,
        }),
      });

      if (res.ok) {
        addEventLog('PATIENT_INTAKE', `Emergency Patient Intake Completed (${formData.condition} - ${formData.priority})`);
        addEventLog('HOSPITAL_ALERTED', `Smart Hospital Selected. Pre-alert sent to hospital!`);
        await fetchActiveTrip();
        onClose();
        setStep(1);
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Intake failed: ${errData.error || 'Server error'}`);
      }
    } catch (err) {
      console.error('Trip creation error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] z-[100000]">
        
        {/* Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center">
              <Activity className="w-5 h-5 text-red-500 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold font-mono text-white">
                {step === 1 ? '🚨 EMERGENCY PATIENT INTAKE ASSESSMENT' : '🏥 SMART HOSPITAL MATCHING RANKINGS'}
              </h2>
              <p className="text-xs text-slate-400 font-sans">
                {step === 1 ? 'Enter patient condition and live vitals for automated hospital matching' : 'AI-weighted suitability scores based on specialty, travel time, ICU & equipment'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {step === 1 ? (
            <form id="intake-form" onSubmit={handleIntakeSubmit} className="space-y-4 text-xs">
              
              <div className="bg-red-950/30 border border-red-500/40 p-3 rounded-xl flex items-center justify-between text-slate-200">
                <div>
                  <span className="font-bold text-red-400 font-mono">DEMO SCENARIO PRESET:</span> 58M Critical Cardiac Emergency (O+, HR 112, SpO2 91%)
                </div>
                <span className="text-[10px] bg-red-600 text-white font-bold px-2 py-0.5 rounded uppercase">CRITICAL</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Age</label>
                  <input
                    type="number"
                    name="age"
                    value={formData.age}
                    onChange={handleInputChange}
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-red-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Gender</label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleInputChange}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-red-500"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Blood Group</label>
                  <select
                    name="bloodGroup"
                    value={formData.bloodGroup}
                    onChange={handleInputChange}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-red-500"
                  >
                    <option value="O+">O+</option>
                    <option value="A+">A+</option>
                    <option value="B+">B+</option>
                    <option value="AB+">AB+</option>
                    <option value="O-">O-</option>
                    <option value="A-">A-</option>
                    <option value="B-">B-</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Medical Condition Category</label>
                  <select
                    name="condition"
                    value={formData.condition}
                    onChange={handleInputChange}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-red-500 font-semibold"
                  >
                    <option value="CARDIAC">Cardiac Emergency (Cardiology/Cath Lab)</option>
                    <option value="TRAUMA">Trauma Center (Emergency Surgery/Blood Bank)</option>
                    <option value="BURNS">Burns (Burn Unit/Plastic Surgery)</option>
                    <option value="STROKE">Stroke (Neurology/CT/MRI)</option>
                    <option value="MATERNITY">Maternity (Obstetrics/NICU)</option>
                    <option value="PEDIATRIC">Pediatric Emergency</option>
                    <option value="RESPIRATORY">Respiratory Emergency</option>
                    <option value="ACCIDENT">Accident / Multi-trauma</option>
                    <option value="OTHER">Other Emergency</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Triage Priority</label>
                  <select
                    name="priority"
                    value={formData.priority}
                    onChange={handleInputChange}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-red-500 font-bold"
                  >
                    <option value="CRITICAL">🔴 CRITICAL (Immediate Life Threat)</option>
                    <option value="HIGH">🟠 HIGH (Severe)</option>
                    <option value="MEDIUM">🟡 MEDIUM (Urgent)</option>
                  </select>
                </div>
              </div>

              {/* Vitals Input Row */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div className="text-[11px] font-mono font-bold text-slate-400 mb-2 uppercase">Initial Patient Vitals</div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400">Heart Rate (BPM)</label>
                    <input
                      type="number"
                      name="heartRate"
                      value={formData.heartRate}
                      onChange={handleInputChange}
                      className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono font-bold text-red-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400">SpO2 (%)</label>
                    <input
                      type="number"
                      name="spO2"
                      value={formData.spO2}
                      onChange={handleInputChange}
                      className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono font-bold text-teal-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400">Sys BP</label>
                    <input
                      type="number"
                      name="sysBp"
                      value={formData.sysBp}
                      onChange={handleInputChange}
                      className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono font-bold text-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400">Dia BP</label>
                    <input
                      type="number"
                      name="diaBp"
                      value={formData.diaBp}
                      onChange={handleInputChange}
                      className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono font-bold text-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400">Resp Rate</label>
                    <input
                      type="number"
                      name="respRate"
                      value={formData.respRate}
                      onChange={handleInputChange}
                      className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-white font-mono font-bold text-emerald-400"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Symptoms Description</label>
                <textarea
                  name="symptoms"
                  rows={2}
                  value={formData.symptoms}
                  onChange={handleInputChange}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-red-500"
                />
              </div>

            </form>
          ) : (
            <div className="space-y-3">
              <div className="text-xs text-slate-300 font-medium">
                Showing best hospitals matching <strong className="text-red-400">{formData.condition}</strong> emergency in Hyderabad:
              </div>

              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {matchedHospitals.map((h, idx) => {
                  const isSelected = selectedHospitalId === h.hospitalId;
                  return (
                    <div
                      key={h.hospitalId}
                      onClick={() => setSelectedHospitalId(h.hospitalId)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-teal-950/60 border-teal-500 shadow-lg shadow-teal-500/20'
                          : 'bg-slate-800/60 border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold font-mono text-sm ${
                            idx === 0 ? 'bg-teal-500 text-slate-950' : 'bg-slate-700 text-slate-300'
                          }`}>
                            #{idx + 1}
                          </div>
                          <div>
                            <div className="font-bold text-slate-100 flex items-center gap-2">
                              {h.hospitalName}
                              {idx === 0 && (
                                <span className="text-[10px] bg-teal-500/20 text-teal-300 border border-teal-500/40 px-2 py-0.5 rounded font-mono">
                                  🏆 BEST MATCH
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-3 mt-0.5">
                              <span>Est. Time: <strong className="text-white">{h.estimatedTimeMin} mins</strong> ({h.distanceKm} km)</span>
                              <span>ICU Beds: <strong className="text-teal-400">{h.availableIcuBeds} available</strong></span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-xl font-black font-mono text-teal-400">
                            {h.totalScore}%
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono uppercase">Suitability</div>
                        </div>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-slate-700/60 flex flex-wrap gap-1.5 text-[10px]">
                        <span className="bg-slate-900 px-2 py-0.5 rounded text-slate-300">
                          Specialty: {h.breakdown.specialtyScore}%
                        </span>
                        <span className="bg-slate-900 px-2 py-0.5 rounded text-slate-300">
                          Travel: {h.breakdown.travelTimeScore}%
                        </span>
                        <span className="bg-slate-900 px-2 py-0.5 rounded text-slate-300">
                          ICU: {h.breakdown.icuScore}%
                        </span>
                        <span className="bg-slate-900 px-2 py-0.5 rounded text-slate-300">
                          Equipment: {h.breakdown.equipmentScore}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          {step === 2 ? (
            <button
              onClick={() => setStep(1)}
              className="text-xs font-semibold text-slate-400 hover:text-white px-3 py-2 rounded-lg"
            >
              ← Back to Patient Form
            </button>
          ) : (
            <div />
          )}

          {step === 1 ? (
            <button
              type="submit"
              form="intake-form"
              disabled={loading}
              className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-bold py-2.5 px-5 rounded-xl text-xs transition-all shadow-lg shadow-red-600/30"
            >
              <span>MATCH BEST HOSPITALS</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleConfirmHospital}
              disabled={loading}
              className="flex items-center gap-2 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white font-bold py-2.5 px-5 rounded-xl text-xs transition-all shadow-lg shadow-teal-600/30"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>SELECT & SEND PRE-ALERT</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
