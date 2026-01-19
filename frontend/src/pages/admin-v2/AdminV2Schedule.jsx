import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminV2Layout from './AdminV2Layout';
import config from '../../config';
import { useAuth } from '../../contexts/AuthContext';
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MedicationsIcon,
  NutritionIcon,
  TasksIcon,
  CheckIcon,
  ClockIcon,
  PatientsIcon,
  XIcon,
  EditIcon
} from '../../components/Icons';
import './AdminV2.css';

// Get initials from name
const getInitials = (name) => {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase();
};

const AdminV2Schedule = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const scrollContainerRef = useRef(null);
  
  // Patient state
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showPatientModal, setShowPatientModal] = useState(false);
  const [loadingPatients, setLoadingPatients] = useState(true);
  
  // Schedule date state
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // Schedule data state
  const [scheduleData, setScheduleData] = useState({
    medications: [],
    nutrition: [],
    care_tasks: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Format date for API (YYYY-MM-DD)
  const formatDateForApi = (date) => {
    return date.toISOString().split('T')[0];
  };

  // Format date for display
  const formatDateDisplay = (date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Check if date is today
  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Navigation functions
  const goToPreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    setSelectedDate(newDate);
  };

  const goToNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    setSelectedDate(newDate);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  // Fetch patients on mount
  useEffect(() => {
    fetchPatients();
  }, []);

  // Check for patient param and load patient
  useEffect(() => {
    const patientId = searchParams.get('patient');
    if (patientId && patients.length > 0) {
      const patient = patients.find(p => p.id === parseInt(patientId));
      if (patient) {
        setSelectedPatient(patient);
      } else {
        setShowPatientModal(true);
      }
    } else if (!patientId && patients.length > 0) {
      setShowPatientModal(true);
    }
  }, [patients, searchParams]);

  // Fetch schedule when patient or date changes
  useEffect(() => {
    if (selectedPatient) {
      fetchSchedule();
    }
  }, [selectedPatient, selectedDate]);

  // Scroll to current hour on load
  useEffect(() => {
    if (scrollContainerRef.current && isToday(selectedDate)) {
      const currentHour = new Date().getHours();
      const hourRow = scrollContainerRef.current.querySelector(`[data-hour="${currentHour}"]`);
      if (hourRow) {
        hourRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [scheduleData, selectedDate]);

  const fetchPatients = async () => {
    try {
      const response = await fetch(`${config.apiUrl}/api/patients`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setPatients(data);
      }
    } catch (err) {
      console.error('Error fetching patients:', err);
    } finally {
      setLoadingPatients(false);
    }
  };

  const fetchSchedule = async () => {
    if (!selectedPatient) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const dateParam = formatDateForApi(selectedDate);
      const response = await fetch(
        `${config.apiUrl}/api/schedule/daily?patient_id=${selectedPatient.id}&target_date=${dateParam}`,
        { credentials: 'include' }
      );

      if (response.ok) {
        const data = await response.json();
        setScheduleData({
          medications: data.medications || [],
          nutrition: data.nutrition || [],
          care_tasks: data.care_tasks || []
        });
      } else {
        setError('Failed to load schedule');
      }
    } catch (err) {
      setError('Error connecting to server');
      console.error('Error fetching schedule:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPatient = (patient) => {
    setSelectedPatient(patient);
    setSearchParams({ patient: patient.id });
    setShowPatientModal(false);
  };

  const handleChangePatient = () => {
    setShowPatientModal(true);
  };

  // Group items by hour
  const getItemsByHour = (items) => {
    const byHour = {};
    for (let h = 0; h < 24; h++) {
      byHour[h] = [];
    }
    items.forEach(item => {
      if (byHour[item.hour] !== undefined) {
        byHour[item.hour].push(item);
      }
    });
    return byHour;
  };

  const medicationsByHour = getItemsByHour(scheduleData.medications);
  const nutritionByHour = getItemsByHour(scheduleData.nutrition);
  const careTasksByHour = getItemsByHour(scheduleData.care_tasks);

  // Format hour for display
  const formatHour = (hour) => {
    if (hour === 0) return '12 AM';
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return '12 PM';
    return `${hour - 12} PM`;
  };

  // Check if an hour row has any items
  const hasItemsInHour = (hour) => {
    return medicationsByHour[hour]?.length > 0 || 
           nutritionByHour[hour]?.length > 0 || 
           careTasksByHour[hour]?.length > 0;
  };

  // Get current hour for highlighting
  const currentHour = isToday(selectedDate) ? new Date().getHours() : -1;

  // Count totals for summary
  const totalMeds = scheduleData.medications.length;
  const completedMeds = scheduleData.medications.filter(m => m.completed).length;
  const totalNutrition = scheduleData.nutrition.length;
  const completedNutrition = scheduleData.nutrition.filter(n => n.completed).length;
  const totalTasks = scheduleData.care_tasks.length;
  const completedTasks = scheduleData.care_tasks.filter(t => t.completed).length;

  return (
    <AdminV2Layout>
      <div className="admin-v2-page">
        {/* Patient Header */}
        {selectedPatient ? (
          <>
            {/* Patient Context Header */}
            <div className="schedule-patient-header">
              <div className="schedule-patient-info">
                <div className="schedule-patient-avatar">
                  {getInitials(`${selectedPatient.first_name} ${selectedPatient.last_name}`)}
                </div>
                <div className="schedule-patient-name-row">
                  <h2>{selectedPatient.first_name} {selectedPatient.last_name}</h2>
                  <button 
                    className="schedule-edit-patient-btn"
                    onClick={handleChangePatient}
                    title="Change Patient"
                  >
                    <EditIcon size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Section Title */}
            <h1 className="schedule-section-title">Daily Schedule</h1>

            {error && (
              <div className="admin-v2-error-banner">{error}</div>
            )}

            {/* Date Navigation */}
            <div className="admin-v2-schedule-nav">
              <button 
                className="admin-v2-btn admin-v2-btn-icon"
                onClick={goToPreviousDay}
                title="Previous Day"
              >
                <ChevronLeftIcon size={20} />
              </button>
              
              <div className="admin-v2-schedule-date">
                <CalendarIcon size={18} />
                <span>{formatDateDisplay(selectedDate)}</span>
                {isToday(selectedDate) && (
                  <span className="admin-v2-today-badge">Today</span>
                )}
              </div>
              
              <button 
                className="admin-v2-btn admin-v2-btn-icon"
                onClick={goToNextDay}
                title="Next Day"
              >
                <ChevronRightIcon size={20} />
              </button>

              {!isToday(selectedDate) && (
                <button 
                  className="admin-v2-btn admin-v2-btn-sm"
                  onClick={goToToday}
                  style={{ marginLeft: '1rem' }}
                >
                  Go to Today
                </button>
              )}

              <input
                type="date"
                value={formatDateForApi(selectedDate)}
                onChange={(e) => setSelectedDate(new Date(e.target.value + 'T00:00:00'))}
                className="admin-v2-date-picker"
              />
            </div>

            {/* Summary Stats */}
            <div className="admin-v2-summary-stats" style={{ marginBottom: '1.5rem' }}>
              <div className="admin-v2-stat-card">
                <div className="admin-v2-stat-icon medications">
                  <MedicationsIcon size={24} />
                </div>
                <div className="admin-v2-stat-info">
                  <h4>{completedMeds}/{totalMeds}</h4>
                  <p>Medications</p>
                </div>
              </div>
              <div className="admin-v2-stat-card">
                <div className="admin-v2-stat-icon nutrition">
                  <NutritionIcon size={24} />
                </div>
                <div className="admin-v2-stat-info">
                  <h4>{completedNutrition}/{totalNutrition}</h4>
                  <p>Nutrition</p>
                </div>
              </div>
              <div className="admin-v2-stat-card">
                <div className="admin-v2-stat-icon tasks">
                  <TasksIcon size={24} />
                </div>
                <div className="admin-v2-stat-info">
                  <h4>{completedTasks}/{totalTasks}</h4>
                  <p>Care Tasks</p>
                </div>
              </div>
            </div>

            {/* Schedule Grid */}
            <div className="admin-v2-schedule-container">
              {loading ? (
                <div className="admin-v2-loading">Loading schedule...</div>
              ) : (
                <>
                  {/* Column Headers */}
                  <div className="admin-v2-schedule-header">
                    <div className="admin-v2-schedule-time-col">Time</div>
                    <div className="admin-v2-schedule-col medications">
                      <MedicationsIcon size={16} />
                      <span>Medications</span>
                    </div>
                    <div className="admin-v2-schedule-col nutrition">
                      <NutritionIcon size={16} />
                      <span>Nutrition</span>
                    </div>
                    <div className="admin-v2-schedule-col tasks">
                      <TasksIcon size={16} />
                      <span>Care Tasks</span>
                    </div>
                  </div>

                  {/* Scrollable Hour Rows */}
                  <div className="admin-v2-schedule-body" ref={scrollContainerRef}>
                    {[...Array(24)].map((_, hour) => (
                      <div 
                        key={hour} 
                        className={`admin-v2-schedule-row ${hour === currentHour ? 'current-hour' : ''} ${hasItemsInHour(hour) ? 'has-items' : ''}`}
                        data-hour={hour}
                      >
                        {/* Time Column */}
                        <div className="admin-v2-schedule-time-col">
                          <span className="admin-v2-hour-label">{formatHour(hour)}</span>
                        </div>

                        {/* Medications Column */}
                        <div className="admin-v2-schedule-col medications">
                          {medicationsByHour[hour]?.map((med, idx) => (
                            <div 
                              key={`med-${med.schedule_id}-${idx}`} 
                              className={`admin-v2-schedule-item medication ${med.completed ? 'completed' : ''}`}
                            >
                              <div className="admin-v2-schedule-item-header">
                                <span className="admin-v2-schedule-item-time">
                                  <ClockIcon size={12} />
                                  {String(med.hour).padStart(2, '0')}:{String(med.minute).padStart(2, '0')}
                                </span>
                                {med.completed && (
                                  <span className="admin-v2-schedule-item-check">
                                    <CheckIcon size={14} />
                                  </span>
                                )}
                              </div>
                              <div className="admin-v2-schedule-item-name">{med.name}</div>
                              {med.dose_amount && (
                                <div className="admin-v2-schedule-item-dose">
                                  {med.dose_amount} {med.dose_unit}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Nutrition Column */}
                        <div className="admin-v2-schedule-col nutrition">
                          {nutritionByHour[hour]?.map((item, idx) => (
                            <div 
                              key={`nutr-${item.schedule_id}-${idx}`} 
                              className={`admin-v2-schedule-item nutrition ${item.completed ? 'completed' : ''}`}
                            >
                              <div className="admin-v2-schedule-item-header">
                                <span className="admin-v2-schedule-item-time">
                                  <ClockIcon size={12} />
                                  {String(item.hour).padStart(2, '0')}:{String(item.minute).padStart(2, '0')}
                                </span>
                                {item.completed && (
                                  <span className="admin-v2-schedule-item-check">
                                    <CheckIcon size={14} />
                                  </span>
                                )}
                              </div>
                              <div className="admin-v2-schedule-item-name">{item.name}</div>
                              {item.description && (
                                <div className="admin-v2-schedule-item-desc">{item.description}</div>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Care Tasks Column */}
                        <div className="admin-v2-schedule-col tasks">
                          {careTasksByHour[hour]?.map((task, idx) => (
                            <div 
                              key={`task-${task.schedule_id}-${idx}`} 
                              className={`admin-v2-schedule-item care-task ${task.completed ? 'completed' : ''}`}
                              style={task.category_color ? { borderLeftColor: task.category_color } : {}}
                            >
                              <div className="admin-v2-schedule-item-header">
                                <span className="admin-v2-schedule-item-time">
                                  <ClockIcon size={12} />
                                  {String(task.hour).padStart(2, '0')}:{String(task.minute).padStart(2, '0')}
                                </span>
                                {task.category_name && (
                                  <span 
                                    className="admin-v2-schedule-item-category"
                                    style={task.category_color ? { backgroundColor: task.category_color + '20', color: task.category_color } : {}}
                                  >
                                    {task.category_name}
                                  </span>
                                )}
                                {task.completed && (
                                  <span className="admin-v2-schedule-item-check">
                                    <CheckIcon size={14} />
                                  </span>
                                )}
                              </div>
                              <div className="admin-v2-schedule-item-name">{task.name}</div>
                              {task.description && (
                                <div className="admin-v2-schedule-item-desc">{task.description}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="schedule-select-patient">
            <h2>Select a Patient</h2>
            <p>Choose a patient to view their daily schedule</p>
            <button 
              className="admin-v2-btn admin-v2-btn-primary"
              onClick={() => setShowPatientModal(true)}
            >
              Select Patient
            </button>
          </div>
        )}

        {/* Patient Selection Modal */}
        {showPatientModal && (
          <div className="admin-v2-modal-overlay" onClick={() => selectedPatient && setShowPatientModal(false)}>
            <div className="admin-v2-modal" onClick={e => e.stopPropagation()}>
              <div className="admin-v2-modal-header">
                <h2>Select Patient</h2>
                {selectedPatient && (
                  <button className="admin-v2-modal-close" onClick={() => setShowPatientModal(false)}>
                    <XIcon size={20} />
                  </button>
                )}
              </div>
              <div className="admin-v2-modal-body">
                <div className="admin-v2-patient-selector-list">
                  {patients.filter(p => p.is_active).map(patient => (
                    <button
                      key={patient.id}
                      className={`admin-v2-patient-selector-item ${selectedPatient?.id === patient.id ? 'selected' : ''}`}
                      onClick={() => handleSelectPatient(patient)}
                    >
                      <div className="admin-v2-patient-avatar">
                        {patient.first_name?.[0]}{patient.last_name?.[0]}
                      </div>
                      <div className="admin-v2-patient-selector-info">
                        <span className="admin-v2-patient-name">
                          {patient.first_name} {patient.last_name}
                        </span>
                        <span className="admin-v2-patient-meta">
                          {patient.room || 'No room assigned'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminV2Layout>
  );
};

export default AdminV2Schedule;
