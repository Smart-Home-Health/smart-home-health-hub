import React, { useState, useEffect } from 'react';
import config from '../../config';
import './AdminV2.css';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState([]);
  const [summaryStats, setSummaryStats] = useState({
    totalPatients: 0,
    activePatients: 0,
    totalMedications: 0,
    pendingMedications: 0,
    missedMedications: 0,
    totalCareTasks: 0,
    pendingCareTasks: 0,
    missedCareTasks: 0,
    equipmentDue: 0
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch dashboard summary and medication schedules in parallel
      const [summaryResponse, medicationsResponse] = await Promise.all([
        fetch(`${config.apiUrl}/api/admin/dashboard/summary`),
        fetch(`${config.apiUrl}/api/admin/medications/schedules/today`)
      ]);

      if (!summaryResponse.ok || !medicationsResponse.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const summary = await summaryResponse.json();
      const medicationsData = await medicationsResponse.json();

      // Update summary stats from API
      setSummaryStats({
        totalPatients: summary.patients.total || 0,
        activePatients: summary.patients.active || 0,
        totalMedications: summary.medications.due_today || 0,
        pendingMedications: medicationsData.total_pending || 0,
        missedMedications: summary.medications.missed_today || 0,
        totalCareTasks: summary.care_tasks.due_today || 0,
        pendingCareTasks: summary.care_tasks.due_today || 0,
        missedCareTasks: summary.care_tasks.missed_today || 0,
        equipmentDue: summary.equipment.due_for_change || 0
      });

      // Transform medication data into patient rows
      const patientRows = medicationsData.patients.map(patient => ({
        id: patient.patient_id,
        name: patient.patient_name,
        mrn: 'MRN' + String(patient.patient_id).padStart(3, '0'), // Generate MRN from ID
        age: '-', // Age not available in current API
        medicationsStatus: {
          total: patient.total_scheduled,
          completed: patient.total_completed,
          pending: patient.total_pending,
          missed: patient.total_missed,
          dueSoon: patient.total_due_soon
        },
        careTasksStatus: {
          total: 0,
          completed: 0,
          pending: 0,
          missed: 0,
          dueSoon: 0
        },
        equipmentStatus: {
          total: 0,
          dueForChange: 0,
          ok: 0
        },
        lastUpdate: 'Just now'
      }));

      setPatients(patientRows);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusClass = (status) => {
    if (status.missed > 0) return 'status-critical';
    if (status.pending > 2) return 'status-warning';
    if (status.pending > 0) return 'status-info';
    return 'status-good';
  };

  const renderOverviewTab = () => {
    if (loading) {
      return (
        <div className="tab-content">
          <div className="loading-state">Loading dashboard data...</div>
        </div>
      );
    }

    if (patients.length === 0) {
      return (
        <div className="tab-content">
          <div className="empty-state">
            <p>No active patients found. Add a patient to get started.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="tab-content">
      <div className="summary-cards">
        <div className="summary-card">
          <div className="summary-label">Patients</div>
          <div className="summary-value">{summaryStats.activePatients}/{summaryStats.totalPatients}</div>
          <div className="summary-subtext">Active patients</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Medications Today</div>
          <div className="summary-value">{summaryStats.pendingMedications}</div>
          <div className="summary-subtext">{summaryStats.missedMedications} missed</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Care Tasks Today</div>
          <div className="summary-value">{summaryStats.pendingCareTasks}</div>
          <div className="summary-subtext">{summaryStats.missedCareTasks} missed</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">Equipment</div>
          <div className="summary-value">{summaryStats.equipmentDue}</div>
          <div className="summary-subtext">Due for change</div>
        </div>
      </div>

      <div className="patient-table-container">
        <h3>Patients</h3>
        <table className="patient-table">
          <thead>
            <tr>
              <th>Patient</th>
              <th>MRN</th>
              <th>Age</th>
              <th>Medications</th>
              <th>Care Tasks</th>
              <th>Equipment</th>
              <th>Last Update</th>
            </tr>
          </thead>
          <tbody>
            {patients.map(patient => (
              <tr key={patient.id} className="patient-row">
                <td>
                  <a href="#" className="patient-link">{patient.name}</a>
                </td>
                <td>{patient.mrn}</td>
                <td>{patient.age}</td>
                <td>
                  <div className={`status-cell ${getStatusClass(patient.medicationsStatus)}`}>
                    <div className="status-main">
                      {patient.medicationsStatus.completed}/{patient.medicationsStatus.total} complete
                    </div>
                    <div className="status-details">
                      {patient.medicationsStatus.pending > 0 && (
                        <span className="status-badge pending">{patient.medicationsStatus.pending} pending</span>
                      )}
                      {patient.medicationsStatus.missed > 0 && (
                        <span className="status-badge missed">{patient.medicationsStatus.missed} missed</span>
                      )}
                      {patient.medicationsStatus.dueSoon > 0 && (
                        <span className="status-badge due-soon">{patient.medicationsStatus.dueSoon} due soon</span>
                      )}
                    </div>
                  </div>
                </td>
                <td>
                  <div className={`status-cell ${getStatusClass(patient.careTasksStatus)}`}>
                    <div className="status-main">
                      {patient.careTasksStatus.completed}/{patient.careTasksStatus.total} complete
                    </div>
                    <div className="status-details">
                      {patient.careTasksStatus.pending > 0 && (
                        <span className="status-badge pending">{patient.careTasksStatus.pending} pending</span>
                      )}
                      {patient.careTasksStatus.missed > 0 && (
                        <span className="status-badge missed">{patient.careTasksStatus.missed} missed</span>
                      )}
                      {patient.careTasksStatus.dueSoon > 0 && (
                        <span className="status-badge due-soon">{patient.careTasksStatus.dueSoon} due soon</span>
                      )}
                    </div>
                  </div>
                </td>
                <td>
                  <div className={`status-cell ${patient.equipmentStatus.dueForChange > 0 ? 'status-warning' : 'status-good'}`}>
                    <div className="status-main">
                      {patient.equipmentStatus.ok}/{patient.equipmentStatus.total} ok
                    </div>
                    {patient.equipmentStatus.dueForChange > 0 && (
                      <div className="status-details">
                        <span className="status-badge warning">{patient.equipmentStatus.dueForChange} due</span>
                      </div>
                    )}
                  </div>
                </td>
                <td className="last-update">{patient.lastUpdate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    );
  };

  const renderMedicationsTab = () => (
    <div className="tab-content">
      <h3>Medications - Coming Soon</h3>
      <p>Detailed medication management view will be available here.</p>
    </div>
  );

  const renderCareTasksTab = () => (
    <div className="tab-content">
      <h3>Care Tasks - Coming Soon</h3>
      <p>Detailed care task management view will be available here.</p>
    </div>
  );

  const renderEquipmentTab = () => (
    <div className="tab-content">
      <h3>Equipment - Coming Soon</h3>
      <p>Detailed equipment management view will be available here.</p>
    </div>
  );

  return (
    <div className="adminv2-container">
      {/* Side Navigation */}
      <nav className="adminv2-sidenav">
        <div className="sidenav-header">
          <div className="sidenav-logo">
            <span className="logo-icon">❤️</span>
            <div className="logo-text">
              <div className="logo-title">Smart Home Health</div>
              <div className="logo-subtitle">Admin V2</div>
            </div>
          </div>
        </div>
        <ul className="sidenav-menu">
          <li className="sidenav-item active">
            <a href="#">
              <span className="sidenav-label">Dashboard</span>
            </a>
          </li>
          <li className="sidenav-item">
            <a href="#">
              <span className="sidenav-label">Patients</span>
            </a>
          </li>
          <li className="sidenav-item">
            <a href="#">
              <span className="sidenav-label">Medications</span>
            </a>
          </li>
          <li className="sidenav-item">
            <a href="#">
              <span className="sidenav-label">Care Tasks</span>
            </a>
          </li>
          <li className="sidenav-item">
            <a href="#">
              <span className="sidenav-label">Equipment</span>
            </a>
          </li>
          <li className="sidenav-item">
            <a href="#">
              <span className="sidenav-label">Providers</span>
            </a>
          </li>
          <li className="sidenav-item">
            <a href="#">
              <span className="sidenav-label">Businesses</span>
            </a>
          </li>
          <li className="sidenav-item">
            <a href="#">
              <span className="sidenav-label">Settings</span>
            </a>
          </li>
        </ul>
        <div className="sidenav-footer">
          <a href="/admin" className="btn-back-to-v1">← Back to V1</a>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="adminv2-main">
        <div className="adminv2-header">
          <h1>Dashboard</h1>
          <div className="header-actions">
            <button className="btn-secondary" onClick={fetchDashboardData}>Refresh</button>
            <button className="btn-primary">Add Patient</button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="tab-navigation">
          <button 
            className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button 
            className={`tab-button ${activeTab === 'medications' ? 'active' : ''}`}
            onClick={() => setActiveTab('medications')}
          >
            Medications
          </button>
          <button 
            className={`tab-button ${activeTab === 'careTasks' ? 'active' : ''}`}
            onClick={() => setActiveTab('careTasks')}
          >
            Care Tasks
          </button>
          <button 
            className={`tab-button ${activeTab === 'equipment' ? 'active' : ''}`}
            onClick={() => setActiveTab('equipment')}
          >
            Equipment
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'medications' && renderMedicationsTab()}
        {activeTab === 'careTasks' && renderCareTasksTab()}
        {activeTab === 'equipment' && renderEquipmentTab()}
      </div>
    </div>
  );
};

export default AdminDashboard;
